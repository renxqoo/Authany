import { Module } from "@nestjs/common";
import { ApplicationsController } from "./applications/applications.controller";
import { ApplicationsService } from "./applications/applications.service";
import { AgentsController } from "./agents/agents.controller";
import { AgentsService } from "./agents/agents.service";
import { TargetResourcesController } from "./target-resources/target-resources.controller";
import { TargetResourcesService } from "./target-resources/target-resources.service";
import { AuditEventsController } from "./audit-events/audit-events.controller";
import { RuntimesController } from "./runtimes/runtimes.controller";
import { RuntimesService } from "./runtimes/runtimes.service";
import { CallerCredentialsController } from "./caller-credentials/caller-credentials.controller";
import { CallerCredentialsService } from "./caller-credentials/caller-credentials.service";
import { TargetConnectionsController } from "./target-connections/target-connections.controller";
import { TargetConnectionsService } from "./target-connections/target-connections.service";
import { AccessGrantsController } from "./access-grants/access-grants.controller";
import { AccessGrantsService } from "./access-grants/access-grants.service";
import { KeysController } from "./keys/keys.controller";
import { KeysService } from "./keys/keys.service";

@Module({
  controllers: [
    ApplicationsController,
    AgentsController,
    TargetResourcesController,
    RuntimesController,
    CallerCredentialsController,
    TargetConnectionsController,
    AccessGrantsController,
    KeysController,
    AuditEventsController
  ],
  providers: [
    ApplicationsService,
    AgentsService,
    TargetResourcesService,
    RuntimesService,
    CallerCredentialsService,
    TargetConnectionsService,
    AccessGrantsService,
    KeysService
  ]
})
export class AdminApiModule {}
