/**
 * Aplica la migración 016 (project.owner_user_id + element_notification.email_sent_at).
 * Idempotente. Verifica:
 *   - project.owner_user_id existe y su FK queda en 'n' (SET NULL).
 *   - element_notification.email_sent_at existe.
 *   - el recuento de proyectos no cambia (solo añade columnas nullable).
 *
 *   npx tsx scripts/actas/apply-migration-016.ts
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { closePgPool, withPgClient } from "./lib/db";

const MIGRATION_PATH = resolve(
  process.cwd(),
  "supabase/migrations/20260617120000_016_project_owner.sql",
);

async function main(): Promise<void> {
  const sql = readFileSync(MIGRATION_PATH, "utf8");

  await withPgClient(async (client) => {
    const { rows: before } = await client.query<{ n: string }>(
      "SELECT COUNT(*)::text AS n FROM public.project",
    );
    const countBefore = Number(before[0]?.n ?? "0");
    console.log(`project rows antes: ${countBefore}`);

    console.log("aplicando migración 016…");
    await client.query(sql);

    const { rows: ownerCol } = await client.query<{ exists: boolean }>(
      `SELECT EXISTS (
         SELECT 1 FROM information_schema.columns
         WHERE table_schema = 'public' AND table_name = 'project'
           AND column_name = 'owner_user_id'
       ) AS exists`,
    );
    const { rows: emailCol } = await client.query<{ exists: boolean }>(
      `SELECT EXISTS (
         SELECT 1 FROM information_schema.columns
         WHERE table_schema = 'public' AND table_name = 'element_notification'
           AND column_name = 'email_sent_at'
       ) AS exists`,
    );
    const { rows: fk } = await client.query<{ confdeltype: string }>(
      `SELECT confdeltype FROM pg_constraint WHERE conname = 'project_owner_user_id_fkey'`,
    );

    const ownerExists = ownerCol[0]?.exists === true;
    const emailExists = emailCol[0]?.exists === true;
    const fkSetNull = fk[0]?.confdeltype === "n"; // 'n' = SET NULL

    console.log(`  project.owner_user_id: ${ownerExists ? "OK" : "FALTA"}`);
    console.log(
      `  project_owner_user_id_fkey: ${fkSetNull ? "SET NULL" : (fk[0]?.confdeltype ?? "FALTA")}`,
    );
    console.log(`  element_notification.email_sent_at: ${emailExists ? "OK" : "FALTA"}`);

    const { rows: after } = await client.query<{ n: string }>(
      "SELECT COUNT(*)::text AS n FROM public.project",
    );
    const countAfter = Number(after[0]?.n ?? "0");
    console.log(`project rows después: ${countAfter}`);

    const ok =
      ownerExists && emailExists && fkSetNull && countAfter === countBefore;
    console.log(
      ok
        ? "\n✓ Migración 016 OK (columnas creadas, FK SET NULL, recuento intacto)."
        : "\n✗ Revisar.",
    );
    if (!ok) process.exitCode = 1;
  });

  await closePgPool();
}

main().catch((err: unknown) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
