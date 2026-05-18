import { Body, Controller, Get, Param, Post, UseGuards } from "@nestjs/common";
import { AdminAuthGuard } from "../../../shared/admin/admin-auth.guard";
import { CallerCredentialsService } from "./caller-credentials.service";
import { CreateCallerCredentialDto } from "./caller-credentials.dto";

@UseGuards(AdminAuthGuard)
@Controller("/api/v1/admin")
export class CallerCredentialsController {
  constructor(private readonly credentials: CallerCredentialsService) {}

  @Get("/agents/:id/credentials")
  listForAgent(@Param("id") id: string) {
    return this.credentials.listForAgent(id);
  }

  @Post("/agents/:id/credentials")
  createForAgent(@Param("id") id: string, @Body() body: CreateCallerCredentialDto) {
    return this.credentials.createForAgent(id, body);
  }

  @Post("/credentials/:id/revoke")
  revoke(@Param("id") id: string) {
    return this.credentials.revoke(id);
  }
}
