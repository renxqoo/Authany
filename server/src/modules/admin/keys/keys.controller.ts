import { Body, Controller, Get, Param, Post, UseGuards } from "@nestjs/common";
import { AdminAuthGuard } from "../../../shared/admin/admin-auth.guard";
import { KeysService } from "./keys.service";
import { CreateKeyDto } from "./keys.dto";

@UseGuards(AdminAuthGuard)
@Controller("/api/v1/admin/keys")
export class KeysController {
  constructor(private readonly keys: KeysService) {}

  @Get()
  list() {
    return this.keys.list();
  }

  @Get("/:id")
  get(@Param("id") id: string) {
    return this.keys.get(id);
  }

  @Post()
  create(@Body() body: CreateKeyDto) {
    return this.keys.create(body);
  }

  @Post("/:id/activate")
  activate(@Param("id") id: string) {
    return this.keys.activate(id);
  }

  @Post("/:id/retire")
  retire(@Param("id") id: string) {
    return this.keys.retire(id);
  }
}
