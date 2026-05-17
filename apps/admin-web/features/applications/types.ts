export interface ApplicationSummary {
  app_id: string;
  created_at: string;
  description?: string | null;
  id: string;
  is_protected?: boolean;
  name: string;
  redirect_uri_count: number;
  redirect_uris: string[];
  secret_count: number;
  status: string;
  updated_at: string;
}

export interface ApplicationSecret {
  created_at: string;
  hint: string;
  id: string;
  last_used_at?: string | null;
  revealable: boolean;
  status: string;
  viewed_at?: string | null;
}

export interface ApplicationDetail extends ApplicationSummary {
  allowed_grant_types: string[];
  allowed_scopes: string[];
  app_secret?: string;
  secrets: ApplicationSecret[];
}
