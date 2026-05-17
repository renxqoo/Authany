import { Body, Controller, Post, Req } from "@nestjs/common";
import type { FastifyRequest } from "fastify";
import { DelegationService } from "./delegation.service";
import { DelegationTokenDto } from "./dto/delegation-token.dto";
import { RequesterTokenDto } from "./dto/requester-token.dto";

@Controller("/api")
export class DelegationController {
  constructor(private readonly delegation: DelegationService) {}

  @Post("/target-token")
  async token(@Body() body: DelegationTokenDto, @Req() request: FastifyRequest) {
    return this.delegation.exchange(request, {
      grantType: body.grant_type,
      targetResource: body.target_resource
    });
  }

  @Post("/requester-token")
  async requesterToken(@Body() body: RequesterTokenDto, @Req() request: FastifyRequest) {
    return this.delegation.issueRequesterToken(request, {
      grantType: body.grant_type,
      principalType: body.principal_type,
      agentId: body.agent_id,
      appId: body.app_id,
      runtimeId: body.runtime_id,
      targetResource: body.target_resource,
      externalContext: body.external_context
    });
  }
}
