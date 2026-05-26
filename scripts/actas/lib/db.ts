import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

import { Pool, type PoolClient } from "pg";

import { getSupabaseUrl, loadActasEnv } from "./env";

let pool: Pool | null = null;

const POOLER_URL_FILE = resolve(
  process.cwd(),
  "supabase",
  ".temp",
  "pooler-url",
);

function isDirectSupabaseDbHost(hostname: string): boolean {
  return /^db\.[a-z0-9]+\.supabase\.co$/i.test(hostname);
}

/**
 * `db.<ref>.supabase.co` is IPv6-only; many Windows networks cannot reach it.
 * Prefer Supavisor session pooler (IPv4) from `supabase/.temp/pooler-url` after `supabase link`.
 */
function preferPoolerConnectionString(connectionString: string): string {
  let parsed: URL;
  try {
    parsed = new URL(connectionString);
  } catch {
    return connectionString;
  }

  if (!isDirectSupabaseDbHost(parsed.hostname)) {
    return connectionString;
  }

  const poolerOverride = process.env.DATABASE_POOLER_URL?.trim();
  const poolerTemplate = poolerOverride
    ? poolerOverride
    : existsSync(POOLER_URL_FILE)
      ? readFileSync(POOLER_URL_FILE, "utf8").trim()
      : null;

  if (!poolerTemplate) {
    throw new Error(
      "DATABASE_URL usa db.<ref>.supabase.co (solo IPv6) y esta red no puede conectar.\n" +
        "Opciones:\n" +
        "  1. Dashboard → Database → Connection string → Session mode (puerto 5432)\n" +
        "  2. `npx supabase link` (genera supabase/.temp/pooler-url)\n" +
        "  3. DATABASE_POOLER_URL=postgresql://postgres.<ref>:<pass>@aws-....pooler.supabase.com:5432/postgres",
    );
  }

  const pooler = new URL(poolerTemplate);
  const password =
    parsed.password ||
    process.env.SUPABASE_DB_PASSWORD?.trim() ||
    pooler.password;
  if (!password) {
    throw new Error(
      "Falta contraseña para el pooler: inclúyela en DATABASE_URL o SUPABASE_DB_PASSWORD.",
    );
  }
  pooler.password = decodeURIComponent(password);
  return pooler.toString();
}

/**
 * Connection string for P3.4 transactional load.
 * Prefer DATABASE_URL; otherwise build from SUPABASE_DB_PASSWORD + project ref in SUPABASE_URL.
 */
export function getDatabaseUrl(): string {
  loadActasEnv();

  const direct =
    process.env.DATABASE_URL?.trim() ||
    process.env.SUPABASE_DB_URL?.trim() ||
    process.env.POSTGRES_URL?.trim();

  if (direct) {
    return preferPoolerConnectionString(direct);
  }

  const password = process.env.SUPABASE_DB_PASSWORD?.trim();
  if (!password) {
    throw new Error(
      "Falta conexión Postgres para monday-load. Añade en .env.local:\n" +
        "  DATABASE_URL=postgresql://postgres.[ref]:[password]@....pooler.supabase.com:5432/postgres\n" +
        "  o SUPABASE_DB_PASSWORD=<contraseña DB> (con proyecto enlazado vía `supabase link`)",
    );
  }

  if (existsSync(POOLER_URL_FILE)) {
    const pooler = new URL(readFileSync(POOLER_URL_FILE, "utf8").trim());
    pooler.password = password;
    return pooler.toString();
  }

  const supabaseUrl = getSupabaseUrl();
  const match = supabaseUrl.match(/^https:\/\/([a-z0-9]+)\.supabase\.co$/i);
  if (!match) {
    throw new Error(
      `SUPABASE_URL no reconocida para construir DATABASE_URL: ${supabaseUrl}`,
    );
  }
  const ref = match[1];
  const user = process.env.SUPABASE_DB_USER?.trim() || "postgres";
  const host = process.env.SUPABASE_DB_HOST?.trim() || `db.${ref}.supabase.co`;
  const port = process.env.SUPABASE_DB_PORT?.trim() || "5432";
  const database = process.env.SUPABASE_DB_NAME?.trim() || "postgres";

  const built = `postgresql://${encodeURIComponent(user)}:${encodeURIComponent(password)}@${host}:${port}/${database}`;
  return preferPoolerConnectionString(built);
}

export function getPgPool(): Pool {
  if (!pool) {
    const connectionString = getDatabaseUrl();
    const local = /localhost|127\.0\.0\.1/.test(connectionString);
    pool = new Pool({
      connectionString,
      ssl: local ? undefined : { rejectUnauthorized: false },
    });
  }
  return pool;
}

export async function withPgClient<T>(
  fn: (client: PoolClient) => Promise<T>,
): Promise<T> {
  const client = await getPgPool().connect();
  try {
    return await fn(client);
  } finally {
    client.release();
  }
}

export async function closePgPool(): Promise<void> {
  if (pool) {
    await pool.end();
    pool = null;
  }
}
