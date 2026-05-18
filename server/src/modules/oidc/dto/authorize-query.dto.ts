import { IsOptional, IsString } from "class-validator";

export class AuthorizeQueryDto {
  @IsString()
  response_type!: string;

  @IsString()
  client_id!: string;

  @IsString()
  redirect_uri!: string;

  @IsString()
  scope!: string;

  @IsString()
  state!: string;

  @IsString()
  code_challenge!: string;

  @IsString()
  code_challenge_method!: string;

  @IsOptional()
  @IsString()
  nonce?: string;

  @IsOptional()
  @IsString()
  prompt?: string;
}
