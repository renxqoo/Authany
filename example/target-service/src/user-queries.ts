import { getPool } from "./db.js";

export interface UserRow {
  id: number;
  username: string;
  password_hash: string;
  display_name: string;
  status: string;
  created_at: string;
  updated_at: string;
}

export async function findUserByUsername(username: string): Promise<UserRow | null> {
  const pool = getPool();
  const result = await pool.query(
    `SELECT id, username, password_hash, display_name, status, created_at, updated_at
     FROM users
     WHERE username = $1 AND status = 'active'`,
    [username],
  );
  return result.rows[0] ?? null;
}

export async function findUserById(id: number): Promise<UserRow | null> {
  const pool = getPool();
  const result = await pool.query(
    `SELECT id, username, password_hash, display_name, status, created_at, updated_at
     FROM users
     WHERE id = $1 AND status = 'active'`,
    [id],
  );
  return result.rows[0] ?? null;
}

export async function createUser(params: {
  username: string;
  passwordHash: string;
  displayName: string;
}): Promise<UserRow> {
  const pool = getPool();
  const result = await pool.query(
    `INSERT INTO users (username, password_hash, display_name)
     VALUES ($1, $2, $3)
     RETURNING id, username, password_hash, display_name, status, created_at, updated_at`,
    [params.username, params.passwordHash, params.displayName],
  );
  return result.rows[0];
}
