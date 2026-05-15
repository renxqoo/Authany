import { Global, Module } from "@nestjs/common";
import { TokenSignerService } from "./token-signer.service";
import { HashService } from "./hash.service";
import { LoginSessionService } from "./login-session.service";

@Global()
@Module({
  providers: [TokenSignerService, HashService, LoginSessionService],
  exports: [TokenSignerService, HashService, LoginSessionService]
})
export class SecurityModule {}
