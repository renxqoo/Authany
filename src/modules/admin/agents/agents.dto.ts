import { IsOptional, IsString } from "class-validator";

export class CreateAgentDto {
  @IsOptional()
  @IsString()
  agent_id?: string;

  @IsString()
  name!: string;

  @IsOptional()
  @IsString()
  description?: string;
}

export class UpdateAgentDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  status?: string;

  @IsOptional()
  @IsString()
  description?: string;
}

export class DeleteAgentDto {
  @IsOptional()
  @IsString()
  confirm_name?: string;
}
