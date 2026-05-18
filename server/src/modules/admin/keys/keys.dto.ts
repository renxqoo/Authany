import { IsOptional, IsString } from "class-validator";

export class CreateKeyDto {
  @IsOptional()
  @IsString()
  kid?: string;

  @IsOptional()
  @IsString()
  algorithm?: string;
}
