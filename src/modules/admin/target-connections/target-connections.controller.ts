import { Body, Controller, Get, Param, Patch, Post, UseGuards } from "@nestjs/common";
import { AdminAuthGuard } from "../../../shared/admin/admin-auth.guard";
import { TargetConnectionsService } from "./target-connections.service";
import { CreateTargetConnectionDto, UpdateTargetConnectionDto } from "./target-connections.dto";

@UseGuards(AdminAuthGuard)
@Controller("/api/v1/admin/target-connections")
export class TargetConnectionsController {
  constructor(private readonly connections: TargetConnectionsService) {}

  @Get()
  list() {
    return this.connections.list();
  }

  @Get("/:id")
  get(@Param("id") id: string) {
    return this.connections.get(id);
  }

  @Post()
  create(@Body() body: CreateTargetConnectionDto) {
    return this.connections.create(body);
  }

  @Patch("/:id")
  update(
    @Param("id") id: string,
    @Body() body: UpdateTargetConnectionDto,
  ) {
    return this.connections.update(id, body);
  }
}
