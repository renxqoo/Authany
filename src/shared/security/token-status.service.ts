import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";

@Injectable()
export class TokenStatusService {
  constructor(private readonly prisma: PrismaService) {}

  async isActiveAccessToken(input: { jti?: string; tokenType?: string }) {
    if (!input.jti) {
      return false;
    }
    const record = await this.prisma.oAuthAccessTokenRecord.findUnique({
      where: { jti: input.jti }
    });
    if (!record || record.expiresAt.getTime() <= Date.now()) {
      return false;
    }
    const revocation = await this.prisma.tokenRevocation.findFirst({
      where: {
        tokenJti: input.jti,
        tokenType: input.tokenType ?? record.tokenType
      }
    });
    return !revocation;
  }
}
