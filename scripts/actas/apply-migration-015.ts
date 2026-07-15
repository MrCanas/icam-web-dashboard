/**
 * Aplica la migración 015 (FKs de element/log_entry/element_owner a
 * ON DELETE CASCADE). Solo metadatos; verifica que el recuento de elementos no
 * cambia y que las 4 FK quedan en 'c' (cascade). Idempotente.
 *
 *   npx tsx scripts/actas/apply-migration-015.ts
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { closePgPool, withPgClient } from "./lib/db";

const MIGRATION_PATH = resolve(
  process.cwd(),
  "supabase/migrations/20260611140000_015_cascade_delete.sql",
);

const EXPECTED = [
  "element_category_id_fkey",
  "element_parent_element_id_fkey",
  "element_owner_element_id_fkey",
  "log_entry_element_id_fkey",
];

async function main(): Promise<void> {
  const sql = readFileSync(MIGRATION_PATH, "utf8");

  await withPgClient(async (client) => {
    const { rows: before } = await client.query<{ n: string }>(
      "SELECT COUNT(*)::text AS n FROM public.element",
    );
    const countBefore = Number(before[0]?.n ?? "0");
    console.log(`element rows antes: ${countBefore}`);

    console.log("aplicando migración 015…");
    await client.query(sql);

    const { rows: cons } = await client.query<{
      conname: string;
      confdeltype: string;
    }>(
      `SELECT conname, confdeltype FROM pg_constraint
       WHERE conname = ANY($1)`,
      [EXPECTED],
    );
    for (const c of cons) {
      console.log(`  ${c.conname}: ${c.confdeltype === "c" ? "CASCADE" : c.confdeltype}`);
    }

    const { rows: after } = await client.query<{ n: string }>(
      "SELECT COUNT(*)::text AS n FROM public.element",
    );
    const countAfter = Number(after[0]?.n ?? "0");
    console.log(`element rows después: ${countAfter}`);

    const allCascade =
      EXPECTED.every((name) =>
        cons.some((c) => c.conname === name && c.confdeltype === "c"),
      ) && countAfter === countBefore;
    console.log(allCascade ? "\n✓ Migración 015 OK (4 FK en CASCADE, recuento intacto)." : "\n✗ Revisar.");
    if (!allCascade) process.exitCode = 1;
  });

  await closePgPool();
}

main().catch((err: unknown) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
