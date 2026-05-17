import "reflect-metadata";
import { ValidationPipe } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { FastifyAdapter, NestFastifyApplication } from "@nestjs/platform-fastify";
import cookie from "@fastify/cookie";
import helmet from "@fastify/helmet";
import { AppModule } from "./app.module";
import { AppConfigService } from "./shared/config/app-config.service";
import { HttpExceptionFilter } from "./shared/http/http-exception.filter";
import { createCorsOptions, createHelmetOptions } from "./shared/http/security-headers";

async function bootstrap() {
  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    new FastifyAdapter({ trustProxy: false }),
  );

  const config = app.get(AppConfigService);

  await app.register(cookie, { secret: config.cookieSecret });
  await app.register(helmet, createHelmetOptions(config));
  app.enableCors(createCorsOptions(config));

  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
      forbidUnknownValues: true,
      forbidNonWhitelisted: true
    }),
  );
  app.useGlobalFilters(new HttpExceptionFilter());

  await app.listen(config.port, "0.0.0.0");
}

bootstrap().catch((error: unknown) => {
  console.error("AuthAny failed to start", error);
  process.exit(1);
});
