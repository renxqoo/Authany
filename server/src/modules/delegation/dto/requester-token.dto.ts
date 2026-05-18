import { IsIn, IsObject, IsOptional, IsString } from "class-validator";

export class RequesterTokenDto {
  @IsString()
  grant_type!: string;

  @IsIn(["agent", "application"])
  principal_type!: "agent" | "application";

  @IsOptional()
  @IsString()
  agent_id?: string;

  @IsOptional()
  @IsString()
  app_id?: string;

  @IsOptional()
  @IsString()
  runtime_id?: string;

  @IsString()
  target_resource!: string;

  @IsOptional()
  @IsObject()
  external_context?: Record<string, unknown>;
}
