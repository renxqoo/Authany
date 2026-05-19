import pg from "pg";
import { loadSharedExampleEnv } from "../src/env.js";

loadSharedExampleEnv();

const dbConfig = {
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT) || 5432,
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
};

async function main() {
  const pool = new pg.Pool(dbConfig);

  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        username VARCHAR(128) UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        display_name VARCHAR(256) NOT NULL,
        status VARCHAR(32) NOT NULL DEFAULT 'active',
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
    console.log("Ensured 'users' table exists.");

    // Hash password using the same scrypt approach as src/auth.ts
    const { randomUUID, scryptSync } = await import("node:crypto");

    const salt = randomUUID();
    const derived = scryptSync("demo1234", salt, 64);
    const passwordHash = `${salt}:${derived.toString("hex")}`;

    await pool.query(
      `INSERT INTO users (username, password_hash, display_name)
       VALUES ($1, $2, $3)
       ON CONFLICT (username) DO NOTHING`,
      ["demo", passwordHash, "Demo User"],
    );
    console.log("Seeded default user: demo / demo1234");
  } finally {
    await pool.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
