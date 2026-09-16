/**
 * Aplica la migración 040 — el espejo de Inversores.
 *
 * Crea las seis tablas espejo, el catálogo de mapeo y el log, deja las ocho con
 * RLS y sin política de SELECT, y siembra la denegación de
 * `portfolio.inversores` para todos los usuarios que existan hoy.
 *
 * Aditiva e idempotente: `CREATE TABLE IF NOT EXISTS`, `ON CONFLICT DO NOTHING`
 * y ningún DROP ni DELETE. No toca ninguna tabla existente salvo para añadir
 * filas a `app_user_route_deny`.
 *
 * Dry-run por defecto: ejecuta la migración DOS veces dentro de una transacción
 * y la revierte. Dos veces porque así se comprueba de verdad que es idempotente
 * —que es la propiedad de la que depende poder volver a pasarla— en lugar de
 * suponerlo leyendo el SQL.
 *
 *   npm run inversores:apply-migration-040
 *   npm run inversores:apply-migration-040 -- --apply
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import type { PoolClient } from "pg";

import { closePgPool, withPgClient } from "../actas/lib/db";
import { cargarEnv } from "../pm/lib/env";

const MIGRATION_PATH = resolve(
  process.cwd(),
  "supabase/migrations/20260916120000_040_inversores.sql",
);

const TABLAS = [
  "inv_campo_catalogo",
  "inv_cuentas",
  "inv_contactos",
  "inv_cuenta_contacto",
  "inv_promociones",
  "inv_cuenta_promocion",
  "inv_flujos",
  "inv_sync_log",
];

async function tablasCreadas(client: PoolClient): Promise<string[]> {
  const { rows } = await client.query<{ table_name: string }>(
    `SELECT table_name FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = ANY($1)
      ORDER BY table_name`,
    [TABLAS],
  );
  return rows.map((r) => r.table_name);
}

async function contar(client: PoolClient, sql: string): Promise<number> {
  const { rows } = await client.query<{ n: number }>(sql);
  return rows[0]?.n ?? 0;
}

/** Tablas con RLS activa. Las que falten quedarían abiertas a `authenticated`. */
async function conRls(client: PoolClient): Promise<string[]> {
  const { rows } = await client.query<{ relname: string }>(
    `SELECT c.relname FROM pg_class c
       JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public' AND c.relname = ANY($1) AND c.relrowsecurity
      ORDER BY c.relname`,
    [TABLAS],
  );
  return rows.map((r) => r.relname);
}

/** Políticas sobre las tablas del espejo. Aquí NO debe haber ninguna. */
async function politicas(client: PoolClient): Promise<string[]> {
  const { rows } = await client.query<{ tablename: string; policyname: string }>(
    `SELECT tablename, policyname FROM pg_policies
      WHERE schemaname = 'public' AND tablename = ANY($1)`,
    [TABLAS],
  );
  return rows.map((r) => `${r.tablename}.${r.policyname}`);
}

async function verificar(client: PoolClient): Promise<boolean> {
  const tablas = await tablasCreadas(client);
  const faltan = TABLAS.filter((t) => !tablas.includes(t));
  console.log(`\nTablas: ${tablas.length}/${TABLAS.length}`);
  if (faltan.length > 0) console.log(`  ✗ faltan: ${faltan.join(", ")}`);

  const rls = await conRls(client);
  const sinRls = TABLAS.filter((t) => !rls.includes(t));
  console.log(`RLS activa en ${rls.length}/${TABLAS.length}`);
  if (sinRls.length > 0) console.log(`  ✗ SIN RLS: ${sinRls.join(", ")}`);

  const pols = await politicas(client);
  console.log(
    pols.length === 0
      ? "Políticas sobre inv_*: ninguna ✓ (solo service role, como corp_periodos)"
      : `  ✗ hay políticas que NO debería haber: ${pols.join(", ")}`,
  );

  const catalogo = await contar(client, "SELECT count(*)::int AS n FROM public.inv_campo_catalogo");
  const sinResolver = await contar(
    client,
    "SELECT count(*)::int AS n FROM public.inv_campo_catalogo WHERE zoho_api_name IS NULL",
  );
  const obligatorios = await contar(
    client,
    "SELECT count(*)::int AS n FROM public.inv_campo_catalogo WHERE obligatorio AND zoho_api_name IS NULL",
  );
  console.log(
    `Catálogo de campos: ${catalogo} filas · ${sinResolver} sin resolver (${obligatorios} obligatorias)`,
  );

  // Lo que de verdad importa comprobar no es cuántos están denegados, sino
  // QUIÉN se queda viéndola. Un recuento cuadra igual con la lista equivocada.
  const { rows: pueden } = await client.query<{ email: string }>(
    `SELECT u.email
       FROM auth.users u
       JOIN public.app_user_zone_role r ON r.user_id = u.id AND r.zone_key = 'financiero'
      WHERE NOT EXISTS (
              SELECT 1 FROM public.app_user_route_deny d
               WHERE d.user_id = u.id AND d.route_key = 'portfolio.inversores')
      ORDER BY u.email`,
  );
  const usuarios = await contar(client, "SELECT count(*)::int AS n FROM auth.users");
  const denegados = await contar(
    client,
    "SELECT count(DISTINCT user_id)::int AS n FROM public.app_user_route_deny WHERE route_key = 'portfolio.inversores'",
  );
  console.log(`Usuarios: ${usuarios} · denegados: ${denegados}`);
  console.log(`Ven Inversores (${pueden.length}):`);
  for (const p of pueden) console.log(`  · ${p.email}`);

  const esperados = [
    "javiercanas@imparcapital.com",
    "robertoperri@imparcapital.com",
    "emilianoguerrero@imparcapital.com",
  ].sort();
  const reales = pueden.map((p) => p.email.toLowerCase()).sort();
  const listaOk = reales.length === esperados.length && reales.every((e, i) => e === esperados[i]);
  if (!listaOk) console.log("  ✗ La lista NO es la esperada.");

  return faltan.length === 0 && sinRls.length === 0 && pols.length === 0 && catalogo > 0 && listaOk;
}

async function main(): Promise<void> {
  cargarEnv();
  const aplicar = process.argv.includes("--apply");
  const sql = readFileSync(MIGRATION_PATH, "utf8");

  console.log(
    aplicar
      ? "APLICANDO la migración 040.\n"
      : "Simulación de la migración 040: se ejecuta y se revierte. Nada queda escrito.\n" +
          "Añade --apply para aplicarla de verdad.\n",
  );

  await withPgClient(async (client) => {
    await client.query("BEGIN");
    try {
      await client.query(sql);

      if (!aplicar) {
        // Segunda pasada: si algo duplicara o fallara al repetirse, sale aquí.
        const antes = await contar(
          client,
          "SELECT count(*)::int AS n FROM public.inv_campo_catalogo",
        );
        await client.query(sql);
        const despues = await contar(
          client,
          "SELECT count(*)::int AS n FROM public.inv_campo_catalogo",
        );
        console.log(
          antes === despues
            ? `Idempotencia: el catálogo sigue en ${despues} filas tras repetirla ✓`
            : `✗ NO es idempotente: el catálogo pasó de ${antes} a ${despues} filas`,
        );
      }

      const ok = await verificar(client);

      if (aplicar && ok) {
        await client.query("COMMIT");
        console.log("\n✓ Migración aplicada.");
        console.log("  Siguiente paso: npm run inversores:zoho-descubrir");
        return;
      }

      await client.query("ROLLBACK");
      console.log(
        aplicar
          ? "\n✗ La verificación falló: ROLLBACK. La base queda como estaba."
          : "\n✓ Simulación correcta: ROLLBACK hecho, la base queda como estaba.",
      );
      if (aplicar) process.exitCode = 1;
    } catch (err) {
      await client.query("ROLLBACK");
      throw err;
    }
  });

  await closePgPool();
}

// Ver la nota de zoho-auth.ts sobre process.exitCode en Windows.
main().catch((err: unknown) => {
  console.error(`✗ ${err instanceof Error ? err.message : err}`);
  process.exitCode = 1;
});
