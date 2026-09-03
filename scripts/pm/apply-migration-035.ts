/**
 * Aplica la migración 035 — cerrar las lecturas públicas que la 030 dejó abiertas.
 *
 * Solo toca políticas de RLS, ninguna fila de datos. Idempotente.
 *
 * Por qué existe: la 030 se dio por buena con `pm_hitos` (131 filas) y
 * `pm_snapshot_fechas` (416) todavía legibles desde internet. Su script contaba
 * las políticas restantes por patrón de nombre —y una se llamaba
 * `pm_map_public_read`, fuera de convención— y probaba la anon key contra una
 * lista fija de cinco tablas, ninguna de las que quedaban abiertas.
 *
 * Así que aquí la verificación NO usa listas ni nombres:
 *   · las políticas se buscan por el rol al que alcanzan (`public` / `anon`),
 *   · las tablas a sondear con la anon key se descubren del propio esquema.
 * Si mañana alguien añade una tabla con lectura pública, esto la encuentra.
 *
 * Dry-run por defecto; escribe con `--apply`.
 *
 *   npm run pm:apply-migration-035
 *   npm run pm:apply-migration-035 -- --apply
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { createClient } from "@supabase/supabase-js";
import type { PoolClient } from "pg";

import { closePgPool, withPgClient } from "../actas/lib/db";
import { cargarEnv } from "./lib/env";

const MIGRATION_PATH = resolve(
  process.cwd(),
  "supabase/migrations/20260903100000_035_cerrar_rls_publico_residual.sql",
);

interface PoliticaAbierta {
  tablename: string;
  policyname: string;
  cmd: string;
}

/** Políticas que alcanzan a `public` o `anon`, sea cual sea su nombre. */
async function politicasAbiertas(client: PoolClient): Promise<PoliticaAbierta[]> {
  const { rows } = await client.query<PoliticaAbierta>(
    `SELECT tablename, policyname, cmd
       FROM pg_policies
      WHERE schemaname = 'public'
        AND roles::text[] && ARRAY['public', 'anon']
      ORDER BY tablename, policyname`,
  );
  return rows;
}

/** Tablas del esquema public sin RLS: expuestas aunque no tengan política. */
async function tablasSinRls(client: PoolClient): Promise<string[]> {
  const { rows } = await client.query<{ relname: string }>(
    `SELECT c.relname
       FROM pg_class c
       JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public' AND c.relkind = 'r' AND NOT c.relrowsecurity
      ORDER BY c.relname`,
  );
  return rows.map((r) => r.relname);
}

/** Todas las tablas del esquema, para sondearlas sin depender de una lista. */
async function todasLasTablas(client: PoolClient): Promise<string[]> {
  const { rows } = await client.query<{ relname: string }>(
    `SELECT c.relname
       FROM pg_class c
       JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public' AND c.relkind = 'r'
      ORDER BY c.relname`,
  );
  return rows.map((r) => r.relname);
}

/**
 * Sondeo real con la anon key sobre TODAS las tablas. Devuelve las que devuelven
 * filas: es la única prueba que no depende de cómo se llamen las políticas.
 *
 * Ojo con el falso negativo: una tabla vacía sale a 0 filas aunque su política
 * siga abierta. Por eso el veredicto combina esto con `politicasAbiertas`.
 */
async function sondearConAnonKey(tablas: string[]): Promise<{ tabla: string; filas: number }[]> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();
  if (!url || !anon) {
    throw new Error("Faltan NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY para verificar");
  }
  const anonClient = createClient(url, anon, { auth: { persistSession: false } });
  const expuestas: { tabla: string; filas: number }[] = [];
  for (const tabla of tablas) {
    const { count, error } = await anonClient.from(tabla).select("*", { count: "exact", head: true });
    if (!error && (count ?? 0) > 0) expuestas.push({ tabla, filas: count ?? 0 });
  }
  return expuestas;
}

function pintarPoliticas(politicas: PoliticaAbierta[]): void {
  for (const p of politicas) {
    console.log(`    ${p.cmd.padEnd(6)} ${p.tablename.padEnd(36)} ${p.policyname}`);
  }
}

async function main(): Promise<void> {
  cargarEnv();
  const apply = process.argv.includes("--apply");
  const sql = readFileSync(MIGRATION_PATH, "utf8");

  await withPgClient(async (client) => {
    const antesPoliticas = await politicasAbiertas(client);
    const antesSinRls = await tablasSinRls(client);

    console.log("— antes —");
    console.log(`  políticas abiertas a public/anon: ${antesPoliticas.length}`);
    pintarPoliticas(antesPoliticas);
    console.log(`  tablas sin RLS: ${antesSinRls.length}${antesSinRls.length ? " → " + antesSinRls.join(", ") : ""}`);

    const tablas = await todasLasTablas(client);
    const antesExpuestas = await sondearConAnonKey(tablas);
    console.log(`\n  sondeo con la anon key sobre ${tablas.length} tablas: ${antesExpuestas.length} devuelven filas`);
    for (const e of antesExpuestas) {
      console.log(`    ✗ ${e.tabla.padEnd(36)} ${e.filas} fila(s)`);
    }

    if (!apply) {
      console.log("\nDry-run. Repite con --apply para escribir.");
      return;
    }

    console.log("\naplicando migración 035…");
    await client.query(sql);

    const despuesPoliticas = await politicasAbiertas(client);
    const despuesSinRls = await tablasSinRls(client);
    const despuesExpuestas = await sondearConAnonKey(tablas);

    console.log("\n— después —");
    console.log(`  políticas abiertas a public/anon: ${despuesPoliticas.length}`);
    pintarPoliticas(despuesPoliticas);
    console.log(`  tablas sin RLS: ${despuesSinRls.length}${despuesSinRls.length ? " → " + despuesSinRls.join(", ") : ""}`);

    console.log(`\n— sondeo con la anon key (sin sesión), ${tablas.length} tablas —`);
    if (despuesExpuestas.length === 0) {
      console.log("  ✓ ninguna tabla devuelve filas a un visitante sin sesión");
    } else {
      for (const e of despuesExpuestas) {
        console.log(`  ✗ ${e.tabla.padEnd(36)} ${e.filas} fila(s) visibles`);
      }
    }

    const ok =
      despuesPoliticas.length === 0 && despuesSinRls.length === 0 && despuesExpuestas.length === 0;
    console.log(
      ok
        ? "\n✓ Migración 035 OK. Ninguna política alcanza a public/anon y el sondeo sale limpio."
        : "\n✗ Revisar: algo sigue expuesto.",
    );
    if (!ok) process.exitCode = 1;
  });

  await closePgPool();
}

main().catch((err: unknown) => {
  console.error(err instanceof Error ? err.message : err);
  process.exitCode = 1;
});
