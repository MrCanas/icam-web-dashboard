/**
 * Aplica la migración 027 — continuidad de permisos al mover el Overview de PM.
 *
 * Copia los denies `pm.overview` (URL vieja, ya solo un redirect) a la route key
 * nueva `portfolio.pm_overview`. Sin esto, quien tenía el Overview denegado lo
 * recuperaría al desplegar la navegación nueva.
 *
 * Aditiva e idempotente: ejecuta el SQL del propio fichero de migración, que es
 * un INSERT … SELECT … ON CONFLICT DO NOTHING. Nunca borra un deny.
 * Dry-run por defecto; escribe con `--apply`.
 *
 *   npm run pm:apply-migration-027
 *   npm run pm:apply-migration-027 -- --apply
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import type { PoolClient } from "pg";

import { closePgPool, withPgClient } from "../actas/lib/db";

const MIGRATION_PATH = resolve(
  process.cwd(),
  "supabase/migrations/20260812130000_027_route_deny_pm_overview.sql",
);

const VIEJA = "pm.overview";
const NUEVA = "portfolio.pm_overview";

async function contar(client: PoolClient, routeKey: string): Promise<number> {
  const { rows } = await client.query<{ n: string }>(
    "SELECT COUNT(*)::text AS n FROM public.app_user_route_deny WHERE route_key = $1",
    [routeKey],
  );
  return Number(rows[0]?.n ?? "0");
}

/** Denies de la key vieja que aún no tienen su gemela en la nueva. */
async function pendientes(client: PoolClient): Promise<string[]> {
  const { rows } = await client.query<{ user_id: string }>(
    `SELECT viejo.user_id
     FROM public.app_user_route_deny viejo
     WHERE viejo.route_key = $1
       AND NOT EXISTS (
         SELECT 1 FROM public.app_user_route_deny nuevo
         WHERE nuevo.user_id = viejo.user_id AND nuevo.route_key = $2
       )`,
    [VIEJA, NUEVA],
  );
  return rows.map((r) => r.user_id);
}

async function main(): Promise<void> {
  const apply = process.argv.includes("--apply");
  const sql = readFileSync(MIGRATION_PATH, "utf8");

  await withPgClient(async (client) => {
    const viejaAntes = await contar(client, VIEJA);
    const nuevaAntes = await contar(client, NUEVA);
    const porCopiar = await pendientes(client);

    console.log(`denies ${VIEJA}: ${viejaAntes}`);
    console.log(`denies ${NUEVA}: ${nuevaAntes}`);
    console.log(`por copiar: ${porCopiar.length}`);
    for (const userId of porCopiar) console.log(`  ~ ${userId}`);

    if (!apply) {
      console.log("\nDry-run. Repite con --apply para escribir.");
      return;
    }

    console.log("\naplicando migración 027…");
    await client.query(sql);

    const viejaDespues = await contar(client, VIEJA);
    const nuevaDespues = await contar(client, NUEVA);
    const quedan = await pendientes(client);

    console.log(`denies ${VIEJA}: ${viejaDespues}`);
    console.log(`denies ${NUEVA}: ${nuevaDespues}`);

    const ok =
      viejaDespues === viejaAntes && // no se borra nada de la key vieja
      nuevaDespues >= viejaDespues && // toda la vieja tiene gemela (más los denies propios)
      quedan.length === 0;

    console.log(
      ok
        ? "\n✓ Migración 027 OK (denies copiados, ninguno borrado)."
        : `\n✗ Revisar: quedan ${quedan.length} sin copiar.`,
    );
    if (!ok) process.exitCode = 1;
  });

  await closePgPool();
}

main().catch((err: unknown) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
