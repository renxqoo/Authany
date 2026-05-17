import { IsObject, IsOptional, IsString } from "class-validator";

export class CreateTargetResourceDto {
  @IsString()
  target_resource_code!: string;

  @IsString()
  display_name!: string;

  @IsString()
  audience!: string;

  @IsString()
  token_validation_mode!: string;

  @IsObject()
  trust_config_json!: Record<string, unknown>;
}

export class UpdateTargetResourceDto {
  @IsOptional()
  @IsString()
  display_name?: string;

  @IsOptional()
  @IsString()
  status?: string;

  @IsOptional()
  @IsString()
  audience?: string;

  @IsOptional()
  @IsString()
  token_validation_mode?: string;

  @IsOptional()
  @IsObject()
  trust_config_json?: Record<string, unknown>;
}
