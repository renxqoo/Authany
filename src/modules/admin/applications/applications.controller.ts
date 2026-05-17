import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from "@nestjs/common";
import { AdminAuthGuard } from "../../../shared/admin/admin-auth.guard";
import { ApplicationsService } from "./applications.service";
import { CreateApplicationDto, DeleteApplicationDto, UpdateApplicationDto } from "./applications.dto";

@UseGuards(AdminAuthGuard)
@Controller("/api/v1/admin/applications")
export class ApplicationsController {
  constructor(private readonly applications: ApplicationsService) {}

  @Get()
  list(@Query("q") q?: string, @Query("status") status?: string) {
    return this.applications.list({ q, status });
  }

  @Post()
  create(@Body() body: CreateApplicationDto) {
    return this.applications.create(body);
  }

  @Get("/:id")
  get(@Param("id") id: string) {
    return this.applications.get(id);
  }

  @Patch("/:id")
  update(
    @Param("id") id: string,
    @Body() body: UpdateApplicationDto,
  ) {
    return this.applications.update(id, body);
  }

  @Post("/:id/delete")
  delete(@Param("id") id: string, @Body() body: DeleteApplicationDto) {
    return this.applications.delete(id, body);
  }

  @Post("/:id/secrets/:secretId/reveal")
  revealSecret(@Param("id") id: string, @Param("secretId") secretId: string) {
    return this.applications.revealSecret(id, secretId);
  }

  @Post("/:id/secrets/rotate")
  rotateSecret(@Param("id") id: string) {
    return this.applications.rotateSecret(id);
  }
}
