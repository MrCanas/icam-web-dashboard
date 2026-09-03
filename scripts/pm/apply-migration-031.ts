/**
 * Aplica la migración 031 — replace_pm_portfolio no destructivo.
 *
 * Reemplaza la función. La verificación es la que importa: dentro de una
 * transacción con ROLLBACK, simula un reemplazo de portfolio y comprueba que
 * pm_activo_proyecto_map, pm_activo_promocion_map y pm_activo_snapshot SIGUEN
 * ahí después. Con la versión vieja, esa misma prueba los habría borrado.
 *
 * Dry-run por defecto; escribe con `--apply`.
 *
 *   npm run pm:apply-migration-031
 *   npm run pm:apply-migration-031 -- --apply
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import type { PoolClient } from "pg";

import { closePgPool, withPgClient } from "../actas/lib/db";
import { cargarEnv } from "./lib/env";

const MIGRATION_PATH = resolve(
  process.cwd(),
  "supabase/migrations/20260819170000_031_replace_pm_no_destructivo.sql",
);

async function contar(client: PoolClient, tabla: string): Promise<number> {
  const { rows } = await client.query<{ n: string }>(`SELECT COUNT(*)::text AS n FROM public.${tabla}`);
  return Number(rows[0]?.n ?? "0");
}

/**
 * Prueba dentro de una transacción que se revierte: coge un activo real con
 * mapeos, lanza replace_pm_portfolio con solo ese activo, y verifica que los
 * mapeos sobreviven. ROLLBACK al final: no se escribe nada de verdad.
 */
async function verificarNoDestructivo(client: PoolClient): Promise<boolean> {
  await client.query("BEGIN");
  try {
    const { rows } = await client.query<{ id_activo: string; tipo_uso_activo: string }>(
      `SELECT a.id_activo, a.tipo_uso_activo
         FROM pm_activos a
         JOIN pm_activo_proyecto_map m ON m.pm_activo_id = a.id
        LIMIT 1`,
    );
    if (rows.length === 0) {
      console.log("  (no hay activos con mapeo para probar; se omite la prueba de conservación)");
      await client.query("ROLLBACK");
      return true;
    }
    const activo = rows[0];
    const mapProyAntes = await contar(client, "pm_activo_proyecto_map");
    const mapPromoAntes = await contar(client, "pm_activo_promocion_map");
    const snapAntes = await contar(client, "pm_activo_snapshot");

    const payload = [
      {
        id_activo: activo.id_activo,
        tipo_uso_activo: activo.tipo_uso_activo,
        hito: "Obra",
        orden_hito: "1",
        fecha_actual: "2026-01-01",
        snapshots: { levantamiento: "2025-01-01" },
      },
    ];
    await client.query("SELECT replace_pm_portfolio($1::jsonb)", [JSON.stringify(payload)]);

    const mapProyDespues = await contar(client, "pm_activo_proyecto_map");
    const mapPromoDespues = await contar(client, "pm_activo_promocion_map");
    const snapDespues = await contar(client, "pm_activo_snapshot");

    const ok =
      mapProyDespues >= mapProyAntes &&
      mapPromoDespues >= mapPromoAntes &&
      snapDespues >= snapAntes;

    console.log(`  pm_activo_proyecto_map:  ${mapProyAntes} → ${mapProyDespues}`);
    console.log(`  pm_activo_promocion_map: ${mapPromoAntes} → ${mapPromoDespues}`);
    console.log(`  pm_activo_snapshot:      ${snapAntes} → ${snapDespues}`);
    console.log(ok ? "  ✓ los mapeos sobreviven al reemplazo" : "  ✗ se han perdido mapeos");

    await client.query("ROLLBACK");
    return ok;
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  }
}

async function main(): Promise<void> {
  cargarEnv();
  const apply = process.argv.includes("--apply");
  const sql = readFileSync(MIGRATION_PATH, "utf8");

  await withPgClient(async (client) => {
    if (!apply) {
      console.log("Dry-run. Repite con --apply para reemplazar la función y verificar.");
      return;
    }

    console.log("aplicando migración 031…");
    await client.query(sql);

    console.log("\n— prueba de conservación (transacción con ROLLBACK) —");
    const ok = await verificarNoDestructivo(client);

    console.log(ok ? "\n✓ Migración 031 OK." : "\n✗ Revisar la función.");
    if (!ok) process.exitCode = 1;
  });

  await closePgPool();
}

main().catch((err: unknown) => {
  console.error(err instanceof Error ? err.message : err);
  process.exitCode = 1;
});
