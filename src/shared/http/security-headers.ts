import helmet from "@fastify/helmet";
import type { AppConfigService } from "../config/app-config.service";

export function createHelmetOptions(config: Pick<AppConfigService, "cspFormActionOrigins">) {
  return {
    contentSecurityPolicy: {
      directives: {
        ...helmet.contentSecurityPolicy.getDefaultDirectives(),
        "form-action": ["'self'", ...config.cspFormActionOrigins]
      }
    }
  };
}

export function createCorsOptions(config: Pick<AppConfigService, "corsOrigins">) {
  return {
    credentials: true,
    async origin(origin?: string) {
      return !origin || config.corsOrigins.includes(origin);
    }
  };
}
