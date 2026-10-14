/**
 * Aplica la migración 050 — historial de revisiones del informe
 * (tabla informe_revision). Aditiva e idempotente: no toca nada existente.
 *
 * La verificación comprueba que la migración se puede aplicar dos veces, que la
 * tabla tiene sus columnas, que una fila de prueba se inserta y se borra con su
 * informe, y que solo admite los tipos de revisión conocidos.
 *
 * Dry-run por defecto: aplica, verifica y revierte. Escribe con `--apply`.
 *
 *   npm run pm:apply-migration-050
 *   npm run pm:apply-migration-050 -- --apply
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import type { PoolClient } from "pg";

import { closePgPool, withPgClient } from "../actas/lib/db";
import { cargarEnv } from "./lib/env";

const MIGRATION_PATH = resolve(process.cwd(), "supabase/migrations/20261014120000_050_informe_revision.sql");

async function verificar(client: PoolClient): Promise<string[]> {
  const problemas: string[] = [];
  const { rows: columnas } = await client.query<{ column_name: string }>(
    `SELECT column_name FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'informe_revision'`,
  );
  const nombres = columnas.map((c) => c.column_name);
  for (const c of ["informe_id", "tipo", "instruccion", "resumen", "slides_antes", "slides_despues", "orden_antes", "deshecha", "user_id", "usuario_nombre", "created_at"]) {
    if (!nombres.includes(c)) problemas.push(`falta la columna informe_revision.${c}`);
  }

  const { rows: proyecto } = await client.query<{ codigo: string }>(`SELECT codigo FROM public.informe_proyecto ORDER BY codigo LIMIT 1`);
  if (proyecto.length) {
    await client.query("SAVEPOINT sonda");
    try {
      await client.query(
        `INSERT INTO public.informe (id, codigo, trimestre, trimestre_anterior, siguiente, estado, version)
         VALUES ('__sonda050_Q1-2001', $1, 'Q1 2001', 'Q4 2000', 'Q2 2001', 'datos', 1)`,
        [proyecto[0]!.codigo],
      );
      await client.query(
        `INSERT INTO public.informe_revision (informe_id, tipo, instruccion, resumen, slides_antes, slides_despues, orden_antes)
         VALUES ('__sonda050_Q1-2001', 'desdoblar', 'Desdobla la slide 5', 'Slide 5 en dos', '[{"id":"obra"}]', '[{"id":"obra"},{"id":"obra-b"}]', '["obra"]')`,
      );
      let rechazado = false;
      await client.query("SAVEPOINT tipo");
      try {
        await client.query(`INSERT INTO public.informe_revision (informe_id, tipo) VALUES ('__sonda050_Q1-2001', 'otro')`);
      } catch {
        rechazado = true;
        await client.query("ROLLBACK TO SAVEPOINT tipo");
      }
      if (!rechazado) problemas.push("admite un tipo de revisión desconocido");
      await client.query(`DELETE FROM public.informe WHERE id = '__sonda050_Q1-2001'`);
      const { rows } = await client.query<{ n: string }>(`SELECT count(*) AS n FROM public.informe_revision WHERE informe_id = '__sonda050_Q1-2001'`);
      if (rows[0]!.n !== "0") problemas.push("al borrar un informe no se borran sus revisiones");
    } catch (err) {
      problemas.push(`la sonda ha fallado: ${err instanceof Error ? err.message : String(err)}`);
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
    aplicar ? "APLICANDO la migración 050.\n" : "Simulación de la migración 050: se aplica y se revierte.\n" + "Añade --apply para aplicarla de verdad.\n",
  );
  await withPgClient(async (client) => {
    await client.query("BEGIN");
    try {
      await client.query(sql);
      // Segunda pasada: tiene que ser idempotente.
      await client.query(sql);
      const problemas = await verificar(client);
      if (problemas.length) {
        await client.query("ROLLBACK");
        console.error("✗ Verificación fallida:\n  - " + problemas.join("\n  - "));
        process.exitCode = 1;
        return;
      }
      if (aplicar) {
        await client.query("COMMIT");
        console.log("✓ Migración 050 aplicada y verificada.");
      } else {
        await client.query("ROLLBACK");
        console.log("✓ Simulación correcta: la migración 050 se aplica y verifica sin problemas. Nada escrito.");
      }
    } catch (err) {
      await client.query("ROLLBACK").catch(() => undefined);
      throw err;
    }
  });
}

main()
  .catch((err: unknown) => {
    console.error(`✗ ${err instanceof Error ? err.message : String(err)}`);
    process.exitCode = 1;
  })
  .finally(() => closePgPool());
