/**
 * Aplica la migración 043 — informes trimestrales para inversores.
 *
 * Crea las tablas del módulo de informes (informe_proyecto, informe,
 * informe_fuente, informe_foto, informe_version, informe_cambio, informe_uso)
 * y el bucket privado `informes-fotos`. Aditiva e idempotente: no toca ninguna
 * tabla existente.
 *
 * La verificación comprueba que la migración se puede aplicar dos veces, que
 * las siete tablas existen con RLS activa y sin políticas (se sirven solo con
 * service role), que el bucket existe y es privado, y que la FK de
 * informe_proyecto.id_activo resuelve contra pm_activos.
 *
 * Dry-run por defecto: aplica, verifica y revierte. Escribe con `--apply`.
 *
 *   npm run pm:apply-migration-043
 *   npm run pm:apply-migration-043 -- --apply
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import type { PoolClient } from "pg";

import { closePgPool, withPgClient } from "../actas/lib/db";
import { cargarEnv } from "./lib/env";

const MIGRATION_PATH = resolve(
  process.cwd(),
  "supabase/migrations/20260930120000_043_informes_trimestrales.sql",
);

const TABLAS = [
  "informe_proyecto",
  "informe",
  "informe_fuente",
  "informe_foto",
  "informe_version",
  "informe_cambio",
  "informe_uso",
];

async function verificar(client: PoolClient): Promise<string[]> {
  const problemas: string[] = [];

  const { rows: tablas } = await client.query<{ relname: string; relrowsecurity: boolean }>(
    `SELECT c.relname, c.relrowsecurity
       FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public' AND c.relname = ANY($1::text[])`,
    [TABLAS],
  );
  for (const t of TABLAS) {
    const fila = tablas.find((x) => x.relname === t);
    if (!fila) problemas.push(`falta la tabla ${t}`);
    else if (!fila.relrowsecurity) problemas.push(`${t} sin RLS`);
  }

  const { rows: politicas } = await client.query<{ tablename: string }>(
    `SELECT tablename FROM pg_policies WHERE schemaname = 'public' AND tablename = ANY($1::text[])`,
    [TABLAS],
  );
  for (const p of politicas) problemas.push(`${p.tablename} tiene políticas: debería servirse solo con service role`);

  const { rows: bucket } = await client.query<{ public: boolean }>(
    `SELECT public FROM storage.buckets WHERE id = 'informes-fotos'`,
  );
  if (!bucket.length) problemas.push("falta el bucket informes-fotos");
  else if (bucket[0]!.public) problemas.push("el bucket informes-fotos es público");

  // La FK con pm_activos: un activo real se acepta, uno inventado no.
  const { rows: activo } = await client.query<{ id_activo: string }>(
    `SELECT id_activo FROM public.pm_activos ORDER BY id_activo LIMIT 1`,
  );
  if (activo.length) {
    await client.query("SAVEPOINT sonda");
    await client.query(
      `INSERT INTO public.informe_proyecto (codigo, id_activo, nombre) VALUES ('__sonda043', $1, 'sonda')`,
      [activo[0]!.id_activo],
    );
    await client.query("ROLLBACK TO SAVEPOINT sonda");
    try {
      await client.query(
        `INSERT INTO public.informe_proyecto (codigo, id_activo, nombre) VALUES ('__sonda043b', '__no_existe__', 'sonda')`,
      );
      problemas.push("la FK informe_proyecto.id_activo acepta un activo inexistente");
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
      ? "APLICANDO la migración 043.\n"
      : "Simulación de la migración 043: se aplica y se revierte.\n" +
          "Añade --apply para aplicarla de verdad.\n",
  );

  await withPgClient(async (client) => {
    await client.query("BEGIN");
    try {
      await client.query(sql);
      // Segunda pasada: tiene que ser idempotente.
      await client.query(sql);

      const problemas = await verificar(client);
      for (const p of problemas) console.log(`  ✗ ${p}`);
      if (!problemas.length) console.log(`  ✓ ${TABLAS.length} tablas con RLS, bucket privado, FK correcta`);

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
