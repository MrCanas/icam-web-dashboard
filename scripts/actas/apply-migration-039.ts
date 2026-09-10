/**
 * Aplica la migración 039 (políticas DELETE para category/element). Solo
 * metadatos; verifica que las dos políticas quedan creadas para el rol
 * `authenticated` y que el recuento de filas no cambia. Idempotente.
 *
 *   npx tsx scripts/actas/apply-migration-039.ts
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { closePgPool, withPgClient } from "./lib/db";

const MIGRATION_PATH = resolve(
  process.cwd(),
  "supabase/migrations/20260910120000_039_actas_category_element_delete_policy.sql",
);

const EXPECTED = [
  { table: "category", policy: "category_delete_org_member" },
  { table: "element", policy: "element_delete_org_member" },
];

async function main(): Promise<void> {
  const sql = readFileSync(MIGRATION_PATH, "utf8");

  await withPgClient(async (client) => {
    const { rows: before } = await client.query<{ n: string }>(
      "SELECT (SELECT COUNT(*) FROM public.category)::text AS n",
    );
    const countBefore = before[0]?.n ?? "0";
    console.log(`category rows antes: ${countBefore}`);

    console.log("aplicando migración 039…");
    await client.query(sql);

    const { rows: pols } = await client.query<{
      tablename: string;
      policyname: string;
      cmd: string;
      roles: string[];
    }>(
      `SELECT tablename, policyname, cmd, roles
         FROM pg_policies
        WHERE schemaname = 'public'
          AND policyname = ANY($1)`,
      [EXPECTED.map((e) => e.policy)],
    );
    for (const p of pols) {
      console.log(
        `  ${p.tablename}.${p.policyname}: cmd=${p.cmd} roles=${p.roles.join(",")}`,
      );
    }

    const { rows: after } = await client.query<{ n: string }>(
      "SELECT (SELECT COUNT(*) FROM public.category)::text AS n",
    );
    const countAfter = after[0]?.n ?? "0";
    console.log(`category rows después: ${countAfter}`);

    const allOk =
      EXPECTED.every((e) =>
        pols.some(
          (p) =>
            p.tablename === e.table &&
            p.policyname === e.policy &&
            p.cmd === "DELETE" &&
            p.roles.includes("authenticated"),
        ),
      ) && countAfter === countBefore;

    console.log(
      allOk
        ? "\n✓ Migración 039 OK (2 políticas DELETE creadas, recuento intacto)."
        : "\n✗ Revisar.",
    );
    if (!allOk) process.exitCode = 1;
  });

  await closePgPool();
}

main().catch((err: unknown) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
