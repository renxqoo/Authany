import { IsOptional, IsString } from "class-validator";

export class CreateCallerCredentialDto {
  @IsOptional()
  @IsString()
  runtime_id?: string;
}
