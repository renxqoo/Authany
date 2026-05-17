import { IsBoolean, IsOptional, IsString } from "class-validator";

export class CreateRuntimeDto {
  @IsString()
  agent_id!: string;

  @IsString()
  runtime_type!: string;

  @IsString()
  runtime_mode!: string;

  @IsOptional()
  @IsBoolean()
  allows_delegation_refresh?: boolean;

  @IsOptional()
  @IsBoolean()
  allows_remote_cache_reuse?: boolean;
}

export class UpdateRuntimeDto {
  @IsOptional()
  @IsString()
  status?: string;

  @IsOptional()
  @IsString()
  runtime_mode?: string;

  @IsOptional()
  @IsBoolean()
  allows_delegation_refresh?: boolean;

  @IsOptional()
  @IsBoolean()
  allows_remote_cache_reuse?: boolean;
}
