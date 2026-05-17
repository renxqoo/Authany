import { Module } from "@nestjs/common";
import { OidcController } from "./oidc.controller";
import { OidcService } from "./oidc.service";
import { PkceService } from "./pkce.service";

@Module({
  controllers: [OidcController],
  providers: [OidcService, PkceService],
  exports: [OidcService]
})
export class OidcModule {}
