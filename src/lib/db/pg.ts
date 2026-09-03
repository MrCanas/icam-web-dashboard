import { Pool, type PoolClient } from "pg";

/**
 * Pool de Postgres para las Server Actions que necesitan una transacción real
 * (crear/duplicar proyecto de actas), donde el cliente de Supabase no llega.
 *
 * Vive en `src/lib/db` —dentro del type-check y el lint del proyecto— en vez de
 * reexportar desde `scripts/`, que está excluido de tsc/ESLint y no compila.
 * Ese import app→scripts era la deuda §1.3 de la auditoría.
 *
 * En Vercel `DATABASE_URL` siempre está definida (el pooler de Supabase). El
 * SSL va sin verificación de certificado contra el pooler, igual que el resto
 * de accesos pg del repo; en local se detecta localhost y se desactiva SSL.
 */
let pool: Pool | null = null;

function getConnectionString(): string {
  const url =
    process.env.DATABASE_URL?.trim() ||
    process.env.SUPABASE_DB_URL?.trim() ||
    process.env.POSTGRES_URL?.trim();
  if (!url) {
    throw new Error(
      "Falta DATABASE_URL para la conexión Postgres directa (crear/duplicar proyecto de actas).",
    );
  }
  return url;
}

export function getPgPool(): Pool {
  if (!pool) {
    const connectionString = getConnectionString();
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
