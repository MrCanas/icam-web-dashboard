/**
 * Aplica la migración 030 — cerrar el acceso anónimo de la RLS temporal.
 *
 * Solo toca políticas de RLS, ninguna fila de datos. Idempotente.
 *
 * La verificación es lo importante: tras aplicar, se conecta con la ANON KEY
 * real (la que va en el navegador, sin sesión) y comprueba que ya NO puede leer
 * las tablas sensibles. Es la prueba de que el agujero está cerrado de verdad,
 * no solo de que el SQL corrió.
 *
 * Dry-run por defecto; escribe con `--apply`.
 *
 *   npm run pm:apply-migration-030
 *   npm run pm:apply-migration-030 -- --apply
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { createClient } from "@supabase/supabase-js";
import type { PoolClient } from "pg";

import { closePgPool, withPgClient } from "../actas/lib/db";
import { cargarEnv } from "./lib/env";

const MIGRATION_PATH = resolve(
  process.cwd(),
  "supabase/migrations/20260819160000_030_cerrar_rls_publico.sql",
);

/** Tablas que NO debe poder leer un cliente anónimo tras la migración. */
const TABLAS_SENSIBLES = [
  "proyectos",
  "audit_log",
  "pm_avance_obra",
  "pm_promociones",
  "monday_sync_logs",
];

async function contarPoliticasPermisivas(client: PoolClient): Promise<number> {
  const { rows } = await client.query<{ n: string }>(
    `SELECT COUNT(*)::text AS n FROM pg_policies
      WHERE schemaname = 'public' AND policyname IN ('temp_allow_all', 'temp_allow_all_audit')`,
  );
  return Number(rows[0]?.n ?? "0");
}

async function contarLecturasPublicas(client: PoolClient): Promise<number> {
  const { rows } = await client.query<{ n: string }>(
    `SELECT COUNT(*)::text AS n FROM pg_policies
      WHERE schemaname = 'public' AND cmd = 'SELECT'
        AND 'public' = ANY(roles) AND policyname LIKE '%_public_read'`,
  );
  return Number(rows[0]?.n ?? "0");
}

/** Prueba real con la anon key: ¿qué ve un visitante sin sesión? */
async function verificarConAnonKey(): Promise<{ tabla: string; filas: number | "bloqueada" }[]> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();
  if (!url || !anon) {
    throw new Error("Faltan NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY para verificar");
  }
  const anonClient = createClient(url, anon, { auth: { persistSession: false } });
  const resultados: { tabla: string; filas: number | "bloqueada" }[] = [];
  for (const tabla of TABLAS_SENSIBLES) {
    const { data, error } = await anonClient.from(tabla).select("*").limit(1);
    resultados.push({
      tabla,
      filas: error ? "bloqueada" : (data?.length ?? 0),
    });
  }
  return resultados;
}

async function main(): Promise<void> {
  cargarEnv();
  const apply = process.argv.includes("--apply");
  const sql = readFileSync(MIGRATION_PATH, "utf8");

  await withPgClient(async (client) => {
    console.log("— antes —");
    console.log(`  políticas temp_allow_all: ${await contarPoliticasPermisivas(client)}`);
    console.log(`  lecturas públicas (_public_read): ${await contarLecturasPublicas(client)}`);

    if (!apply) {
      console.log("\nDry-run. Repite con --apply para escribir.");
      return;
    }

    console.log("\naplicando migración 030…");
    await client.query(sql);

    const permisivas = await contarPoliticasPermisivas(client);
    const publicas = await contarLecturasPublicas(client);
    console.log("\n— después —");
    console.log(`  políticas temp_allow_all: ${permisivas}`);
    console.log(`  lecturas públicas (_public_read): ${publicas}`);

    console.log("\n— prueba con la anon key (sin sesión) —");
    const anon = await verificarConAnonKey();
    let expuesta = false;
    for (const r of anon) {
      const ok = r.filas === "bloqueada" || r.filas === 0;
      if (!ok) expuesta = true;
      console.log(`  ${ok ? "✓" : "✗"} ${r.tabla.padEnd(20)} ${r.filas === "bloqueada" ? "sin acceso" : `${r.filas} fila(s) visibles`}`);
    }

    const ok = permisivas === 0 && publicas === 0 && !expuesta;
    console.log(
      ok
        ? "\n✓ Migración 030 OK. El acceso anónimo a las tablas sensibles está cerrado."
        : "\n✗ Revisar: algo sigue expuesto a la anon key.",
    );
    if (!ok) process.exitCode = 1;
  });

  await closePgPool();
}

main().catch((err: unknown) => {
  console.error(err instanceof Error ? err.message : err);
  process.exitCode = 1;
});
