import { Body, Controller, Get, Param, Patch, Post, UseGuards } from "@nestjs/common";
import { AdminAuthGuard } from "../../../shared/admin/admin-auth.guard";
import { TargetResourcesService } from "./target-resources.service";
import { CreateTargetResourceDto, UpdateTargetResourceDto } from "./target-resources.dto";

@UseGuards(AdminAuthGuard)
@Controller("/api/v1/admin/target-resources")
export class TargetResourcesController {
  constructor(private readonly targets: TargetResourcesService) {}

  @Get()
  list() {
    return this.targets.list();
  }

  @Get("/:id")
  get(@Param("id") id: string) {
    return this.targets.get(id);
  }

  @Post()
  create(@Body() body: CreateTargetResourceDto) {
    return this.targets.create(body);
  }

  @Patch("/:id")
  update(@Param("id") id: string, @Body() body: UpdateTargetResourceDto) {
    return this.targets.update(id, body);
  }
}
