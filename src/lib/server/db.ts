import "server-only";
import fs from "node:fs";
import { config } from "./config";

// One tiny query interface over either a real PostgreSQL server (DATABASE_URL)
// or an embedded PGlite database for zero-config local development.

type Row = Record<string, unknown>;
interface Db {
  query<T = Row>(sql: string, params?: unknown[]): Promise<T[]>;
}

const SCHEMA = `
CREATE TABLE IF NOT EXISTS users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL UNIQUE,
  name text NOT NULL DEFAULT '',
  password_hash text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS sessions (
  id text PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  user_agent text NOT NULL DEFAULT ''
);
CREATE INDEX IF NOT EXISTS sessions_user_idx ON sessions(user_id);
CREATE TABLE IF NOT EXISTS password_resets (
  token_hash text PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at timestamptz NOT NULL,
  used_at timestamptz
);
CREATE TABLE IF NOT EXISTS history (
  id bigserial PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  tool text NOT NULL,
  file_names text NOT NULL DEFAULT '',
  file_count int NOT NULL DEFAULT 0,
  input_bytes bigint NOT NULL DEFAULT 0,
  output_bytes bigint NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS history_user_idx ON history(user_id, created_at DESC);
CREATE TABLE IF NOT EXISTS contact_messages (
  id bigserial PRIMARY KEY,
  name text NOT NULL,
  email text NOT NULL,
  subject text NOT NULL DEFAULT '',
  message text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
`;

const g = globalThis as unknown as { __ffdDb?: Promise<Db> };

async function create(): Promise<Db> {
  if (config.databaseUrl) {
    const { Pool } = await import("pg");
    const pool = new Pool({
      connectionString: config.databaseUrl,
      max: 10,
      ssl: /sslmode=require/.test(config.databaseUrl) ? { rejectUnauthorized: false } : undefined,
    });
    const db: Db = {
      async query<T>(sql: string, params: unknown[] = []) {
        const r = await pool.query(sql, params);
        return r.rows as T[];
      },
    };
    await pool.query(SCHEMA);
    return db;
  }
  const { PGlite } = await import("@electric-sql/pglite");
  fs.mkdirSync(config.pgliteDir, { recursive: true });
  const pg = new PGlite(config.pgliteDir);
  await pg.waitReady;
  await pg.exec(SCHEMA);
  return {
    async query<T>(sql: string, params: unknown[] = []) {
      const r = await pg.query<T>(sql, params);
      return r.rows;
    },
  };
}

export function getDb(): Promise<Db> {
  if (!g.__ffdDb) {
    g.__ffdDb = create().catch((e) => {
      g.__ffdDb = undefined;
      throw e;
    });
  }
  return g.__ffdDb;
}

export async function q<T = Row>(sql: string, params: unknown[] = []): Promise<T[]> {
  return (await getDb()).query<T>(sql, params);
}
