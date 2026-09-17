/**
 * Aplica la migración 042 — agregados de actas calculados en la base de datos.
 *
 * Crea dos funciones de solo lectura (`actas_last_log_entries` y
 * `actas_project_header_stats`). No toca tablas ni datos: `CREATE OR REPLACE`,
 * idempotente.
 *
 * Verifica, proyecto a proyecto, que las funciones dan lo mismo que las
 * consultas que sustituyen: nº de elementos, última fecha de log y la última
 * entrada de cada elemento.
 *
 * Dry-run por defecto: aplica, verifica y revierte.
 *
 *   npm run actas:apply-migration-042
 *   npm run actas:apply-migration-042 -- --apply
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import type { PoolClient } from "pg";

import { closePgPool, withPgClient } from "./lib/db";
import { cargarEnv } from "../pm/lib/env";

const MIGRATION_PATH = resolve(
  process.cwd(),
  "supabase/migrations/20260917120000_042_actas_lecturas_agregadas.sql",
);

/** Devuelve el nº de discrepancias del proyecto (0 = todo cuadra). */
async function verificarProyecto(
  client: PoolClient,
  project: { id: string; code: string },
): Promise<number> {
  let fallos = 0;

  const { rows: elementos } = await client.query<{ id: string }>(
    `SELECT e.id FROM public.element e
       JOIN public.category c ON c.id = e.category_id
      WHERE c.project_id = $1 AND c.archived_at IS NULL AND e.archived_at IS NULL`,
    [project.id],
  );
  const ids = elementos.map((e) => e.id);

  // Cabecera: lo que calculaba la versión por pasos.
  const { rows: esperado } = await client.query<{ max: string | null }>(
    `SELECT max(entry_date)::text AS max FROM public.log_entry WHERE element_id = ANY($1::uuid[])`,
    [ids],
  );
  const { rows: stats } = await client.query<{ element_count: string; last: string | null }>(
    `SELECT element_count, last_log_entry_at::text AS last
       FROM public.actas_project_header_stats($1)`,
    [project.id],
  );
  if (Number(stats[0]?.element_count) !== ids.length) {
    console.log(`  ✗ ${project.code}: elementos ${stats[0]?.element_count} ≠ ${ids.length}`);
    fallos++;
  }
  if ((stats[0]?.last ?? null) !== (esperado[0]?.max ?? null)) {
    console.log(`  ✗ ${project.code}: última actividad ${stats[0]?.last} ≠ ${esperado[0]?.max}`);
    fallos++;
  }

  // Última entrada por elemento: misma fecha máxima (el id puede diferir solo
  // si hay empate de fecha, y entonces la función desempata de forma estable).
  const { rows: rpc } = await client.query<{ element_id: string; entry_date: string }>(
    `SELECT element_id, entry_date::text FROM public.actas_last_log_entries($1::uuid[])`,
    [ids],
  );
  const { rows: maximos } = await client.query<{ element_id: string; entry_date: string }>(
    `SELECT element_id, max(entry_date)::text AS entry_date FROM public.log_entry
      WHERE element_id = ANY($1::uuid[]) AND deleted_at IS NULL
      GROUP BY element_id`,
    [ids],
  );
  const porElemento = new Map(rpc.map((r) => [r.element_id, r.entry_date]));
  if (rpc.length !== maximos.length) {
    console.log(`  ✗ ${project.code}: ${rpc.length} últimas entradas ≠ ${maximos.length} elementos con log`);
    fallos++;
  }
  for (const m of maximos) {
    if (porElemento.get(m.element_id) !== m.entry_date) {
      console.log(`  ✗ ${project.code}: elemento ${m.element_id} ${porElemento.get(m.element_id)} ≠ ${m.entry_date}`);
      fallos++;
    }
  }

  console.log(
    `  ${fallos === 0 ? "✓" : "✗"} ${project.code}: ${ids.length} elementos, ${rpc.length} con log`,
  );
  return fallos;
}

async function main(): Promise<void> {
  cargarEnv();
  const aplicar = process.argv.includes("--apply");
  const sql = readFileSync(MIGRATION_PATH, "utf8");

  console.log(
    aplicar
      ? "APLICANDO la migración 042.\n"
      : "Simulación de la migración 042: se aplica y se revierte.\n" +
          "Añade --apply para aplicarla de verdad.\n",
  );

  await withPgClient(async (client) => {
    await client.query("BEGIN");
    try {
      await client.query(sql);
      // Segunda pasada: CREATE OR REPLACE tiene que ser idempotente.
      await client.query(sql);

      const { rows: projects } = await client.query<{ id: string; code: string }>(
        `SELECT id, code FROM public.project WHERE archived_at IS NULL ORDER BY code`,
      );
      let fallos = 0;
      for (const p of projects) fallos += await verificarProyecto(client, p);

      const ok = fallos === 0;
      if (aplicar && ok) {
        await client.query("COMMIT");
        console.log("\n✓ Migración aplicada.");
        return;
      }
      await client.query("ROLLBACK");
      console.log(
        aplicar
          ? `\n✗ La verificación falló (${fallos}): ROLLBACK.`
          : ok
            ? "\n✓ Simulación correcta: ROLLBACK hecho."
            : `\n✗ Simulación con ${fallos} discrepancias: ROLLBACK hecho.`,
      );
      if (aplicar || !ok) process.exitCode = 1;
    } catch (err) {
      await client.query("ROLLBACK");
      throw err;
    }
  });

  await closePgPool();
}

// Ver la nota de scripts/inversores/zoho-auth.ts sobre process.exitCode en Windows.
main().catch((err: unknown) => {
  console.error(`✗ ${err instanceof Error ? err.message : err}`);
  process.exitCode = 1;
});
