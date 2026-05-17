import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from "@nestjs/common";
import { AdminAuthGuard } from "../../../shared/admin/admin-auth.guard";
import { RuntimesService } from "./runtimes.service";
import { CreateRuntimeDto, UpdateRuntimeDto } from "./runtimes.dto";

@UseGuards(AdminAuthGuard)
@Controller("/api/v1/admin/runtimes")
export class RuntimesController {
  constructor(private readonly runtimes: RuntimesService) {}

  @Get()
  list(@Query("agent_id") agentId?: string) {
    return this.runtimes.list({ agent_id: agentId });
  }

  @Get("/:id")
  get(@Param("id") id: string) {
    return this.runtimes.get(id);
  }

  @Post()
  create(@Body() body: CreateRuntimeDto) {
    return this.runtimes.create(body);
  }

  @Patch("/:id")
  update(@Param("id") id: string, @Body() body: UpdateRuntimeDto) {
    return this.runtimes.update(id, body);
  }
}
