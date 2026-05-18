import { Module } from "@nestjs/common";
import { DelegationController } from "./delegation.controller";
import { DelegationService } from "./delegation.service";
import { CallerCredentialService } from "./caller-credential.service";
import { ReplayProtectionService } from "./replay-protection.service";
import { TargetTokenBrokerService } from "./delegation-token-broker.service";
import { DelegationPolicyService } from "./delegation-policy.service";
import { RequesterTokenService } from "./requester-token.service";
import { TargetTokenExchangeService } from "./target-token-exchange.service";

@Module({
  controllers: [DelegationController],
  providers: [
    DelegationService,
    CallerCredentialService,
    DelegationPolicyService,
    ReplayProtectionService,
    RequesterTokenService,
    TargetTokenBrokerService,
    TargetTokenExchangeService
  ],
  exports: [DelegationService]
})
export class DelegationModule {}
