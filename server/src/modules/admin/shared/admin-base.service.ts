import { PrismaService } from "../../../shared/prisma/prisma.service";
import { AppConfigService } from "../../../shared/config/app-config.service";

export abstract class AdminBaseService {
  constructor(
    protected readonly prisma: PrismaService,
    protected readonly config: AppConfigService,
  ) {}
}
