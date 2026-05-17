import { buildApp } from "./app.js";
import { getTargetServiceEnv } from "./env.js";

const env = getTargetServiceEnv();
const app = buildApp(env);

await app.listen({ port: env.port, host: "0.0.0.0" });

console.log(`Target demo service listening on http://127.0.0.1:${env.port}`);
