export interface CliEnv {
  injectedTargetAccessToken?: string;
  targetServiceUrl: string;
}

export type TargetServiceMode =
  | "injected_target_token"
  | "public";

export interface TargetServiceResult {
  mode: TargetServiceMode;
  response: Record<string, unknown>;
  status: number;
  targetServiceUrl: string;
}
