import { Controller, Get, UseGuards } from "@nestjs/common";
import { AdminAuthGuard } from "../admin/admin-auth.guard";
import { MetricsService } from "./metrics.service";

@UseGuards(AdminAuthGuard)
@Controller("/api/v1/admin/metrics")
export class MetricsController {
  constructor(private readonly metrics: MetricsService) {}

  @Get()
  getMetrics() {
    return this.metrics.snapshot();
  }
}
