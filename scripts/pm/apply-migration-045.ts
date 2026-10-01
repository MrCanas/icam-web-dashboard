/**
 * Aplica la migración 045 — las fotos de los informes pasan a ser del proyecto.
 *
 * Añade informe_foto.codigo (rellenado desde el informe de cada foto), deja
 * informe_id como opcional con ON DELETE SET NULL y crea el disparador que
 * rellena el proyecto en las subidas que no lo indican. Aditiva e idempotente:
 * no borra ni mueve ninguna foto.
 *
 * La verificación comprueba que la migración se puede aplicar dos veces, que
 * todas las fotos tienen proyecto y siguen siendo las mismas, que una subida
 * sin proyecto lo toma de su informe y que al borrar un informe su foto se
 * conserva sin informe.
 *
 * Dry-run por defecto: aplica, verifica y revierte. Escribe con `--apply`.
 *
 *   npm run pm:apply-migration-045
 *   npm run pm:apply-migration-045 -- --apply
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import type { PoolClient } from "pg";

import { closePgPool, withPgClient } from "../actas/lib/db";
import { cargarEnv } from "./lib/env";

const MIGRATION_PATH = resolve(process.cwd(), "supabase/migrations/20261001160000_045_informe_foto_proyecto.sql");

async function verificar(client: PoolClient): Promise<string[]> {
  const problemas: string[] = [];

  const { rows: columnas } = await client.query<{ column_name: string; is_nullable: string }>(
    `SELECT column_name, is_nullable FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'informe_foto' AND column_name IN ('codigo', 'informe_id')`,
  );
  const col = (n: string) => columnas.find((c) => c.column_name === n);
  if (col("codigo")?.is_nullable !== "NO") problemas.push("informe_foto.codigo no es obligatorio");
  if (col("informe_id")?.is_nullable !== "YES") problemas.push("informe_foto.informe_id sigue siendo obligatorio");

  const { rows: fks } = await client.query<{ conname: string; confdeltype: string }>(
    `SELECT conname, confdeltype FROM pg_constraint
      WHERE conrelid = 'public.informe_foto'::regclass AND contype = 'f' AND confrelid = 'public.informe'::regclass`,
  );
  if (fks.length !== 1 || fks[0]!.confdeltype !== "n") {
    problemas.push(`la FK a informe no es única con ON DELETE SET NULL (${fks.map((f) => `${f.conname}:${f.confdeltype}`).join(", ") || "ninguna"})`);
  }

  const { rows: huerfanas } = await client.query<{ n: string }>(
    `SELECT count(*) AS n FROM public.informe_foto f
      WHERE NOT EXISTS (SELECT 1 FROM public.informe i WHERE i.id = f.informe_id AND i.codigo = f.codigo)`,
  );
  if (huerfanas[0]!.n !== "0") problemas.push(`${huerfanas[0]!.n} fotos con un proyecto distinto del de su informe`);

  // Con un proyecto real: una subida sin proyecto lo toma de su informe, y al
  // borrar el informe la foto se queda en el proyecto, sin informe.
  const { rows: proyecto } = await client.query<{ codigo: string }>(`SELECT codigo FROM public.informe_proyecto ORDER BY codigo LIMIT 1`);
  if (proyecto.length) {
    const codigo = proyecto[0]!.codigo;
    await client.query("SAVEPOINT sonda");
    try {
      await client.query(
        `INSERT INTO public.informe (id, codigo, trimestre, trimestre_anterior, siguiente, estado, version)
         VALUES ('__sonda045_Q1-2001', $1, 'Q1 2001', 'Q4 2000', 'Q2 2001', 'datos', 1)`,
        [codigo],
      );
      const { rows: foto } = await client.query<{ id: string; codigo: string | null }>(
        `INSERT INTO public.informe_foto (informe_id, storage_path, mime) VALUES ('__sonda045_Q1-2001', '__sonda045/x.jpg', 'image/jpeg')
         RETURNING id, codigo`,
      );
      if (foto[0]!.codigo !== codigo) problemas.push("una subida sin proyecto no lo toma de su informe");
      await client.query(`DELETE FROM public.informe WHERE id = '__sonda045_Q1-2001'`);
      const { rows: tras } = await client.query<{ informe_id: string | null; codigo: string }>(
        `SELECT informe_id, codigo FROM public.informe_foto WHERE id = $1`,
        [foto[0]!.id],
      );
      if (tras.length !== 1) problemas.push("al borrar un informe se sigue borrando su foto");
      else if (tras[0]!.informe_id !== null || tras[0]!.codigo !== codigo) problemas.push("la foto de un informe borrado no queda en el proyecto sin informe");
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
    aplicar
      ? "APLICANDO la migración 045.\n"
      : "Simulación de la migración 045: se aplica y se revierte.\n" + "Añade --apply para aplicarla de verdad.\n",
  );

  await withPgClient(async (client) => {
    await client.query("BEGIN");
    try {
      const fotos = `SELECT count(*) AS n, coalesce(md5(string_agg(id::text || storage_path, ',' ORDER BY id)), '') AS huella FROM public.informe_foto`;
      const { rows: antes } = await client.query<{ n: string; huella: string }>(fotos);
      await client.query(sql);
      // Segunda pasada: tiene que ser idempotente.
      await client.query(sql);
      const { rows: despues } = await client.query<{ n: string; huella: string }>(fotos);

      const problemas = await verificar(client);
      if (antes[0]!.n !== despues[0]!.n || antes[0]!.huella !== despues[0]!.huella) {
        problemas.push(`las fotos han cambiado (${antes[0]!.n} → ${despues[0]!.n})`);
      }
      for (const p of problemas) console.log(`  ✗ ${p}`);
      if (!problemas.length) console.log(`  ✓ ${despues[0]!.n} fotos intactas, todas con proyecto; FK con SET NULL y disparador de proyecto`);

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
