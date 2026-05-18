import { IsOptional, IsString } from "class-validator";

export class RevokeDto {
  @IsString()
  token!: string;

  @IsOptional()
  @IsString()
  token_type_hint?: string;

  @IsString()
  client_id!: string;

  @IsOptional()
  @IsString()
  client_secret?: string;
}
