import { Injectable } from "@nestjs/common";
import type { FastifyRequest } from "fastify";
import { RequesterTokenService } from "./requester-token.service";
import { TargetTokenExchangeService } from "./target-token-exchange.service";

@Injectable()
export class DelegationService {
  constructor(
    private readonly requesterTokens: RequesterTokenService,
    private readonly targetTokens: TargetTokenExchangeService,
  ) {}

  exchange(
    request: FastifyRequest,
    input: {
      grantType: string;
      targetResource: string;
    },
  ) {
    return this.targetTokens.exchange(request, input);
  }

  issueRequesterToken(
    request: FastifyRequest,
    input: {
      grantType: string;
      principalType: "agent" | "application";
      agentId?: string;
      appId?: string;
      runtimeId?: string;
      targetResource: string;
      externalContext?: Record<string, unknown>;
    },
  ) {
    return this.requesterTokens.issue(request, input);
  }
}
