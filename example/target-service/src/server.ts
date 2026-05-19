import { buildApp } from "./app.js";
import { getTargetServiceEnv } from "./env.js";
import { createPool, closePool } from "./db.js";

const env = getTargetServiceEnv();
createPool(env);
const app = buildApp(env);

app.addHook("onClose", async () => {
  await closePool();
});

await app.listen({ port: env.port, host: "0.0.0.0" });

console.log(`Target demo service listening on http://127.0.0.1:${env.port}`);
