/**
 * Aplica la migración 044 — apartado «No reportar» de los informes trimestrales.
 *
 * Amplía la restricción de tipos de informe_fuente para admitir «no_reportar»
 * (lo que la PM pide dejar fuera del informe). Aditiva e idempotente: no toca
 * ninguna fila.
 *
 * La verificación comprueba que la migración se puede aplicar dos veces, que
 * una fuente «no_reportar» se acepta, que un tipo inventado se sigue
 * rechazando y que ninguna fila existente queda fuera de la restricción.
 *
 * Dry-run por defecto: aplica, verifica y revierte. Escribe con `--apply`.
 *
 *   npm run pm:apply-migration-044
 *   npm run pm:apply-migration-044 -- --apply
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import type { PoolClient } from "pg";

import { closePgPool, withPgClient } from "../actas/lib/db";
import { cargarEnv } from "./lib/env";

const MIGRATION_PATH = resolve(
  process.cwd(),
  "supabase/migrations/20261001120000_044_informe_fuente_no_reportar.sql",
);

async function verificar(client: PoolClient): Promise<string[]> {
  const problemas: string[] = [];

  const { rows: restriccion } = await client.query<{ def: string }>(
    `SELECT pg_get_constraintdef(c.oid) AS def
       FROM pg_constraint c
      WHERE c.conname = 'informe_fuente_tipo_chk' AND c.conrelid = 'public.informe_fuente'::regclass`,
  );
  if (!restriccion.length) problemas.push("falta la restricción informe_fuente_tipo_chk");
  else if (!restriccion[0]!.def.includes("no_reportar")) problemas.push("la restricción no admite «no_reportar»");

  // Con un informe real: «no_reportar» se acepta y un tipo inventado no.
  const { rows: informe } = await client.query<{ id: string }>(`SELECT id FROM public.informe ORDER BY id LIMIT 1`);
  if (informe.length) {
    await client.query("SAVEPOINT sonda");
    try {
      await client.query(
        `INSERT INTO public.informe_fuente (informe_id, tipo, nombre, texto) VALUES ($1, 'no_reportar', 'sonda 044', 'sonda')`,
        [informe[0]!.id],
      );
    } catch (err) {
      problemas.push(`una fuente «no_reportar» se rechaza: ${err instanceof Error ? err.message : String(err)}`);
    }
    await client.query("ROLLBACK TO SAVEPOINT sonda");
    try {
      await client.query(
        `INSERT INTO public.informe_fuente (informe_id, tipo, nombre, texto) VALUES ($1, '__inventado__', 'sonda 044', 'sonda')`,
        [informe[0]!.id],
      );
      problemas.push("la restricción acepta un tipo de fuente inventado");
    } catch {
      // Esperado.
    }
    await client.query("ROLLBACK TO SAVEPOINT sonda");
  }

  return problemas;
}

async function main(): Promise<void> {
  cargarEnv();
  const aplicar = process.argv.includes("--apply");
  const sql = readFileSync(MIGRATION_PATH, "utf8");

  console.log(
    aplicar
      ? "APLICANDO la migración 044.\n"
      : "Simulación de la migración 044: se aplica y se revierte.\n" +
          "Añade --apply para aplicarla de verdad.\n",
  );

  await withPgClient(async (client) => {
    await client.query("BEGIN");
    try {
      const { rows: antes } = await client.query<{ n: string }>(`SELECT count(*) AS n FROM public.informe_fuente`);
      await client.query(sql);
      // Segunda pasada: tiene que ser idempotente.
      await client.query(sql);
      const { rows: despues } = await client.query<{ n: string }>(`SELECT count(*) AS n FROM public.informe_fuente`);

      const problemas = await verificar(client);
      if (antes[0]!.n !== despues[0]!.n) problemas.push(`las filas de informe_fuente han cambiado (${antes[0]!.n} → ${despues[0]!.n})`);
      for (const p of problemas) console.log(`  ✗ ${p}`);
      if (!problemas.length) console.log(`  ✓ informe_fuente admite «no_reportar»; ${despues[0]!.n} filas intactas`);

      const ok = problemas.length === 0;
      if (aplicar && ok) {
        await client.query("COMMIT");
        console.log("\n✓ Migración aplicada.");
        return;
      }
      await client.query("ROLLBACK");
      console.log(
        aplicar
          ? `\n✗ La verificación falló (${problemas.length}): ROLLBACK.`
          : ok
            ? "\n✓ Simulación correcta: ROLLBACK hecho."
            : `\n✗ Simulación con ${problemas.length} problemas: ROLLBACK hecho.`,
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
