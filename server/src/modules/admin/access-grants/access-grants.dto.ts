import { IsObject, IsOptional, IsString } from "class-validator";

export class CreateAccessGrantDto {
  @IsOptional()
  @IsString()
  grant_id?: string;

  @IsString()
  connection_id!: string;

  @IsString()
  grant_type!: string;

  @IsString()
  effect!: string;

  @IsObject()
  constraints!: Record<string, unknown>;

  @IsString()
  expires_at!: string;
}

export class UpdateAccessGrantDto {
  @IsOptional()
  @IsString()
  status?: string;

  @IsOptional()
  @IsString()
  effect?: string;

  @IsOptional()
  @IsObject()
  constraints?: Record<string, unknown>;

  @IsOptional()
  @IsString()
  expires_at?: string;
}
