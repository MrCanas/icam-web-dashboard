/**
 * Aplica la migración 013 (progress + completed_at en element) a la BD.
 * Backup previo de (id, status, archived_at) + verificación de recuento e
 * idempotencia. Additiva y segura de re-ejecutar.
 *
 *   npx tsx scripts/actas/apply-migration-013.ts
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

import { closePgPool, withPgClient } from "./lib/db";

const MIGRATION_PATH = resolve(
  process.cwd(),
  "supabase/migrations/20260611120000_013_element_progress_completed_at.sql",
);

async function main(): Promise<void> {
  const sql = readFileSync(MIGRATION_PATH, "utf8");

  await withPgClient(async (client) => {
    const { rows: beforeRows } = await client.query<{ n: string }>(
      "SELECT COUNT(*)::text AS n FROM public.element",
    );
    const countBefore = Number(beforeRows[0]?.n ?? "0");
    console.log(`element rows antes: ${countBefore}`);

    // Backup (id, status, archived_at) antes de tocar nada.
    const { rows: backupRows } = await client.query(
      "SELECT id, status, archived_at FROM public.element",
    );
    const stamp = new Date().toISOString().replace(/[:.]/g, "-");
    const backupDir = resolve(process.cwd(), "tmp/backups");
    mkdirSync(backupDir, { recursive: true });
    const backupPath = resolve(backupDir, `element-pre-013-${stamp}.json`);
    writeFileSync(backupPath, JSON.stringify(backupRows, null, 2), "utf8");
    console.log(`backup: ${backupPath} (${backupRows.length} filas)`);

    console.log("aplicando migración 013…");
    await client.query(sql);

    // Verificación: columnas creadas.
    const { rows: cols } = await client.query<{ column_name: string }>(
      `SELECT column_name FROM information_schema.columns
       WHERE table_schema = 'public' AND table_name = 'element'
         AND column_name IN ('progress', 'completed_at')
       ORDER BY column_name`,
    );
    const colNames = cols.map((c) => c.column_name);
    console.log(`columnas presentes: ${colNames.join(", ") || "(ninguna)"}`);

    // Verificación: recuento intacto.
    const { rows: afterRows } = await client.query<{ n: string }>(
      "SELECT COUNT(*)::text AS n FROM public.element",
    );
    const countAfter = Number(afterRows[0]?.n ?? "0");
    console.log(`element rows después: ${countAfter}`);

    const { rows: doneRows } = await client.query<{ done: string; filled: string }>(
      `SELECT
         COUNT(*) FILTER (WHERE status = 'done')::text AS done,
         COUNT(*) FILTER (WHERE status = 'done' AND completed_at IS NOT NULL)::text AS filled
       FROM public.element`,
    );
    console.log(
      `done=${doneRows[0]?.done} · con completed_at=${doneRows[0]?.filled}`,
    );

    const ok =
      colNames.includes("progress") &&
      colNames.includes("completed_at") &&
      countAfter === countBefore;
    console.log(ok ? "\n✓ Migración 013 aplicada y verificada." : "\n✗ Revisar: algo no cuadra.");
    if (!ok) process.exitCode = 1;
  });

  await closePgPool();
}

main().catch((err: unknown) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
