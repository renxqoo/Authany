import { HttpStatus, Injectable } from "@nestjs/common";
import { apiError } from "../../shared/http/http-errors";
import { PrismaService } from "../../shared/prisma/prisma.service";
import { TokenSignerService } from "../../shared/security/token-signer.service";
import { AppConfigService } from "../../shared/config/app-config.service";

@Injectable()
export class TargetTokenVerifierService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tokenSigner: TokenSignerService,
    private readonly config: AppConfigService,
  ) {}

  async verifyForTargetResource(token: string, targetResourceCode: string) {
    const target = await this.prisma.targetResourceRegistration.findFirst({
	      where: {
	        tenantId: this.config.tenantId,
	        targetResourceCode,
	        status: "active"
	      }
    });
    if (!target) {
      throw apiError(HttpStatus.FORBIDDEN, "invalid_target_resource", "Target resource is invalid.");
    }

    const verified = await this.tokenSigner.verify(token, target.audience);
    const payload = verified.payload;
    const subject = String(payload.sub ?? "");
    const agentId = typeof payload.agent_id === "string" ? payload.agent_id : "";
    const appId = typeof payload.app_id === "string" ? payload.app_id : "";
    if (payload.token_use !== "target_access") {
      throw apiError(HttpStatus.UNAUTHORIZED, "invalid_token", "Token is not a target access token.");
    }
    if (!subject || (!agentId && !appId)) {
      throw apiError(HttpStatus.UNAUTHORIZED, "invalid_token", "Token is missing subject or principal identity.");
    }
    if (payload.target_resource !== targetResourceCode) {
      throw apiError(HttpStatus.UNAUTHORIZED, "invalid_token", "Token target_resource does not match the requested target resource.");
    }
    if (subject.startsWith("agent:") && subject.slice("agent:".length) !== agentId) {
      throw apiError(HttpStatus.UNAUTHORIZED, "invalid_token", "Token agent subject does not match agent_id.");
    }
    if (subject.startsWith("app:") && subject.slice("app:".length) !== appId) {
      throw apiError(HttpStatus.UNAUTHORIZED, "invalid_token", "Token application subject does not match app_id.");
    }

    return {
      active: true,
      subject,
      agent_id: agentId || undefined,
      app_id: appId || undefined,
      audience: target.audience,
      delegation_type: payload.delegation_type,
      agent_subject: subject.startsWith("agent:"),
      application_subject: subject.startsWith("app:")
    };
  }
}
