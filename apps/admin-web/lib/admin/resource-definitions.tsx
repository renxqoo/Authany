import { AgentOperationsSection } from "@/components/admin/agent-sections";
import { ApplicationSecretSection } from "@/components/admin/application-sections";
import type { ResourceDefinition, ResourceKey, SelectOption } from "./types";
import type { I18nTranslator } from "@/lib/i18n/translate";

const activeInactive: SelectOption[] = [
  { label: "Active", value: "active" },
  { label: "Inactive", value: "inactive" }
];

const activeInactiveSuspendedDeleted: SelectOption[] = [
  { label: "Active", value: "active" },
  { label: "Inactive", value: "inactive" },
  { label: "Suspended", value: "suspended" },
  { label: "Deleted", value: "deleted" }
];

const targetConnectionStatuses: SelectOption[] = [
  { label: "Active", value: "active" },
  { label: "Inactive", value: "inactive" },
  { label: "Suspended", value: "suspended" },
  { label: "Deleted", value: "deleted" }
];

const accessGrantStatuses: SelectOption[] = [
  { label: "Active", value: "active" },
  { label: "Inactive", value: "inactive" },
  { label: "Revoked", value: "revoked" },
  { label: "Deleted", value: "deleted" }
];

const keyStatuses: SelectOption[] = [
  { label: "Pending", value: "pending" },
  { label: "Active", value: "active" },
  { label: "Verifying", value: "verifying" },
  { label: "Retired", value: "retired" }
];

function nestedString(record: Record<string, unknown>, key: string, nestedKey: string) {
  const nested = record[key];
  if (!nested || typeof nested !== "object") {
    return "";
  }
  const value = (nested as Record<string, unknown>)[nestedKey];
  return typeof value === "string" ? value : "";
}

function nestedBoolean(record: Record<string, unknown>, key: string, nestedKey: string) {
  const nested = record[key];
  if (!nested || typeof nested !== "object") {
    return false;
  }
  return Boolean((nested as Record<string, unknown>)[nestedKey]);
}

function recordString(record: Record<string, unknown>, key: string) {
  const value = record[key];
  return typeof value === "string" ? value : "";
}

function readTrustMetadata(record: Record<string, unknown>) {
  const value = record.trust_metadata;
  return value && typeof value === "object" ? value as Record<string, unknown> : null;
}

function hasExplicitValidationMode(record: Record<string, unknown>) {
  return recordString(record, "tokenValidationMode").trim() !== "";
}

function trustMetadataDisplay(record: Record<string, unknown>, t: I18nTranslator) {
  const trustMetadata = readTrustMetadata(record);
  if (!trustMetadata || !hasExplicitValidationMode(record)) {
    return {
      configured: false,
      reason: t(
        "admin.trust.hiddenReason",
        undefined,
        "Trust metadata is hidden until token validation mode is explicitly configured and reviewed.",
      )
    };
  }
  return trustMetadata;
}

function grantExpiryValidation(
  value: boolean | string | undefined,
  _values?: Record<string, string | boolean>,
  t?: I18nTranslator,
) {
  const translate = t ?? identityTranslator;
  const raw = String(value ?? "").trim();
  if (!raw) {
    return translate(
      "admin.validation.expiresRequired",
      undefined,
      "Expires at is required. Avoid creating indefinite allow grants from the admin UI.",
    );
  }
  const timestamp = Date.parse(raw);
  if (Number.isNaN(timestamp)) {
    return translate("admin.validation.expiresInvalid", undefined, "Expires at must be a valid date and time.");
  }
  if (timestamp <= Date.now()) {
    return translate("admin.validation.expiresFuture", undefined, "Expires at must be in the future.");
  }
  return undefined;
}

function contextProviderValidation(
  value: boolean | string | undefined,
  values: Record<string, string | boolean>,
  t?: I18nTranslator,
) {
  const translate = t ?? identityTranslator;
  const mode = typeof values.external_context_mode === "string" ? values.external_context_mode : "";
  if (mode !== "optional" && mode !== "required") {
    return undefined;
  }
  const items = String(value ?? "").split("\n").map((item) => item.trim()).filter(Boolean);
  if (items.length === 0) {
    return translate(
      "admin.validation.contextProvidersRequired",
      undefined,
      "Select at least one allowed context provider when external context is allowed.",
    );
  }
  return undefined;
}

export const resourceDefinitions: Record<ResourceKey, ResourceDefinition> = {
  applications: {
    key: "applications",
    title: "Application Management",
    description: "Manage OAuth applications, redirect configuration, lifecycle, and App Secrets from one unified control surface.",
    path: "/applications",
    endpoint: "applications",
    emptyState: "No applications yet. Create the first application to start wiring OAuth clients.",
    titleValue: (record) => String(record.name ?? "Unnamed application"),
    subtitle: (record) => String(record.app_id ?? ""),
    status: (record) => String(record.status ?? ""),
    searchValues: (record) => [String(record.name ?? ""), String(record.app_id ?? ""), ...(Array.isArray(record.redirect_uris) ? record.redirect_uris.map(String) : [])],
    listColumns: [
      { label: "Name", key: "name" },
      { label: "App ID", key: "app_id", kind: "mono" },
      { label: "Status", key: "status", kind: "status" },
      { label: "Redirect URIs", key: "redirect_uri_count", kind: "count" },
      { label: "Secrets", key: "secret_count", kind: "count" },
      { label: "Updated", key: "updated_at", kind: "date" }
    ],
    filters: [{ key: "status", label: "Status", getValue: (record) => String(record.status ?? ""), options: activeInactive }],
    createFields: [
      { name: "name", label: "Application name", placeholder: "Internal product or client name" },
      { name: "description", label: "Description", type: "textarea", required: false, placeholder: "Short purpose and ownership context" },
      { name: "redirect_uris", label: "Redirect URIs", type: "string-array", placeholder: "One redirect URI per line" }
    ],
    editFields: [
      { name: "name", label: "Application name" },
      { name: "description", label: "Description", type: "textarea", required: false },
      { name: "status", label: "Status", type: "select", options: activeInactive, getInitialValue: (record) => record.status },
      { name: "redirect_uris", label: "Redirect URIs", type: "string-array", getInitialValue: (record) => record.redirect_uris }
    ],
    detailSections: [
      {
        title: "Identity",
        fields: [
          { label: "App ID", key: "app_id", kind: "mono" },
          { label: "Name", key: "name" },
          { label: "Status", key: "status", kind: "status" },
          { label: "Description", key: "description" }
        ]
      },
      {
        title: "OAuth Setup",
        fields: [
          { label: "Redirect URIs", key: "redirect_uris", kind: "string-array" },
          { label: "Allowed grant types", key: "allowed_grant_types", kind: "string-array" },
          { label: "Allowed scopes", key: "allowed_scopes", kind: "string-array" },
          { label: "Updated", key: "updated_at", kind: "date" }
        ]
      }
    ],
    extraSections: (record, refresh) => <ApplicationSecretSection app={record as never} refresh={refresh} />,
    dangerAction: {
      label: "Delete application",
      endpoint: (id) => `applications/${id}/delete`,
      confirmTitle: "Delete application",
      confirmDescription: "Deleting an application revokes active secrets and removes it from the control plane.",
      confirmLabel: "Type the application name to confirm deletion",
      confirmMatchValue: (record) => String(record.name ?? ""),
      buildBody: (record) => ({ confirm_name: record.name }),
      redirectToListOnSuccess: true,
      variant: "danger"
    }
  },
  agents: {
    key: "agents",
    title: "Agent Management",
    description: "Manage execution identities, caller credentials, runtimes, and downstream target access.",
    path: "/agents",
    endpoint: "agents",
    emptyState: "No agents yet. Create an execution identity before issuing credentials or runtimes.",
    titleValue: (record) => String(record.name ?? "Unnamed agent"),
    subtitle: (record) => String(record.agent_id ?? ""),
    status: (record) => String(record.status ?? ""),
    searchValues: (record) => [String(record.name ?? ""), String(record.agent_id ?? ""), String(record.description ?? "")],
    listColumns: [
      { label: "Name", key: "name" },
      { label: "Agent ID", key: "agent_id", kind: "mono" },
      { label: "Status", key: "status", kind: "status" },
      { label: "Runtimes", key: "runtime_count", kind: "count" },
      { label: "Credentials", key: "credential_count", kind: "count" },
      { label: "Grants", key: "grant_count", kind: "count" }
    ],
    filters: [
      { key: "status", label: "Status", getValue: (record) => String(record.status ?? ""), options: activeInactiveSuspendedDeleted }
    ],
    createFields: [
      { name: "name", label: "Agent name" },
      { name: "description", label: "Description", type: "textarea", required: false }
    ],
    editFields: [
      { name: "name", label: "Agent name" },
      {
        name: "status",
        label: "Status",
        type: "select",
        options: activeInactiveSuspendedDeleted,
        getInitialValue: (record) => record.status
      },
      { name: "description", label: "Description", type: "textarea", required: false }
    ],
    detailSections: [
      {
        title: "Identity",
        fields: [
          { label: "Agent ID", key: "agent_id", kind: "mono" },
          { label: "Status", key: "status", kind: "status" }
        ]
      },
      {
        title: "Metadata",
        fields: [
          { label: "Name", key: "name" },
          { label: "Description", key: "description" },
          { label: "Created", key: "created_at", kind: "date" },
          { label: "Updated", key: "updated_at", kind: "date" }
        ]
      }
    ],
    extraSections: (record, refresh) => <AgentOperationsSection agent={record as never} refresh={refresh} />,
    dangerAction: {
      label: "Delete agent",
      endpoint: (id) => `agents/${id}/delete`,
      confirmTitle: "Delete agent",
      confirmDescription: "Deleting an agent revokes active caller credentials and removes the execution identity.",
      confirmLabel: "Type the agent name to confirm deletion",
      confirmMatchValue: (record) => String(record.name ?? ""),
      buildBody: (record) => ({ confirm_name: record.name }),
      redirectToListOnSuccess: true,
      variant: "danger"
    }
  },
  runtimes: {
    key: "runtimes",
    title: "Runtime Registrations",
    description: "Register runtime execution environments with explicit refresh, cache, and credential policies.",
    path: "/runtimes",
    endpoint: "runtimes",
    emptyState: "No runtimes yet. Add a runtime after creating the owning agent.",
    titleValue: (record) => String(record.runtimeId ?? "Unnamed runtime"),
    subtitle: (record) => nestedString(record, "agent", "agentId"),
    status: (record) => String(record.status ?? ""),
    searchValues: (record) => [String(record.runtimeId ?? ""), String(record.runtimeType ?? ""), nestedString(record, "agent", "agentId"), nestedString(record, "agent", "name")],
    listColumns: [
      { label: "Runtime ID", key: "runtimeId", kind: "mono" },
      { label: "Agent", getValue: (record) => nestedString(record, "agent", "agentId"), kind: "mono" },
      { label: "Type", key: "runtimeType" },
      { label: "Mode", key: "runtimeMode" },
      { label: "Refresh", key: "allowsDelegationRefresh", kind: "boolean" },
      { label: "Remote cache", key: "allowsRemoteCacheReuse", kind: "boolean" },
      { label: "Status", key: "status", kind: "status" },
      { label: "Updated", key: "updatedAt", kind: "date" }
    ],
    filters: [
      { key: "status", label: "Status", getValue: (record) => String(record.status ?? ""), options: activeInactiveSuspendedDeleted },
      {
        key: "runtimeMode",
        label: "Runtime mode",
        getValue: (record) => String(record.runtimeMode ?? ""),
        options: [
          { label: "Stateless", value: "stateless" },
          { label: "Stateful", value: "stateful" }
        ]
      }
    ],
    createFields: [
      {
        name: "agent_id",
        label: "Owning agent",
        type: "select",
        optionSource: { endpoint: "agents", valueKey: "agent_id", labelKeys: ["name", "agent_id"] }
      },
      { name: "runtime_type", label: "Runtime type", placeholder: "worker, browser, orchestrator..." },
      {
        name: "runtime_mode",
        label: "Runtime mode",
        type: "select",
        options: [
          { label: "Stateless", value: "stateless" },
          { label: "Stateful", value: "stateful" }
        ]
      },
      { name: "allows_delegation_refresh", label: "Delegation refresh", type: "boolean", required: false, placeholder: "Allow refresh for this runtime" },
      { name: "allows_remote_cache_reuse", label: "Remote cache reuse", type: "boolean", required: false, placeholder: "Allow remote cache reuse" }
    ],
    editFields: [
      {
        name: "status",
        label: "Status",
        type: "select",
        options: activeInactiveSuspendedDeleted,
        getInitialValue: (record) => record.status
      },
      {
        name: "runtime_mode",
        label: "Runtime mode",
        type: "select",
        options: [
          { label: "Stateless", value: "stateless" },
          { label: "Stateful", value: "stateful" }
        ],
        getInitialValue: (record) => record.runtimeMode
      },
      {
        name: "allows_delegation_refresh",
        label: "Delegation refresh",
        type: "boolean",
        required: false,
        getInitialValue: (record) => record.allowsDelegationRefresh
      },
      {
        name: "allows_remote_cache_reuse",
        label: "Remote cache reuse",
        type: "boolean",
        required: false,
        getInitialValue: (record) => record.allowsRemoteCacheReuse
      }
    ],
    detailSections: [
      {
        title: "Runtime Identity",
        fields: [
          { label: "Runtime ID", key: "runtimeId", kind: "mono" },
          { label: "Runtime type", key: "runtimeType" },
          { label: "Runtime mode", key: "runtimeMode" },
          { label: "Status", key: "status", kind: "status" }
        ]
      },
      {
        title: "Policy",
        fields: [
          { label: "Credential delivery", key: "credentialDeliveryMode" },
          { label: "Delegation refresh", key: "allowsDelegationRefresh", kind: "boolean" },
          { label: "Remote cache reuse", key: "allowsRemoteCacheReuse", kind: "boolean" },
          { label: "Updated", key: "updatedAt", kind: "date" }
        ]
      },
      {
        title: "Owner and Relations",
        fields: [
          { label: "Agent ID", getValue: (record) => nestedString(record, "agent", "agentId"), kind: "mono" },
          { label: "Agent name", getValue: (record) => nestedString(record, "agent", "name") },
          { label: "Connections", getValue: (record) => Array.isArray(record.connections) ? record.connections.length : 0, kind: "count" },
          { label: "Credentials", getValue: (record) => Array.isArray(record.credentials) ? record.credentials.length : 0, kind: "count" }
        ]
      }
    ],
    dangerAction: {
      label: "Delete runtime",
      endpoint: (id) => `runtimes/${id}`,
      method: "PATCH",
      buildBody: () => ({ status: "deleted" }),
      confirmTitle: "Delete runtime",
      confirmDescription: "Deleting a runtime removes it from active registration and breaks future runtime-bound access.",
      variant: "danger"
    }
  },
  "target-resources": {
    key: "target-resources",
    title: "Target Resources",
    description: "Register downstream target resources, trust metadata, and token validation policy without mixing in business-user bindings.",
    path: "/target-resources",
    endpoint: "target-resources",
    emptyState: "No target resources yet. Register a downstream resource before creating target connections.",
    titleValue: (record) => String(record.displayName ?? "Unnamed target"),
    subtitle: (record) => String(record.targetResourceCode ?? ""),
    status: (record) => String(record.status ?? ""),
    searchValues: (record) => [String(record.displayName ?? ""), String(record.targetResourceCode ?? ""), String(record.audience ?? "")],
    listColumns: [
      { label: "Display name", key: "displayName" },
      { label: "Code", key: "targetResourceCode", kind: "mono" },
      { label: "Audience", key: "audience", kind: "mono" },
      { label: "Validation", key: "tokenValidationMode" },
      { label: "Status", key: "status", kind: "status" },
      { label: "Updated", key: "updatedAt", kind: "date" }
    ],
    filters: [{ key: "status", label: "Status", getValue: (record) => String(record.status ?? ""), options: activeInactiveSuspendedDeleted }],
    createFields: [
      { name: "target_resource_code", label: "Target resource code" },
      { name: "display_name", label: "Display name" },
      { name: "audience", label: "Audience", placeholder: "Expected audience for target tokens" },
      {
        name: "token_validation_mode",
        label: "Token validation mode",
        type: "select",
        description: "Required. Make the validation strategy explicit instead of relying on server defaults.",
        options: [
          { label: "JWKS", value: "jwks" },
          { label: "Introspection", value: "introspection" }
        ]
      },
      {
        name: "trust_config_json",
        label: "Trust config",
        type: "json",
        description: "Provide explicit target resource trust configuration. Only JSON objects are allowed.",
        placeholder: "{\n  \"notes\": \"validation policy\"\n}"
      }
    ],
    editFields: [
      { name: "display_name", label: "Display name", getInitialValue: (record) => record.displayName },
      { name: "audience", label: "Audience", getInitialValue: (record) => record.audience },
      {
        name: "status",
        label: "Status",
        type: "select",
        options: activeInactiveSuspendedDeleted,
        getInitialValue: (record) => record.status
      },
      {
        name: "token_validation_mode",
        label: "Token validation mode",
        type: "select",
        description: "Keep this explicit so the UI does not imply a safe trust posture from fallback metadata.",
        options: [
          { label: "JWKS", value: "jwks" },
          { label: "Introspection", value: "introspection" }
        ],
        getInitialValue: (record) => record.tokenValidationMode
      },
      {
        name: "trust_config_json",
        label: "Trust config",
        type: "json",
        description: "Maintain explicit trust configuration for this target resource.",
        getInitialValue: (record) => record.trustConfigJson
      }
    ],
    detailSections: [
      {
        title: "Identity",
        fields: [
          { label: "Target resource code", key: "targetResourceCode", kind: "mono" },
          { label: "Display name", key: "displayName" },
          { label: "Audience", key: "audience", kind: "mono" },
          { label: "Status", key: "status", kind: "status" }
        ]
      },
      {
        title: "Trust Setup",
        fields: [
          {
            label: "Token validation mode",
            getValue: (record) => recordString(record, "tokenValidationMode") || "Not explicitly configured"
          },
          {
            label: "Trust metadata",
            getValue: (record) => trustMetadataDisplay(record, identityTranslator),
            kind: "json"
          },
          { label: "Updated", key: "updatedAt", kind: "date" }
        ]
      },
      {
        title: "Downstream Relations",
        fields: [
          { label: "Target connections", getValue: (record) => Array.isArray(record.connections) ? record.connections.length : 0, kind: "count" },
          { label: "Created", key: "createdAt", kind: "date" }
        ]
      }
    ],
    dangerAction: {
      label: "Delete target resource",
      endpoint: (id) => `target-resources/${id}`,
      method: "PATCH",
      buildBody: () => ({ status: "deleted" }),
      confirmTitle: "Delete target resource",
      confirmDescription: "Deleting a target resource will orphan related target connections and downstream grants.",
      variant: "danger"
    }
  },
  "target-connections": {
    key: "target-connections",
    title: "Target Connections",
    description: "Define which application, agent, or runtime may connect to which target resource under explicit platform rules.",
    path: "/target-connections",
    endpoint: "target-connections",
    emptyState: "No target connections yet. Create a connection after registering an access client and target resource.",
    titleValue: (record) => String(record.connectionId ?? "Unnamed connection"),
    subtitle: (record) => String(record.targetResource ?? ""),
    status: (record) => String(record.status ?? ""),
    searchValues: (record) => [String(record.connectionId ?? ""), String(record.principalId ?? ""), String(record.targetResource ?? "")],
    listColumns: [
      { label: "Connection ID", key: "connectionId", kind: "mono" },
      { label: "Principal type", key: "principalType" },
      { label: "Principal ID", key: "principalId", kind: "mono" },
      { label: "Target resource", key: "targetResource", kind: "mono" },
      { label: "Context mode", key: "externalContextMode" },
      { label: "TTL", key: "maxTokenTtlSeconds" },
      { label: "Status", key: "status", kind: "status" }
    ],
    filters: [
      {
        key: "principalType",
        label: "Principal type",
        getValue: (record) => String(record.principalType ?? ""),
        options: [
          { label: "Agent", value: "agent" },
          { label: "Application", value: "application" },
          { label: "Runtime", value: "runtime" }
        ]
      },
      {
        key: "targetResource",
        label: "Target resource",
        getValue: (record) => String(record.targetResource ?? ""),
        optionSource: { endpoint: "target-resources", valueKey: "targetResourceCode", labelKeys: ["displayName", "targetResourceCode"] }
      },
      { key: "status", label: "Status", getValue: (record) => String(record.status ?? ""), options: targetConnectionStatuses }
    ],
    createFields: [
      {
        name: "principal_type",
        label: "Principal type",
        type: "select",
        description: "Choose whether this connection belongs to an application, an agent, or one specific runtime.",
        options: [
          { label: "Agent", value: "agent" },
          { label: "Application", value: "application" },
          { label: "Runtime", value: "runtime" }
        ]
      },
      {
        name: "principal_id",
        label: "Application ID",
        type: "select",
        dependsOn: { field: "principal_type", values: ["application"] },
        description: "Choose the application's `clientId`. Data comes from Application Management.",
        optionSource: { endpoint: "applications", valueKey: "app_id", labelKeys: ["name", "app_id"] }
      },
      {
        name: "principal_id",
        label: "Agent ID",
        type: "select",
        dependsOn: { field: "principal_type", values: ["agent"] },
        description: "Choose the agent's `agentId`. Data comes from Agent Management.",
        optionSource: { endpoint: "agents", valueKey: "agent_id", labelKeys: ["name", "agent_id"] }
      },
      {
        name: "principal_id",
        label: "Runtime ID",
        type: "select",
        dependsOn: { field: "principal_type", values: ["runtime"] },
        description: "Choose the runtime's `runtimeId`. Data comes from Runtime Management.",
        optionSource: { endpoint: "runtimes", valueKey: "runtimeId", labelKeys: ["runtimeId", "runtimeType"] }
      },
      {
        name: "runtime_id",
        label: "Runtime ID",
        type: "select",
        required: false,
        dependsOn: { field: "principal_type", values: ["agent"] },
        description: "Optional but strongly recommended. Leaving this empty lets every runtime owned by the agent match this connection.",
        optionSource: { endpoint: "runtimes", valueKey: "runtimeId", labelKeys: ["runtimeId", "runtimeType"], queryParamField: "agent_id", queryValueField: "principal_id" },
        placeholder: "Choose a runtime explicitly"
      },
      {
        name: "target_resource",
        label: "Target resource",
        type: "select",
        description: "Choose the target resource that may be accessed. Data comes from Target Resources.",
        optionSource: {
          endpoint: "target-resources",
          valueKey: "targetResourceCode",
          labelKeys: ["displayName", "targetResourceCode"],
          match: { status: "active" }
        }
      },
      {
        name: "external_context_mode",
        label: "External context mode",
        type: "select",
        description: "Required. Explicitly decide whether external context is forbidden, optional, or required.",
        options: [
          { label: "Optional", value: "optional" },
          { label: "Required", value: "required" },
          { label: "Forbidden", value: "forbidden" }
        ]
      },
      {
        name: "allowed_context_providers",
        label: "Allowed context providers",
        type: "string-array",
        description: "Required when external context is optional or required. One provider per line.",
        validate: contextProviderValidation
      },
      {
        name: "allowed_context_providers",
        label: "Allowed context providers",
        type: "string-array",
        required: false,
        dependsOn: { field: "external_context_mode", values: ["forbidden"] },
        description: "When external context is forbidden, this field does not need a value."
      },
      {
        name: "max_token_ttl_seconds",
        label: "Max token TTL seconds",
        type: "number",
        description: "Required. Set an explicit connection-level TTL instead of inheriting the system fallback.",
        placeholder: "60 - 10800"
      }
    ],
    editFields: [
      {
        name: "status",
        label: "Status",
        type: "select",
        options: targetConnectionStatuses,
        getInitialValue: (record) => record.status
      },
      {
        name: "external_context_mode",
        label: "External context mode",
        type: "select",
        description: "Keep this explicit so connection policy is obvious during review.",
        options: [
          { label: "Optional", value: "optional" },
          { label: "Required", value: "required" },
          { label: "Forbidden", value: "forbidden" }
        ],
        getInitialValue: (record) => record.externalContextMode
      },
      {
        name: "allowed_context_providers",
        label: "Allowed context providers",
        type: "string-array",
        description: "Required when external context is optional or required. One provider per line.",
        validate: contextProviderValidation,
        getInitialValue: (record) => record.allowedContextProvidersJson
      },
      {
        name: "max_token_ttl_seconds",
        label: "Max token TTL seconds",
        type: "number",
        description: "Keep an explicit TTL on the connection so reviewers do not have to infer a backend fallback.",
        getInitialValue: (record) => record.maxTokenTtlSeconds
      },
      { name: "expires_at", label: "Expires at", type: "datetime-local", required: false, getInitialValue: (record) => record.expiresAt }
    ],
    detailSections: [
      {
        title: "Connection Identity",
        fields: [
          { label: "Connection ID", key: "connectionId", kind: "mono" },
          { label: "Principal type", key: "principalType" },
          { label: "Principal ID", key: "principalId", kind: "mono" },
          { label: "Status", key: "status", kind: "status" }
        ]
      },
      {
        title: "Policy",
        fields: [
          { label: "Target resource", key: "targetResource", kind: "mono" },
          { label: "External context mode", key: "externalContextMode" },
          { label: "Allowed context providers", key: "allowedContextProvidersJson", kind: "string-array" },
          { label: "Max token TTL", key: "maxTokenTtlSeconds" },
          { label: "Expires", key: "expiresAt", kind: "date" }
        ]
      },
      {
        title: "Relations",
        fields: [
          { label: "Runtime ID", getValue: (record) => record.runtime && typeof record.runtime === "object" ? (record.runtime as { runtimeId?: string }).runtimeId : "", kind: "mono" },
          { label: "Target display name", getValue: (record) => record.target && typeof record.target === "object" ? (record.target as { displayName?: string }).displayName : "" },
          { label: "Access grants", getValue: (record) => Array.isArray(record.grants) ? record.grants.length : 0, kind: "count" },
          { label: "Updated", key: "updatedAt", kind: "date" }
        ]
      }
    ],
    dangerAction: {
      label: "Delete target connection",
      endpoint: (id) => `target-connections/${id}`,
      method: "PATCH",
      buildBody: () => ({ status: "deleted" }),
      confirmTitle: "Delete target connection",
      confirmDescription: "Deleting this connection blocks future target token issuance for the selected principal.",
      variant: "danger"
    }
  },
  "access-grants": {
    key: "access-grants",
    title: "Access Grants",
    description: "Open or suspend platform-level target access for a target connection. This does not model downstream business scopes inside the target resource.",
    path: "/access-grants",
    endpoint: "access-grants",
    emptyState: "No access grants yet. Create one after the target connection is ready so AuthAny can issue target-access tokens.",
    titleValue: (record) => String(record.grantId ?? "Unnamed grant"),
    subtitle: (record) => nestedString(record, "connection", "connectionId") || String(record.connectionId ?? ""),
    status: (record) => String(record.status ?? ""),
    searchValues: (record) => [String(record.grantId ?? ""), String(record.grantType ?? ""), nestedString(record, "connection", "connectionId"), nestedString(record, "connection", "targetResource")],
    listColumns: [
      { label: "Grant ID", key: "grantId", kind: "mono" },
      { label: "Connection", getValue: (record) => nestedString(record, "connection", "connectionId"), kind: "mono" },
      { label: "Type", key: "grantType" },
      { label: "Effect", key: "effect" },
      { label: "Status", key: "status", kind: "status" },
      { label: "Expires", key: "expiresAt", kind: "date" }
    ],
    filters: [
      { key: "status", label: "Status", getValue: (record) => String(record.status ?? ""), options: accessGrantStatuses },
      { key: "effect", label: "Effect", getValue: (record) => String(record.effect ?? ""), options: [{ label: "Allow", value: "allow" }] }
    ],
    createFields: [
      {
        name: "connection_id",
        label: "Target connection",
        type: "select",
        description: "Choose which existing connection should be allowed to receive target-access tokens.",
        optionSource: { endpoint: "target-connections", valueKey: "connectionId", labelKeys: ["connectionId", "principalId", "targetResource"] }
      },
      {
        name: "grant_type",
        label: "Grant type",
        type: "select",
        description: "Explicitly submit the system grant type so creation never depends on a backend default.",
        options: [{ label: "Target access", value: "target_access" }]
      },
      {
        name: "effect",
        label: "Decision",
        type: "select",
        description: "Explicitly submit the allow decision so creation never depends on a backend default allow.",
        options: [{ label: "Allow", value: "allow" }]
      },
      {
        name: "constraints",
        label: "Advanced constraints",
        type: "json",
        description: "Provide explicit constraint JSON. If there are no extra constraints yet, submit an empty object `{}` on purpose."
      },
      {
        name: "expires_at",
        label: "Expires at",
        type: "datetime-local",
        description: "Required. The admin UI does not create indefinite allow grants.",
        validate: grantExpiryValidation
      }
    ],
    editFields: [
      {
        name: "status",
        label: "Status",
        type: "select",
        description: "Use status to turn the allow decision on or off without deleting the connection itself.",
        options: accessGrantStatuses,
        getInitialValue: (record) => record.status
      },
      {
        name: "effect",
        label: "Decision",
        type: "select",
        options: [{ label: "Allow", value: "allow" }],
        description: "This version only supports allow, but the decision still stays explicit in the UI.",
        getInitialValue: (record) => record.effect
      },
      {
        name: "constraints",
        label: "Advanced constraints",
        type: "json",
        description: "Maintain explicit constraint JSON for this grant.",
        getInitialValue: (record) => record.constraintsJson
      },
      {
        name: "expires_at",
        label: "Expires at",
        type: "datetime-local",
        description: "Required in the admin UI. Moving a grant back to indefinite should require an explicit backend decision.",
        validate: grantExpiryValidation,
        getInitialValue: (record) => record.expiresAt
      }
    ],
    detailSections: [
      {
        title: "Grant Identity",
        fields: [
          { label: "Grant ID", key: "grantId", kind: "mono" },
          { label: "Grant type", key: "grantType" },
          { label: "Effect", key: "effect" },
          { label: "Status", key: "status", kind: "status" }
        ]
      },
      {
        title: "Policy",
        fields: [
          { label: "Constraints", key: "constraintsJson", kind: "json" },
          { label: "Expires at", key: "expiresAt", kind: "date" },
          { label: "Updated", key: "updatedAt", kind: "date" }
        ]
      },
      {
        title: "Connection Context",
        fields: [
          { label: "Connection ID", getValue: (record) => nestedString(record, "connection", "connectionId"), kind: "mono" },
          { label: "Target resource", getValue: (record) => nestedString(record, "connection", "targetResource"), kind: "mono" },
          { label: "Principal", getValue: (record) => nestedString(record, "connection", "principalId"), kind: "mono" },
          { label: "Created", key: "createdAt", kind: "date" }
        ]
      }
    ],
    dangerAction: {
      label: "Delete access grant",
      endpoint: (id) => `access-grants/${id}`,
      method: "PATCH",
      buildBody: () => ({ status: "deleted" }),
      confirmTitle: "Delete access grant",
      confirmDescription: "Deleting this grant removes the platform-level allow decision for future exchanges.",
      variant: "danger"
    }
  },
  "audit-events": {
    key: "audit-events",
    title: "Audit Events",
    description: "Inspect governance, authentication, secret handling, and target exchange activity in a unified read-only view.",
    path: "/audit-events",
    endpoint: "audit-events",
    emptyState: "No audit events found for the current tenant and filter selection.",
    titleValue: (record) => String(record.eventType ?? "Audit event"),
    subtitle: (record) => String(record.requestId ?? ""),
    status: (record) => String(record.result ?? ""),
    searchValues: (record) => [
      String(record.eventType ?? ""),
      String(record.result ?? ""),
      String(record.requestId ?? ""),
      String(record.targetResource ?? ""),
      String(record.errorCode ?? "")
    ],
    listColumns: [
      { label: "Occurred", key: "occurredAt", kind: "date" },
      { label: "Event type", key: "eventType" },
      { label: "Result", key: "result", kind: "status" },
      { label: "Operator", key: "operatorId", kind: "mono" },
      { label: "Agent", key: "agentId", kind: "mono" },
      { label: "Target resource", key: "targetResource", kind: "mono" },
      { label: "Request ID", key: "requestId", kind: "mono" }
    ],
    filters: [
      {
        key: "result",
        label: "Result",
        getValue: (record) => String(record.result ?? ""),
        options: [
          { label: "Success", value: "success" },
          { label: "Failure", value: "failure" }
        ]
      }
    ],
    detailSections: [
      {
        title: "Event Summary",
        fields: [
          { label: "Occurred", key: "occurredAt", kind: "date" },
          { label: "Event type", key: "eventType" },
          { label: "Result", key: "result", kind: "status" },
          { label: "Error code", key: "errorCode", kind: "mono" }
        ]
      },
      {
        title: "Actor Context",
        fields: [
          { label: "Operator ID", key: "operatorId", kind: "mono" },
          { label: "Agent ID", key: "agentId", kind: "mono" },
          { label: "Client ID", key: "clientId", kind: "mono" },
          { label: "Request ID", key: "requestId", kind: "mono" }
        ]
      },
      {
        title: "Target Context",
        fields: [
          { label: "Target resource", key: "targetResource", kind: "mono" },
          { label: "Payload", key: "payloadJson", kind: "json" }
        ]
      }
    ]
  },
  keys: {
    key: "keys",
    title: "Signing Keys",
    description: "Manage signing key lifecycle with explicit activation and retirement, while keeping private material protected.",
    path: "/keys",
    endpoint: "keys",
    emptyState: "No signing keys yet. Create a key before activating a new signing chain.",
    titleValue: (record) => String(record.kid ?? "Unnamed key"),
    subtitle: (record) => String(record.algorithm ?? ""),
    status: (record) => String(record.status ?? ""),
    searchValues: (record) => [String(record.kid ?? ""), String(record.algorithm ?? ""), String(record.status ?? "")],
    listColumns: [
      { label: "Key ID", key: "kid", kind: "mono" },
      { label: "Algorithm", key: "algorithm" },
      { label: "Status", key: "status", kind: "status" },
      { label: "Activated", key: "activatedAt", kind: "date" },
      { label: "Retired", key: "retiredAt", kind: "date" },
      { label: "Created", key: "createdAt", kind: "date" }
    ],
    filters: [
      { key: "status", label: "Status", getValue: (record) => String(record.status ?? ""), options: keyStatuses },
      {
        key: "algorithm",
        label: "Algorithm",
        getValue: (record) => String(record.algorithm ?? ""),
        options: [{ label: "RS256", value: "RS256" }]
      }
    ],
    createFields: [
      { name: "kid", label: "Key ID", required: false, placeholder: "Leave empty to auto-generate" },
      { name: "algorithm", label: "Algorithm", type: "select", required: false, options: [{ label: "RS256", value: "RS256" }] }
    ],
    detailSections: [
      {
        title: "Key Identity",
        fields: [
          { label: "Key ID", key: "kid", kind: "mono" },
          { label: "Algorithm", key: "algorithm" },
          { label: "Status", key: "status", kind: "status" },
          { label: "Created", key: "createdAt", kind: "date" }
        ]
      },
      {
        title: "Lifecycle",
        fields: [
          { label: "Activated", key: "activatedAt", kind: "date" },
          { label: "Retired", key: "retiredAt", kind: "date" }
        ]
      },
      {
        title: "Stored Material",
        fields: [
          {
            label: "Encryption key ID",
            kind: "mono",
            getValue: (record) => nestedString(record, "metadataJson", "encryption_key_id")
          },
          {
            label: "Private key stored securely",
            kind: "boolean",
            getValue: (record) => nestedBoolean(record, "metadataJson", "has_private_key")
          },
          {
            label: "Public key (PEM)",
            kind: "multiline",
            getValue: (record) => nestedString(record, "metadataJson", "public_key_pem")
          }
        ]
      }
    ],
    detailActions: [
      {
        label: "Activate key",
        endpoint: (id) => `keys/${id}/activate`,
        confirmTitle: "Activate key",
        confirmDescription: "Activating this key makes it the active signing key and moves the current active key to verifying.",
        variant: "primary"
      },
      {
        label: "Retire key",
        endpoint: (id) => `keys/${id}/retire`,
        confirmTitle: "Retire key",
        confirmDescription: "Retiring this key stops future signing with this material.",
        variant: "danger"
      }
    ]
  }
};

export const resourceOrder: ResourceKey[] = [
  "applications",
  "agents",
  "runtimes",
  "target-resources",
  "target-connections",
  "access-grants",
  "audit-events",
  "keys"
];

const identityTranslator: I18nTranslator = (_key, params, fallback) =>
  Object.entries(params ?? {}).reduce(
    (value, [name, replacement]) => value.replaceAll(`{${name}}`, String(replacement)),
    fallback ?? _key,
  );

const resourceTextKeys: Record<string, string> = {
  "Access Grants": "resource.accessGrants.title",
  "Access grants": "admin.copy.grants",
  "Activate key": "admin.copy.activateKey",
  "Activated": "admin.copy.activated",
  "Activating this key makes it the active signing key and moves the current active key to verifying.": "admin.copy.activateKeyDescription",
  "Actor Context": "admin.copy.actorContext",
  "Advanced constraints": "admin.copy.advancedConstraints",
  "Agent ID": "field.agent_id",
  "Agent Management": "resource.agents.title",
  "Agent name": "admin.copy.agentName",
  "Algorithm": "admin.copy.algorithm",
  "Allow": "admin.option.decision.allow",
  "Allow refresh for this runtime": "admin.copy.allowRefreshForRuntime",
  "Allow remote cache reuse": "admin.copy.allowRemoteCacheReuse",
  "Allowed context providers": "admin.copy.allowedContextProviders",
  "Allowed grant types": "admin.copy.allowedGrantTypes",
  "Allowed scopes": "admin.copy.allowedScopes",
  "App ID": "admin.copy.appId",
  "Application ID": "admin.copy.applicationId",
  "Application Management": "resource.oauthClients.title",
  "Application name": "admin.copy.applicationName",
  "Audience": "field.audience",
  "Audit Events": "resource.auditEvents.title",
  "Choose which existing connection should be allowed to receive target-access tokens.": "admin.copy.chooseConnectionForGrant",
  "Choose the agent's `agentId`. Data comes from Agent Management.": "admin.copy.agentIdChooseDescription",
  "Choose the application's `clientId`. Data comes from Application Management.": "admin.copy.applicationIdChooseDescription",
  "Choose the runtime's `runtimeId`. Data comes from Runtime Management.": "admin.copy.runtimeIdChooseDescription",
  "Choose the target resource that may be accessed. Data comes from Target Resources.": "admin.copy.chooseTargetResource",
  "Choose whether this connection belongs to an application, an agent, or one specific runtime.": "admin.copy.choosePrincipalType",
  "Choose a runtime explicitly": "admin.copy.chooseRuntimeExplicitly",
  "Client ID": "admin.copy.clientId",
  "Code": "admin.copy.code",
  "Connection": "admin.copy.connection",
  "Connection Context": "admin.copy.connectionContext",
  "Connection ID": "field.connection_id",
  "Connection Identity": "admin.copy.connectionIdentity",
  "Connections": "admin.copy.connections",
  "Constraints": "field.constraints",
  "Context mode": "admin.copy.contextMode",
  "Created": "admin.copy.created",
  "Credential delivery": "admin.copy.credentialDelivery",
  "Credentials": "admin.copy.credentials",
  "Decision": "admin.copy.decision",
  "Define which application, agent, or runtime may connect to which target resource under explicit platform rules.": "resource.targetConnections.description",
  "Delegation refresh": "admin.copy.delegationRefresh",
  "Delete access grant": "admin.copy.deleteAccessGrant",
  "Delete agent": "admin.copy.deleteAgent",
  "Delete application": "admin.copy.deleteApplication",
  "Delete runtime": "admin.copy.deleteRuntime",
  "Delete target connection": "admin.copy.deleteTargetConnection",
  "Delete target resource": "admin.copy.deleteTargetResource",
  "Deleting a runtime removes it from active registration and breaks future runtime-bound access.": "admin.copy.runtimeDeleteDescription",
  "Deleting a target resource will orphan related target connections and downstream grants.": "admin.copy.resourceDeleteDescription",
  "Deleting an agent revokes active caller credentials and removes the execution identity.": "admin.copy.agentDeleteDescription",
  "Deleting an application revokes active secrets and removes it from the control plane.": "admin.copy.applicationDeleteDescription",
  "Deleting this connection blocks future target token issuance for the selected principal.": "admin.copy.connectionDeleteDescription",
  "Deleting this grant removes the platform-level allow decision for future exchanges.": "admin.copy.accessGrantDeleteDescription",
  "Description": "admin.copy.description",
  "Display name": "field.display_name",
  "Downstream Relations": "admin.copy.downstreamRelations",
  "Effect": "field.effect",
  "Encryption key ID": "admin.copy.encryptionKeyId",
  "Error code": "admin.copy.errorCode",
  "Event Summary": "admin.copy.eventSummary",
  "Event type": "admin.copy.eventType",
  "Expected audience for target tokens": "admin.copy.audienceHelp",
  "Expires": "admin.copy.expires",
  "Expires at": "field.expires_at",
  "Explicitly submit the allow decision so creation never depends on a backend default allow.": "admin.copy.decisionExplicitDescription",
  "Explicitly submit the system grant type so creation never depends on a backend default.": "admin.copy.grantTypeDescription",
  "External context mode": "field.external_context_mode",
  "Failure": "admin.copy.failure",
  "Grant ID": "admin.copy.grantId",
  "Grant Identity": "admin.copy.grantIdentity",
  "Grant type": "field.grant_type",
  "Grants": "admin.copy.grants",
  "Identity": "admin.copy.identity",
  "Inspect governance, authentication, secret handling, and target exchange activity in a unified read-only view.": "resource.auditEvents.description",
  "Internal product or client name": "admin.copy.internalProductName",
  "Keep an explicit TTL on the connection so reviewers do not have to infer a backend fallback.": "admin.copy.explicitConnectionTtl",
  "Keep this explicit so connection policy is obvious during review.": "admin.copy.keepConnectionPolicyExplicit",
  "Keep this explicit so the UI does not imply a safe trust posture from fallback metadata.": "admin.copy.noFallbackTrust",
  "Key ID": "field.kid",
  "Key Identity": "admin.copy.keyIdentity",
  "Leave empty to auto-generate": "admin.copy.leaveEmptyToAutogenerate",
  "Lifecycle": "admin.copy.lifecycle",
  "Manage execution identities, caller credentials, runtimes, and downstream target access.": "resource.agents.description",
  "Manage OAuth applications, redirect configuration, lifecycle, and App Secrets from one unified control surface.": "resource.oauthClients.description",
  "Manage signing key lifecycle with explicit activation and retirement, while keeping private material protected.": "resource.keys.description",
  "Max token TTL": "admin.copy.maxTokenTtl",
  "Max token TTL seconds": "field.max_token_ttl_seconds",
  "Metadata": "admin.copy.metadata",
  "Mode": "admin.copy.mode",
  "Name": "field.name",
  "No access grants yet. Create one after the target connection is ready so AuthAny can issue target-access tokens.": "admin.copy.accessGrantEmptyState",
  "No agents yet. Create an execution identity before issuing credentials or runtimes.": "admin.copy.agentEmptyState",
  "No applications yet. Create the first application to start wiring OAuth clients.": "admin.copy.applicationEmptyState",
  "No audit events found for the current tenant and filter selection.": "admin.copy.auditEventsEmptyState",
  "No runtimes yet. Add a runtime after creating the owning agent.": "admin.copy.runtimeEmptyState",
  "No signing keys yet. Create a key before activating a new signing chain.": "admin.copy.keyEmptyState",
  "No target connections yet. Create a connection after registering an access client and target resource.": "admin.copy.connectionEmptyState",
  "No target resources yet. Register a downstream resource before creating target connections.": "admin.copy.resourceEmptyState",
  "OAuth Setup": "admin.copy.oauthSetup",
  "Occurred": "admin.copy.occurred",
  "One redirect URI per line": "admin.copy.oneRedirectUriPerLine",
  "Open or suspend platform-level target access for a target connection. This does not model downstream business scopes inside the target resource.": "resource.accessGrants.description",
  "Operator": "admin.copy.operator",
  "Operator ID": "admin.copy.operatorId",
  "Owner and Relations": "admin.copy.ownerAndRelations",
  "Owning agent": "admin.copy.owningAgent",
  "Payload": "admin.copy.payload",
  "Policy": "admin.copy.policy",
  "Principal": "admin.copy.principal",
  "Principal ID": "field.principal_id",
  "Principal type": "field.principal_type",
  "Private key stored securely": "admin.copy.privateKeyStoredSecurely",
  "Provide explicit constraint JSON. If there are no extra constraints yet, submit an empty object `{}` on purpose.": "admin.copy.accessGrantConstraintsDescription",
  "Provide explicit target resource trust configuration. Only JSON objects are allowed.": "admin.copy.trustConfigDescription",
  "Public key (PEM)": "admin.copy.publicKeyPem",
  "Redirect URIs": "admin.copy.redirectUris",
  "Refresh": "admin.copy.delegationRefresh",
  "Register downstream target resources, trust metadata, and token validation policy without mixing in business-user bindings.": "resource.targetResources.description",
  "Register runtime execution environments with explicit refresh, cache, and credential policies.": "resource.runtimes.description",
  "Relations": "admin.copy.relations",
  "Remote cache": "admin.copy.remoteCache",
  "Remote cache reuse": "admin.copy.remoteCacheReuse",
  "Request ID": "admin.copy.requestId",
  "Required in the admin UI. Moving a grant back to indefinite should require an explicit backend decision.": "admin.copy.requiredInAdminUi",
  "Required when external context is optional or required. One provider per line.": "admin.copy.allowedContextProvidersDescription",
  "Required. Explicitly decide whether external context is forbidden, optional, or required.": "admin.copy.externalContextDescription",
  "Required. Make the validation strategy explicit instead of relying on server defaults.": "admin.copy.tokenValidationDescription",
  "Required. Set an explicit connection-level TTL instead of inheriting the system fallback.": "admin.copy.explicitConnectionTtlRequired",
  "Required. The admin UI does not create indefinite allow grants.": "admin.copy.requiredGrantExpiry",
  "Result": "admin.copy.result",
  "Retire key": "admin.copy.retireKey",
  "Retired": "admin.copy.retired",
  "Retiring this key stops future signing with this material.": "admin.copy.retireKeyDescription",
  "Runtime ID": "field.runtime_id",
  "Runtime Identity": "admin.copy.runtimeIdentity",
  "Runtime Registrations": "resource.runtimes.title",
  "Runtime mode": "field.runtime_mode",
  "Runtime type": "field.runtime_type",
  "Runtimes": "admin.copy.runtimes",
  "Secrets": "admin.copy.secrets",
  "Short purpose and ownership context": "admin.copy.shortPurpose",
  "Signing Keys": "resource.keys.title",
  "Stateful": "admin.option.runtime.stateful",
  "Stateless": "admin.option.runtime.stateless",
  "Status": "field.status",
  "Stored Material": "admin.copy.storedMaterial",
  "Success": "admin.copy.success",
  "Target Connections": "resource.targetConnections.title",
  "Target Context": "admin.copy.targetContext",
  "Target Resources": "resource.targetResources.title",
  "Target access": "admin.option.grant.targetAccess",
  "Target connection": "admin.copy.targetConnection",
  "Target connections": "admin.copy.inspectionTargetConnections",
  "Target display name": "admin.copy.targetDisplayName",
  "Target resource": "field.target_resource",
  "Target resource code": "field.target_resource_code",
  "Token validation mode": "admin.copy.validationMode",
  "Trust Setup": "admin.copy.trustSetup",
  "Trust config": "admin.copy.trustConfig",
  "Trust metadata": "admin.copy.trustMetadata",
  "Type": "admin.copy.type",
  "Type the agent name to confirm deletion": "admin.copy.typeAgentNameToDelete",
  "Type the application name to confirm deletion": "admin.copy.typeApplicationNameToDelete",
  "Updated": "admin.copy.updated",
  "Use status to turn the allow decision on or off without deleting the connection itself.": "admin.copy.selectStatusForGrant",
  "Validation": "admin.copy.validation",
  "View details": "admin.copy.detailView",
  "When external context is forbidden, this field does not need a value.": "admin.copy.whenExternalContextForbidden",
  "worker, browser, orchestrator...": "admin.copy.runtimeTypePlaceholder",
  "Maintain explicit trust configuration for this target resource.": "admin.copy.trustConfigMaintainDescription",
  "Maintain explicit constraint JSON for this grant.": "admin.copy.accessGrantMaintainConstraints",
  "Optional but strongly recommended. Leaving this empty lets every runtime owned by the agent match this connection.": "admin.copy.whyRuntimeBindingRecommended",
};

function translateText(t: I18nTranslator, fallback: string | undefined) {
  if (!fallback) {
    return fallback;
  }
  const key = resourceTextKeys[fallback];
  return key ? t(key, undefined, fallback) : fallback;
}

function localizeOption(option: SelectOption, t: I18nTranslator): SelectOption {
  return {
    ...option,
    label: translateText(t, option.label) ?? option.label,
  };
}

function localizeValueDefinition<T extends { label: string }>(
  definition: T,
  t: I18nTranslator,
): T {
  return {
    ...definition,
    label: translateText(t, definition.label) ?? definition.label,
  };
}

function localizeAction(action: NonNullable<ResourceDefinition["dangerAction"]>, t: I18nTranslator) {
  return {
    ...action,
    label: translateText(t, action.label) ?? action.label,
    confirmDescription: translateText(t, action.confirmDescription),
    confirmLabel: translateText(t, action.confirmLabel),
    confirmTitle: translateText(t, action.confirmTitle),
  };
}

function localizeFieldValidation(field: NonNullable<ResourceDefinition["createFields"]>[number], t: I18nTranslator) {
  if (field.validate === grantExpiryValidation) {
    return (value: boolean | string | undefined, values: Record<string, string | boolean>) =>
      grantExpiryValidation(value, values, t);
  }
  if (field.validate === contextProviderValidation) {
    return (value: boolean | string | undefined, values: Record<string, string | boolean>) =>
      contextProviderValidation(value, values, t);
  }
  return field.validate;
}

function localizeField(field: NonNullable<ResourceDefinition["createFields"]>[number], t: I18nTranslator) {
  return {
    ...field,
    label: translateText(t, field.label) ?? field.label,
    description: translateText(t, field.description),
    placeholder: translateText(t, field.placeholder),
    options: field.options?.map((option) => localizeOption(option, t)),
    validate: localizeFieldValidation(field, t),
  };
}

function localizeDefinition(definition: ResourceDefinition, t: I18nTranslator): ResourceDefinition {
  return {
    ...definition,
    title: translateText(t, definition.title) ?? definition.title,
    description: translateText(t, definition.description) ?? definition.description,
    emptyState: translateText(t, definition.emptyState) ?? definition.emptyState,
    createLabel: translateText(t, definition.createLabel),
    listColumns: definition.listColumns.map((column) => ({
      ...column,
      label: translateText(t, column.label) ?? column.label,
    })),
    filters: definition.filters?.map((filter) => ({
      ...filter,
      label: translateText(t, filter.label) ?? filter.label,
      options: filter.options?.map((option) => localizeOption(option, t)),
    })),
    createFields: definition.createFields?.map((field) => localizeField(field, t)),
    editFields: definition.editFields?.map((field) => localizeField(field, t)),
    detailSections: definition.detailSections.map((section) => ({
      ...section,
      title: translateText(t, section.title) ?? section.title,
      description: translateText(t, section.description),
      fields: section.fields.map((field) => localizeValueDefinition(field, t)),
    })),
    detailActions: definition.detailActions?.map((action) => localizeAction(action, t)),
    dangerAction: definition.dangerAction ? localizeAction(definition.dangerAction, t) : undefined,
  };
}

function localizeTitleValue(key: ResourceKey, t: I18nTranslator, record: Record<string, unknown>) {
  switch (key) {
    case "applications":
      return String(record.name ?? t("admin.copy.unnamedApplication", undefined, "Unnamed application"));
    case "agents":
      return String(record.name ?? t("admin.copy.unnamedAgent", undefined, "Unnamed agent"));
    case "runtimes":
      return String(record.runtimeId ?? t("admin.copy.unnamedRuntime", undefined, "Unnamed runtime"));
    case "target-resources":
      return String(record.displayName ?? t("admin.copy.unnamedTarget", undefined, "Unnamed target"));
    case "target-connections":
      return String(record.connectionId ?? t("admin.copy.unnamedConnection", undefined, "Unnamed connection"));
    case "access-grants":
      return String(record.grantId ?? t("admin.copy.unnamedGrant", undefined, "Unnamed grant"));
    case "audit-events":
      return String(record.eventType ?? t("admin.copy.auditEvent", undefined, "Audit event"));
    case "keys":
      return String(record.kid ?? t("admin.copy.unnamedKey", undefined, "Unnamed key"));
    default:
      return "";
  }
}

export function getResourceDefinition(key: ResourceKey, t: I18nTranslator) {
  const definition = localizeDefinition(resourceDefinitions[key], t);

  const localizedDefinition: ResourceDefinition = {
    ...definition,
    titleValue: (record) => localizeTitleValue(key, t, record),
  };

  if (key === "target-resources") {
    return {
      ...localizedDefinition,
      detailSections: localizedDefinition.detailSections.map((section, sectionIndex) => {
        if (sectionIndex !== 1) {
          return section;
        }
        return {
          ...section,
          fields: section.fields.map((field, fieldIndex) => {
            if (fieldIndex === 0) {
              return {
                ...field,
                getValue: (record: Record<string, unknown>) =>
                  recordString(record, "tokenValidationMode")
                    || t("admin.trust.notConfigured", undefined, "Not explicitly configured"),
              };
            }
            if (fieldIndex === 1) {
              return {
                ...field,
                getValue: (record: Record<string, unknown>) => trustMetadataDisplay(record, t),
              };
            }
            return field;
          }),
        };
      }),
    };
  }

  return localizedDefinition;
}
