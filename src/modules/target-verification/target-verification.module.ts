import { Module } from "@nestjs/common";
import { TargetTokenVerifierService } from "./target-token-verifier.service";

@Module({
  providers: [TargetTokenVerifierService],
  exports: [TargetTokenVerifierService]
})
export class TargetVerificationModule {}
