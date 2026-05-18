import { IsArray, IsInt, IsOptional, IsString, Max, Min } from "class-validator";

export class CreateTargetConnectionDto {
  @IsOptional()
  @IsString()
  connection_id?: string;

  @IsString()
  principal_type!: string;

  @IsString()
  principal_id!: string;

  @IsOptional()
  @IsString()
  runtime_id?: string;

  @IsString()
  target_resource!: string;

  @IsString()
  external_context_mode!: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  allowed_context_providers?: string[];

  @IsInt()
  @Min(60)
  @Max(10800)
  max_token_ttl_seconds!: number;
}

export class UpdateTargetConnectionDto {
  @IsOptional()
  @IsString()
  status?: string;

  @IsOptional()
  @IsString()
  external_context_mode?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  allowed_context_providers?: string[];

  @IsOptional()
  @IsInt()
  @Min(60)
  @Max(10800)
  max_token_ttl_seconds?: number;

  @IsOptional()
  @IsString()
  expires_at?: string | null;
}
