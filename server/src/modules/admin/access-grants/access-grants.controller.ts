import { Body, Controller, Get, Param, Patch, Post, UseGuards } from "@nestjs/common";
import { AdminAuthGuard } from "../../../shared/admin/admin-auth.guard";
import { AccessGrantsService } from "./access-grants.service";
import { CreateAccessGrantDto, UpdateAccessGrantDto } from "./access-grants.dto";

@UseGuards(AdminAuthGuard)
@Controller("/api/v1/admin/access-grants")
export class AccessGrantsController {
  constructor(private readonly grants: AccessGrantsService) {}

  @Get()
  list() {
    return this.grants.list();
  }

  @Get("/:id")
  get(@Param("id") id: string) {
    return this.grants.get(id);
  }

  @Post()
  create(@Body() body: CreateAccessGrantDto) {
    return this.grants.create(body);
  }

  @Patch("/:id")
  update(
    @Param("id") id: string,
    @Body() body: UpdateAccessGrantDto,
  ) {
    return this.grants.update(id, body);
  }
}
