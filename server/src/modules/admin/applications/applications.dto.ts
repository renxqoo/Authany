import { IsArray, IsOptional, IsString } from "class-validator";

export class CreateApplicationDto {
  @IsString()
  name!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsArray()
  @IsString({ each: true })
  redirect_uris!: string[];
}

export class UpdateApplicationDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  redirect_uris?: string[];

  @IsOptional()
  @IsString()
  status?: string;
}

export class DeleteApplicationDto {
  @IsOptional()
  @IsString()
  confirm_name?: string;
}
