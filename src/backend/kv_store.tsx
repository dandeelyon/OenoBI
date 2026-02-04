import { Pool } from "https://deno.land/x/postgres@v0.17.0/mod.ts";

const POOL_COUNT = 1;
const dbPool = new Pool({
  hostname: "db",
  port: 5432,
  user: "user",
  password: "password",
  database: "oenobi",
}, POOL_COUNT);

async function execute<T>(fn: (conn: any) => Promise<T>) {
  const conn = await dbPool.connect();
  try {
    return await fn(conn);
  } finally {
    conn.release();
  }
}

export async function get<T>(key: string): Promise<T | null> {
  return await execute(async (conn) => {
    await conn.queryObject`
      CREATE TABLE IF NOT EXISTS kv (
        key TEXT PRIMARY KEY,
        value JSONB
      )
    `;
    const result = await conn.queryObject`
      SELECT value FROM kv WHERE key = ${key}
    `;
    if (result.rows.length === 0) {
      return null;
    }
    return result.rows[0].value as T;
  });
}

export async function set<T>(key: string, value: T): Promise<void> {
  await execute(async (conn) => {
    await conn.queryObject`
      CREATE TABLE IF NOT EXISTS kv (
        key TEXT PRIMARY KEY,
        value JSONB
      )
    `;
    await conn.queryObject`
      INSERT INTO kv (key, value)
      VALUES (${key}, ${JSON.stringify(value)})
      ON CONFLICT (key) DO UPDATE
      SET value = ${JSON.stringify(value)}
    `;
  });
}

export async function del(key: string): Promise<void> {
  await execute(async (conn) => {
    await conn.queryObject`
      DELETE FROM kv WHERE key = ${key}
    `;
  });
}
