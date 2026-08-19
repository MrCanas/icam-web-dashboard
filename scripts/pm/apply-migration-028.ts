/**
 * Aplica la migración 028 — Avance de obra por promoción (fuente: Zoho CRM).
 *
 * Crea 6 tablas, 2 funciones y las políticas de lectura. Es DDL puro, aditivo e
 * idempotente (`CREATE TABLE IF NOT EXISTS`, `CREATE OR REPLACE FUNCTION`,
 * políticas dentro de un guard `IF NOT EXISTS`): se puede reejecutar sin daño.
 *
 * No mete ningún dato de promociones: eso lo hace `npm run pm:seed-avance-obra`.
 * Lo único que siembra son las 7 filas del catálogo de fases, que es vocabulario
 * estructural.
 *
 * Dry-run por defecto; escribe con `--apply`.
 *
 *   npm run pm:apply-migration-028
 *   npm run pm:apply-migration-028 -- --apply
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import type { PoolClient } from "pg";

import { closePgPool, withPgClient } from "../actas/lib/db";

const MIGRATION_PATH = resolve(
  process.cwd(),
  "supabase/migrations/20260819120000_028_pm_avance_obra.sql",
);

const TABLAS = [
  "pm_avance_fase_catalogo",
  "pm_promociones",
  "pm_activo_promocion_map",
  "pm_avance_obra",
  "pm_avance_obra_historico",
  "pm_avance_zoho_outbox",
];

const FUNCIONES = ["pm_avance_registrar_cambio", "pm_avance_importar_zoho"];

async function tablasExistentes(client: PoolClient): Promise<Set<string>> {
  const { rows } = await client.query<{ table_name: string }>(
    `SELECT table_name FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = ANY($1)`,
    [TABLAS],
  );
  return new Set(rows.map((r) => r.table_name));
}

async function funcionesExistentes(client: PoolClient): Promise<Set<string>> {
  const { rows } = await client.query<{ proname: string }>(
    `SELECT p.proname FROM pg_proc p
       JOIN pg_namespace n ON n.oid = p.pronamespace
      WHERE n.nspname = 'public' AND p.proname = ANY($1)`,
    [FUNCIONES],
  );
  return new Set(rows.map((r) => r.proname));
}

async function politicasExistentes(client: PoolClient): Promise<Set<string>> {
  const { rows } = await client.query<{ tablename: string }>(
    `SELECT tablename FROM pg_policies
      WHERE schemaname = 'public' AND tablename = ANY($1)
        AND policyname = tablename || '_public_read'`,
    [TABLAS],
  );
  return new Set(rows.map((r) => r.tablename));
}

async function fasesSembradas(client: PoolClient): Promise<number> {
  const existe = await tablasExistentes(client);
  if (!existe.has("pm_avance_fase_catalogo")) return 0;
  const { rows } = await client.query<{ n: string }>(
    "SELECT COUNT(*)::text AS n FROM public.pm_avance_fase_catalogo",
  );
  return Number(rows[0]?.n ?? "0");
}

function informa(titulo: string, esperado: string[], presentes: Set<string>): void {
  console.log(`${titulo}:`);
  for (const nombre of esperado) {
    console.log(`  ${presentes.has(nombre) ? "✓" : "·"} ${nombre}`);
  }
}

async function main(): Promise<void> {
  const apply = process.argv.includes("--apply");
  const sql = readFileSync(MIGRATION_PATH, "utf8");

  await withPgClient(async (client) => {
    console.log("— antes —");
    informa("tablas", TABLAS, await tablasExistentes(client));
    informa("funciones", FUNCIONES, await funcionesExistentes(client));
    informa("políticas de lectura", TABLAS, await politicasExistentes(client));
    console.log(`fases del catálogo: ${await fasesSembradas(client)}/7`);

    if (!apply) {
      console.log("\nDry-run. Repite con --apply para escribir.");
      return;
    }

    console.log("\naplicando migración 028…");
    await client.query(sql);

    const tablas = await tablasExistentes(client);
    const funciones = await funcionesExistentes(client);
    const politicas = await politicasExistentes(client);
    const fases = await fasesSembradas(client);

    console.log("\n— después —");
    informa("tablas", TABLAS, tablas);
    informa("funciones", FUNCIONES, funciones);
    informa("políticas de lectura", TABLAS, politicas);
    console.log(`fases del catálogo: ${fases}/7`);

    const ok =
      TABLAS.every((t) => tablas.has(t)) &&
      FUNCIONES.every((f) => funciones.has(f)) &&
      TABLAS.every((t) => politicas.has(t)) &&
      fases === 7;

    console.log(
      ok
        ? "\n✓ Migración 028 OK. Siguiente paso: npm run pm:seed-avance-obra"
        : "\n✗ Revisar: falta algo por crear.",
    );
    if (!ok) process.exitCode = 1;
  });

  await closePgPool();
}

main().catch((err: unknown) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
