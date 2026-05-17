import { HttpStatus, Injectable } from "@nestjs/common";
import { randomBytes } from "node:crypto";
import { AppConfigService } from "../../../shared/config/app-config.service";
import { apiError } from "../../../shared/http/http-errors";
import { PrismaService } from "../../../shared/prisma/prisma.service";
import { AuditService } from "../../../shared/audit/audit.service";
import { HashService } from "../../../shared/security/hash.service";
import { SecretEncryptionService } from "../../../shared/security/secret-encryption.service";
import { requireNonEmptyStringArray, requireNonEmptyStrings } from "../shared/input-validation";
import { AdminBaseService } from "../shared/admin-base.service";

const PROTECTED_ADMIN_CLIENT_ID = "authany-admin-web";

@Injectable()
export class ApplicationsService extends AdminBaseService {
  constructor(
    prisma: PrismaService,
    config: AppConfigService,
    private readonly hashes: HashService,
    private readonly secrets: SecretEncryptionService,
    private readonly audit: AuditService,
  ) {
    super(prisma, config);
  }

  async list(input: { q?: string; status?: string } = {}) {
    const clients = await this.prisma.oAuthClient.findMany({
      where: {
        tenantId: this.config.tenantId,
        status: input.status || undefined,
        deletedAt: null
      },
      include: { redirectUris: true, secrets: true },
      orderBy: { updatedAt: "desc" }
    });
    const q = input.q?.trim().toLowerCase();
    return clients.map((client) => this.toSummary(client)).filter((client) => {
      if (!q) {
        return true;
      }
      return [client.name, client.app_id, ...client.redirect_uris]
        .join(" ")
        .toLowerCase()
        .includes(q);
    });
  }

  async get(id: string) {
    const client = await this.findActiveRecord(id);
    return this.toDetail(client);
  }

  async create(input: {
    name: string;
    description?: string;
    redirect_uris: string[];
  }) {
    const values = requireNonEmptyStrings(input, [{ key: "name", label: "Application name" }]);
    const redirectUris = this.validateRedirectUris(input.redirect_uris);
    const appId = await this.generateAppId();
    const appSecret = this.generateAppSecret();
    const client = await this.prisma.oAuthClient.create({
      data: {
        tenantId: this.config.tenantId,
        clientId: appId,
        clientType: "confidential",
        name: values.name,
        description: normalizeOptional(input.description),
        status: "active",
        allowedGrantTypes: ["authorization_code", "refresh_token"],
        allowedScopes: ["openid", "profile", "offline_access"],
        redirectUris: {
          create: redirectUris.map((redirectUri) => ({ tenantId: this.config.tenantId, redirectUri }))
        },
        secrets: {
          create: this.secretCreateData(appSecret)
        }
      },
      include: { redirectUris: true, secrets: true }
    });
    await this.audit.record({
      eventType: "admin.application.create",
      result: "success",
      clientId: client.id,
      payload: { app_id: appId, redirect_uri_count: redirectUris.length }
    });
    await this.audit.record({
      eventType: "admin.application.secret.issue",
      result: "success",
      clientId: client.id,
      payload: { hint: secretHint(appSecret) }
    });
    return { ...this.toDetail(client), app_secret: appSecret };
  }

  async update(id: string, input: {
    name?: string;
    description?: string;
    redirect_uris?: string[];
    status?: string;
  }) {
    const current = await this.findActiveRecord(id);
    this.assertProtectedAdminClientUpdateAllowed(current, input);
    const redirectUris = input.redirect_uris ? this.validateRedirectUris(input.redirect_uris) : undefined;
    const client = await this.prisma.oAuthClient.update({
      where: { id },
      data: {
        description: input.description === undefined ? undefined : normalizeOptional(input.description),
        name: input.name === undefined ? undefined : requireNonEmptyStrings({ name: input.name }, [{ key: "name", label: "Application name" }]).name,
        status: input.status,
        redirectUris: redirectUris ? {
          deleteMany: {},
          create: redirectUris.map((redirectUri) => ({ tenantId: this.config.tenantId, redirectUri }))
        } : undefined
      },
      include: { redirectUris: true, secrets: true }
    });
    await this.audit.record({
      eventType: "admin.application.update",
      result: "success",
      clientId: id,
      payload: {
        app_id: current.clientId,
        status: input.status,
        redirect_uri_count: redirectUris?.length
      }
    });
    return this.toDetail(client);
  }

  async revealSecret(id: string, secretId: string) {
    await this.findActiveRecord(id);
    const secret = await this.prisma.oAuthClientSecret.findFirst({
      where: {
        id: secretId,
        clientId: id,
        tenantId: this.config.tenantId,
        status: "active"
      }
    });
    if (!secret?.secretCiphertext) {
      throw apiError(HttpStatus.BAD_REQUEST, "secret_not_revealable", "This secret cannot be revealed. Rotate it to create a revealable secret.");
    }
    const appSecret = this.secrets.decrypt(secret.secretCiphertext);
    await this.prisma.oAuthClientSecret.update({
      where: { id: secret.id },
      data: { viewedAt: new Date() }
    });
    await this.audit.record({
      eventType: "admin.application.secret.reveal",
      result: "success",
      clientId: id,
      payload: { secret_id: secret.id, hint: secret.hint }
    });
    return { app_secret: appSecret, expires_at: secret.expiresAt };
  }

  async rotateSecret(id: string) {
    const client = await this.findActiveRecord(id);
    this.assertNotProtectedAdminClient(client, "Admin application Secret cannot be reset from the admin console.");
    await this.prisma.oAuthClientSecret.updateMany({
      where: { clientId: id, status: "active" },
      data: { status: "revoked", revokedAt: new Date() }
    });
    const appSecret = this.generateAppSecret();
    const secret = await this.prisma.oAuthClientSecret.create({
      data: {
        clientId: id,
        ...this.secretCreateData(appSecret)
      }
    });
    await this.audit.record({
      eventType: "admin.application.secret.rotate",
      result: "success",
      clientId: id,
      payload: { secret_id: secret.id, hint: secret.hint }
    });
    return {
      app_secret: appSecret,
      hint: secret.hint,
      secret_id: secret.id
    };
  }

  async delete(id: string, input: { confirm_name?: string }) {
    const client = await this.findActiveRecord(id);
    this.assertNotProtectedAdminClient(client, "Admin application cannot be deleted from the admin console.");
    if (input.confirm_name !== client.name) {
      throw apiError(HttpStatus.BAD_REQUEST, "delete_confirmation_mismatch", "Application name confirmation does not match.");
    }
    const deleted = await this.prisma.oAuthClient.update({
      where: { id },
      data: {
        deletedAt: new Date(),
        status: "deleted",
        secrets: {
          updateMany: {
            where: { status: "active" },
            data: { status: "revoked", revokedAt: new Date() }
          }
        }
      }
    });
    await this.audit.record({
      eventType: "admin.application.delete",
      result: "success",
      clientId: id,
      payload: { app_id: client.clientId }
    });
    return { id: deleted.id, status: deleted.status };
  }

  private async findActiveRecord(id: string) {
    const client = await this.prisma.oAuthClient.findFirst({
      where: {
        id,
        tenantId: this.config.tenantId,
        deletedAt: null
      },
      include: { redirectUris: true, secrets: true }
    });
    if (!client) {
      throw apiError(HttpStatus.NOT_FOUND, "application_not_found", "Application was not found.");
    }
    return client;
  }

  private async generateAppId() {
    for (let attempt = 0; attempt < 5; attempt += 1) {
      const appId = `app_live_${randomBytes(18).toString("base64url")}`;
      const existing = await this.prisma.oAuthClient.findFirst({
        where: {
          clientId: appId,
          tenantId: this.config.tenantId
        }
      });
      if (!existing) {
        return appId;
      }
    }
    throw new Error("Unable to generate unique App ID.");
  }

  private generateAppSecret() {
    return `sk_live_${randomBytes(32).toString("base64url")}`;
  }

  private secretCreateData(appSecret: string) {
    return {
      encryptionKeyId: this.secrets.keyId(),
      hint: secretHint(appSecret),
      secretCiphertext: this.secrets.encrypt(appSecret),
      secretHash: this.hashes.hashSecret(appSecret),
      status: "active",
      tenantId: this.config.tenantId
    };
  }

  private validateRedirectUris(value: string[]) {
    const redirectUris = requireNonEmptyStringArray({ redirect_uris: value }, "redirect_uris", "Redirect URIs");
    for (const redirectUri of redirectUris) {
      validateRedirectUri(redirectUri, this.config.nodeEnv);
    }
    return [...new Set(redirectUris)];
  }

  private assertNotProtectedAdminClient(client: ApplicationRecord, message: string) {
    if (isProtectedAdminClient(client)) {
      throw protectedAdminApplicationError(message);
    }
  }

  private assertProtectedAdminClientUpdateAllowed(client: ApplicationRecord, input: { redirect_uris?: string[]; status?: string }) {
    if (!isProtectedAdminClient(client)) {
      return;
    }
    if (hasUnsafeStatusChange(input)) {
      throw protectedAdminApplicationError("Admin application must remain active.");
    }
    if (hasRedirectUriChange(input)) {
      throw protectedAdminApplicationError("Admin application Redirect URIs cannot be changed from the admin console.");
    }
  }

  private toSummary(client: ApplicationRecord) {
    return {
      app_id: client.clientId,
      created_at: client.createdAt,
      description: client.description,
      id: client.id,
      is_protected: isProtectedAdminClient(client),
      name: client.name,
      redirect_uri_count: client.redirectUris.length,
      redirect_uris: client.redirectUris.map((item) => item.redirectUri),
      secret_count: client.secrets.filter((secret) => secret.status === "active").length,
      status: client.status,
      updated_at: client.updatedAt
    };
  }

  private toDetail(client: ApplicationRecord) {
    return {
      ...this.toSummary(client),
      allowed_grant_types: client.allowedGrantTypes,
      allowed_scopes: client.allowedScopes,
      secrets: client.secrets.map((secret) => ({
        created_at: secret.issuedAt,
        hint: secret.hint,
        id: secret.id,
        last_used_at: secret.lastUsedAt,
        revealable: Boolean(secret.secretCiphertext),
        status: secret.status,
        viewed_at: secret.viewedAt
      }))
    };
  }
}

type ApplicationRecord = Awaited<ReturnType<ApplicationsService["findActiveRecord"]>>;

function isProtectedAdminClient(client: { clientId: string }) {
  return client.clientId === PROTECTED_ADMIN_CLIENT_ID;
}

function protectedAdminApplicationError(message: string) {
  return apiError(HttpStatus.BAD_REQUEST, "protected_admin_application", message);
}

function hasRedirectUriChange(input: { redirect_uris?: string[] }) {
  return input.redirect_uris !== undefined;
}

function hasUnsafeStatusChange(input: { status?: string }) {
  return input.status !== undefined && input.status !== "active";
}

function normalizeOptional(value?: string) {
  const normalized = value?.trim();
  return normalized || null;
}

function secretHint(secret: string) {
  return `${secret.slice(0, 7)}...${secret.slice(-4)}`;
}

function validateRedirectUri(value: string, nodeEnv: string) {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw apiError(HttpStatus.BAD_REQUEST, "invalid_redirect_uri", "Redirect URI must be a valid URL.");
  }
  if (value.includes("*")) {
    throw apiError(HttpStatus.BAD_REQUEST, "invalid_redirect_uri", "Redirect URI cannot contain wildcards.");
  }
  const isLocalhost = ["localhost", "127.0.0.1", "::1"].includes(url.hostname);
  if (nodeEnv === "production" && url.protocol !== "https:") {
    throw apiError(HttpStatus.BAD_REQUEST, "invalid_redirect_uri", "Production redirect URI must use HTTPS.");
  }
  if (nodeEnv !== "production" && url.protocol !== "https:" && !(url.protocol === "http:" && isLocalhost)) {
    throw apiError(HttpStatus.BAD_REQUEST, "invalid_redirect_uri", "HTTP redirect URI is only allowed for local development.");
  }
}
