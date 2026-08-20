/**
 * Aplica la migración 032 — auth_user_id_by_email.
 *
 * Solo crea una función. Idempotente. Verifica que resuelve un email real.
 * Dry-run por defecto; escribe con `--apply`.
 *
 *   npm run pm:apply-migration-032
 *   npm run pm:apply-migration-032 -- --apply
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import type { PoolClient } from "pg";

import { closePgPool, withPgClient } from "../actas/lib/db";
import { cargarEnv } from "./lib/env";

const MIGRATION_PATH = resolve(
  process.cwd(),
  "supabase/migrations/20260819180000_032_auth_user_por_email.sql",
);

async function existeFuncion(client: PoolClient): Promise<boolean> {
  const { rows } = await client.query<{ n: string }>(
    `SELECT COUNT(*)::text AS n FROM pg_proc p
       JOIN pg_namespace n ON n.oid = p.pronamespace
      WHERE n.nspname = 'public' AND p.proname = 'auth_user_id_by_email'`,
  );
  return Number(rows[0]?.n ?? "0") > 0;
}

async function main(): Promise<void> {
  cargarEnv();
  const apply = process.argv.includes("--apply");
  const sql = readFileSync(MIGRATION_PATH, "utf8");

  await withPgClient(async (client) => {
    console.log(`función auth_user_id_by_email: ${(await existeFuncion(client)) ? "existe" : "no existe"}`);
    if (!apply) {
      console.log("\nDry-run. Repite con --apply para escribir.");
      return;
    }
    console.log("\naplicando migración 032…");
    await client.query(sql);

    // Prueba: resuelve el primer email real de auth.users contra sí mismo.
    const { rows } = await client.query<{ id: string; email: string }>(
      "SELECT id, email FROM auth.users WHERE email IS NOT NULL LIMIT 1",
    );
    let ok = await existeFuncion(client);
    if (rows.length > 0) {
      const { rows: r } = await client.query<{ auth_user_id_by_email: string | null }>(
        "SELECT public.auth_user_id_by_email($1)",
        [rows[0].email],
      );
      const resuelto = r[0]?.auth_user_id_by_email ?? null;
      ok = ok && resuelto === rows[0].id;
      console.log(`  prueba: ${rows[0].email} → ${resuelto === rows[0].id ? "id correcto ✓" : "✗ no coincide"}`);
    }
    console.log(ok ? "\n✓ Migración 032 OK." : "\n✗ Revisar.");
    if (!ok) process.exitCode = 1;
  });

  await closePgPool();
}

main().catch((err: unknown) => {
  console.error(err instanceof Error ? err.message : err);
  process.exitCode = 1;
});
