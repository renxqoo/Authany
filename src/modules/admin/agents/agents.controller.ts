import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from "@nestjs/common";
import { AdminAuthGuard } from "../../../shared/admin/admin-auth.guard";
import { AgentsService } from "./agents.service";
import { CreateAgentDto, DeleteAgentDto, UpdateAgentDto } from "./agents.dto";

@UseGuards(AdminAuthGuard)
@Controller("/api/v1/admin/agents")
export class AgentsController {
  constructor(private readonly agents: AgentsService) {}

  @Get()
  list(@Query("q") q?: string, @Query("status") status?: string) {
    return this.agents.list({ q, status });
  }

  @Post()
  create(@Body() body: CreateAgentDto) {
    return this.agents.create(body);
  }

  @Get("/:id")
  get(@Param("id") id: string) {
    return this.agents.get(id);
  }

  @Patch("/:id")
  update(
    @Param("id") id: string,
    @Body() body: UpdateAgentDto,
  ) {
    return this.agents.update(id, body);
  }

  @Post("/:id/delete")
  delete(@Param("id") id: string, @Body() body: DeleteAgentDto) {
    return this.agents.delete(id, body);
  }
}
