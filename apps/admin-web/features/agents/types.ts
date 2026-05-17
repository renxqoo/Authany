export interface AgentSummary {
  agent_id: string;
  created_at: string;
  credential_count: number;
  description?: string | null;
  grant_count: number;
  id: string;
  name: string;
  runtime_count: number;
  status: string;
  updated_at: string;
}

export interface AgentCredential {
  credential_hint: string;
  credential_type: string;
  expires_at?: string | null;
  id: string;
  issued_at: string;
  last_used_at?: string | null;
  revoked_at?: string | null;
  runtime_registration_id?: string | null;
  status: string;
}

export interface AgentRuntime {
  allows_delegation_refresh: boolean;
  allows_remote_cache_reuse: boolean;
  credential_delivery_mode: string;
  id: string;
  runtime_id: string;
  runtime_mode: string;
  runtime_type: string;
  status: string;
  target_connections: AgentTargetConnection[];
}

export interface AgentTargetConnection {
  connection_id: string;
  grant_count: number;
  id: string;
  status: string;
  target_resource: string;
}

export interface AgentDetail extends AgentSummary {
  credentials: AgentCredential[];
  runtimes: AgentRuntime[];
}
