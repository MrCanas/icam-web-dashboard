/**
 * Aplica la migración 034 — proyectos.fecha_fin + RPC replace_proyectos completo.
 *
 * Es una migración del módulo *portfolio*, pero vive aquí porque
 * scripts/pm/tsconfig.json es el único que type-checkea los scripts: fuera de
 * este directorio un error de sintaxis solo se descubre ejecutándolo.
 *
 * Aditiva e idempotente: añade una columna nullable y redefine la función.
 * Dry-run por defecto; escribe con `--apply`.
 *
 *   npm run pm:apply-migration-034
 *   npm run pm:apply-migration-034 -- --apply
 *
 * OJO: las cuatro columnas que el RPC recuperaba (entry_yield, exit_yield,
 * credito_total, fecha_fin) NO se rellenan retroactivamente. Hay que volver a
 * cargar el Excel maestro después de aplicar esto.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import type { PoolClient } from "pg";

import { closePgPool, withPgClient } from "../actas/lib/db";
import { cargarEnv } from "./lib/env";

const MIGRATION_PATH = resolve(
  process.cwd(),
  "supabase/migrations/20260902120000_034_proyectos_fecha_fin_y_rpc.sql",
);

/** Columnas que el RPC de la 018 se dejaba fuera y que la 034 recupera. */
const COLUMNAS_RECUPERADAS = ["entry_yield", "exit_yield", "credito_total", "fecha_fin"];

async function existeColumnaFechaFin(client: PoolClient): Promise<boolean> {
  const { rows } = await client.query<{ n: string }>(
    `SELECT COUNT(*)::text AS n FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'proyectos' AND column_name = 'fecha_fin'`,
  );
  return Number(rows[0]?.n ?? "0") > 0;
}

/** Devuelve las columnas de COLUMNAS_RECUPERADAS que el RPC vigente NO inserta. */
async function columnasQueFaltanEnRpc(client: PoolClient): Promise<string[]> {
  const { rows } = await client.query<{ def: string }>(
    `SELECT pg_get_functiondef(p.oid) AS def FROM pg_proc p
       JOIN pg_namespace n ON n.oid = p.pronamespace
      WHERE n.nspname = 'public' AND p.proname = 'replace_proyectos'`,
  );
  const def = rows[0]?.def;
  if (!def) return [...COLUMNAS_RECUPERADAS];
  return COLUMNAS_RECUPERADAS.filter((col) => !def.includes(col));
}

/** Cuántas filas vigentes tienen ya dato en cada columna recuperada. */
async function cobertura(client: PoolClient): Promise<Record<string, number>> {
  const { rows } = await client.query<Record<string, string>>(
    `SELECT
       COUNT(*) FILTER (WHERE entry_yield   IS NOT NULL)::text AS entry_yield,
       COUNT(*) FILTER (WHERE exit_yield    IS NOT NULL)::text AS exit_yield,
       COUNT(*) FILTER (WHERE credito_total IS NOT NULL)::text AS credito_total,
       COUNT(*) FILTER (WHERE fecha_fin     IS NOT NULL)::text AS fecha_fin,
       COUNT(*)::text AS total
     FROM public.proyectos WHERE es_ultima_fila = 1`,
  );
  const r = rows[0] ?? {};
  return Object.fromEntries(Object.entries(r).map(([k, v]) => [k, Number(v ?? "0")]));
}

async function main(): Promise<void> {
  cargarEnv();
  const apply = process.argv.includes("--apply");
  const sql = readFileSync(MIGRATION_PATH, "utf8");

  await withPgClient(async (client) => {
    const teniaColumna = await existeColumnaFechaFin(client);
    const faltabanAntes = await columnasQueFaltanEnRpc(client);
    console.log(`columna proyectos.fecha_fin: ${teniaColumna ? "existe" : "NO existe"}`);
    console.log(
      faltabanAntes.length === 0
        ? "RPC replace_proyectos: ya inserta las cuatro columnas"
        : `RPC replace_proyectos: NO inserta ${faltabanAntes.join(", ")}`,
    );

    if (!apply) {
      console.log("\nDry-run. Repite con --apply para escribir.");
      return;
    }

    console.log("\naplicando migración 034…");
    await client.query(sql);

    const tieneColumna = await existeColumnaFechaFin(client);
    const faltanDespues = await columnasQueFaltanEnRpc(client);
    console.log(`  columna fecha_fin → ${tieneColumna ? "✓" : "✗"}`);
    console.log(
      `  RPC con las cuatro columnas → ${faltanDespues.length === 0 ? "✓" : `✗ (faltan ${faltanDespues.join(", ")})`}`,
    );

    const cob = await cobertura(client);
    console.log(
      `\ncobertura actual sobre ${cob.total ?? 0} filas vigentes: ` +
        COLUMNAS_RECUPERADAS.map((c) => `${c}=${cob[c] ?? 0}`).join(" · "),
    );
    console.log(
      "Si salen a 0 es lo esperado: la migración no rellena hacia atrás.\n" +
        "Vuelve a subir el Excel maestro (Datos → Subir) para poblarlas.",
    );

    const ok = tieneColumna && faltanDespues.length === 0;
    console.log(ok ? "\n✓ Migración 034 OK." : "\n✗ Revisar.");
    if (!ok) process.exitCode = 1;
  });

  await closePgPool();
}

main().catch((err: unknown) => {
  console.error(err instanceof Error ? err.message : err);
  process.exitCode = 1;
});
