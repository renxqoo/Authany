import { Global, Module } from "@nestjs/common";
import { TokenSignerService } from "./token-signer.service";
import { HashService } from "./hash.service";
import { LoginSessionService } from "./login-session.service";
import { CurrentOperatorService } from "./current-user.service";
import { SecretEncryptionService } from "./secret-encryption.service";
import { TokenStatusService } from "./token-status.service";
import { ClientIpService } from "./client-ip.service";
import { CsrfService } from "./csrf.service";

@Global()
@Module({
  providers: [
    TokenSignerService,
    HashService,
    LoginSessionService,
    CurrentOperatorService,
    SecretEncryptionService,
    TokenStatusService,
    ClientIpService,
    CsrfService
  ],
  exports: [
    TokenSignerService,
    HashService,
    LoginSessionService,
    CurrentOperatorService,
    SecretEncryptionService,
    TokenStatusService,
    ClientIpService,
    CsrfService
  ]
})
export class SecurityModule {}
