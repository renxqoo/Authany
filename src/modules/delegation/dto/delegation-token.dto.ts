import { IsString } from "class-validator";

export class DelegationTokenDto {
  @IsString()
  grant_type!: string;

  @IsString()
  target_resource!: string;
}
