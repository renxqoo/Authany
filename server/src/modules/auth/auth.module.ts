import { Module } from "@nestjs/common";
import { AuthController } from "./auth.controller";
import { AuthService } from "./auth.service";
import { HostedAuthController } from "./hosted-auth.controller";

@Module({
  controllers: [AuthController, HostedAuthController],
  providers: [AuthService],
  exports: [AuthService]
})
export class AuthModule {}
