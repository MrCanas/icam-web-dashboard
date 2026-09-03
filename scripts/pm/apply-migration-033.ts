/**
 * Aplica la migración 033 — auth_users_display.
 *
 * Solo crea una función. Idempotente. Verifica que devuelve un usuario real.
 * Dry-run por defecto; escribe con `--apply`.
 *
 *   npm run pm:apply-migration-033
 *   npm run pm:apply-migration-033 -- --apply
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import type { PoolClient } from "pg";

import { closePgPool, withPgClient } from "../actas/lib/db";
import { cargarEnv } from "./lib/env";

const MIGRATION_PATH = resolve(
  process.cwd(),
  "supabase/migrations/20260819190000_033_auth_users_display.sql",
);

async function existeFuncion(client: PoolClient): Promise<boolean> {
  const { rows } = await client.query<{ n: string }>(
    `SELECT COUNT(*)::text AS n FROM pg_proc p
       JOIN pg_namespace n ON n.oid = p.pronamespace
      WHERE n.nspname = 'public' AND p.proname = 'auth_users_display'`,
  );
  return Number(rows[0]?.n ?? "0") > 0;
}

async function main(): Promise<void> {
  cargarEnv();
  const apply = process.argv.includes("--apply");
  const sql = readFileSync(MIGRATION_PATH, "utf8");

  await withPgClient(async (client) => {
    console.log(`función auth_users_display: ${(await existeFuncion(client)) ? "existe" : "no existe"}`);
    if (!apply) {
      console.log("\nDry-run. Repite con --apply para escribir.");
      return;
    }
    console.log("\naplicando migración 033…");
    await client.query(sql);

    const { rows } = await client.query<{ id: string }>(
      "SELECT id FROM auth.users LIMIT 1",
    );
    let ok = await existeFuncion(client);
    if (rows.length > 0) {
      const { rows: r } = await client.query(
        "SELECT * FROM public.auth_users_display($1::uuid[])",
        [[rows[0].id]],
      );
      ok = ok && r.length === 1;
      console.log(`  prueba: 1 id → ${r.length} fila(s) ${r.length === 1 ? "✓" : "✗"}`);
    }
    console.log(ok ? "\n✓ Migración 033 OK." : "\n✗ Revisar.");
    if (!ok) process.exitCode = 1;
  });

  await closePgPool();
}

main().catch((err: unknown) => {
  console.error(err instanceof Error ? err.message : err);
  process.exitCode = 1;
});
