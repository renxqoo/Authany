import pg from "pg";
import type { TargetServiceEnv } from "./env.js";

let pool: pg.Pool | null = null;

export function createPool(env: TargetServiceEnv): pg.Pool {
  if (pool) return pool;
  pool = new pg.Pool({
    host: env.dbHost,
    port: env.dbPort,
    database: env.dbName,
    user: env.dbUser,
    password: env.dbPassword,
    max: 10,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 5_000,
  });
  return pool;
}

export function getPool(): pg.Pool {
  if (!pool) {
    throw new Error("Database pool not initialized. Call createPool() first.");
  }
  return pool;
}

export async function closePool(): Promise<void> {
  if (pool) {
    await pool.end();
    pool = null;
  }
}
