import { Type } from "class-transformer";
import { IsDateString, IsInt, IsOptional, IsString, Max, Min } from "class-validator";

export class ListAuditEventsDto {
  @IsOptional()
  @IsString()
  event_type?: string;

  @IsOptional()
  @IsString()
  operator_id?: string;

  @IsOptional()
  @IsString()
  agent_id?: string;

  @IsOptional()
  @IsString()
  target_resource?: string;

  @IsOptional()
  @IsDateString()
  from?: string;

  @IsOptional()
  @IsDateString()
  to?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(500)
  limit?: number;

  @IsOptional()
  @IsString()
  cursor?: string;
}
