/**
 * Aplica la migración 029 — tipología y contexto de las promociones.
 *
 * Solo añade columnas a pm_promociones (`ADD COLUMN IF NOT EXISTS`), así que es
 * aditiva e idempotente: se puede reejecutar sin daño.
 *
 * Dry-run por defecto; escribe con `--apply`.
 *
 *   npm run pm:apply-migration-029
 *   npm run pm:apply-migration-029 -- --apply
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import type { PoolClient } from "pg";

import { closePgPool, withPgClient } from "../actas/lib/db";
import { cargarEnv } from "./lib/env";

const MIGRATION_PATH = resolve(
  process.cwd(),
  "supabase/migrations/20260819150000_029_promocion_tipologia.sql",
);

const COLUMNAS = [
  "tipo_proyecto",
  "tipo_activo",
  "direccion",
  "provincia",
  "owner_nombre",
  "modificado_en_zoho",
  "avance_actualizado_en_zoho",
];

async function columnasExistentes(client: PoolClient): Promise<Set<string>> {
  const { rows } = await client.query<{ column_name: string }>(
    `SELECT column_name FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'pm_promociones'
        AND column_name = ANY($1)`,
    [COLUMNAS],
  );
  return new Set(rows.map((r) => r.column_name));
}

function informa(presentes: Set<string>): void {
  for (const c of COLUMNAS) console.log(`  ${presentes.has(c) ? "✓" : "·"} pm_promociones.${c}`);
}

async function main(): Promise<void> {
  cargarEnv();
  const apply = process.argv.includes("--apply");
  const sql = readFileSync(MIGRATION_PATH, "utf8");

  await withPgClient(async (client) => {
    console.log("— antes —");
    informa(await columnasExistentes(client));

    if (!apply) {
      console.log("\nDry-run. Repite con --apply para escribir.");
      return;
    }

    console.log("\naplicando migración 029…");
    await client.query(sql);

    const despues = await columnasExistentes(client);
    console.log("\n— después —");
    informa(despues);

    const ok = COLUMNAS.every((c) => despues.has(c));
    console.log(
      ok
        ? "\n✓ Migración 029 OK. Siguiente paso: npm run pm:seed-avance-obra -- --apply"
        : "\n✗ Revisar: falta alguna columna.",
    );
    if (!ok) process.exitCode = 1;
  });

  await closePgPool();
}

main().catch((err: unknown) => {
  console.error(err instanceof Error ? err.message : err);
  process.exitCode = 1;
});
