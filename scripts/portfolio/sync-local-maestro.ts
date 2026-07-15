/**
 * Sincroniza la tabla `proyectos` desde el Excel maestro LOCAL vía la API REST de
 * Supabase (service role) llamando a la RPC replace_proyectos (reemplazo atómico).
 *
 * Uso:
 *   npm run portfolio:sync-maestro                 # busca el maestro en la raíz del repo
 *   npm run portfolio:sync-maestro -- ruta.xlsm    # ruta explícita
 *
 * PRERREQUISITO (una sola vez, en Supabase SQL Editor — la conexión directa a la
 * BD no es accesible por IPv4, así que el DDL no puede aplicarse desde este script):
 *   1. supabase/migrations/20260715120000_017_proyectos_yield_credito.sql
 *      (añade columnas entry_yield / exit_yield / credito_total)
 *   2. scripts/supabase/replace_proyectos.sql
 *      (actualiza la función replace_proyectos con esas columnas)
 *
 * Requiere en .env.local: NEXT_PUBLIC_SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY.
 */
import { config } from "dotenv";
import { resolve, join } from "node:path";
import { readFileSync, readdirSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { parseMaestroWorkbook, type ProyectoInsert } from "../../src/modules/portfolio/data/excel-parser";

config({ path: resolve(process.cwd(), ".env.local") });

const REPO_ROOT = process.cwd();

function findMaestro(): string {
  const arg = process.argv[2];
  if (arg) return resolve(arg);
  const match = readdirSync(REPO_ROOT).find(
    (f) => /maestro/i.test(f) && /vehiculos/i.test(f) && /\.xlsm$/i.test(f),
  );
  if (!match) {
    throw new Error(
      "No se encontró el Excel maestro (*MAESTRO*VEHICULOS*.xlsm) en la raíz. Pasa la ruta como argumento.",
    );
  }
  return join(REPO_ROOT, match);
}

/** Serializa filas: sin undefined, null explícito (igual que la ruta upload-excel). */
function serializeRow(r: ProyectoInsert): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  (Object.keys(r) as (keyof ProyectoInsert)[]).forEach((k) => {
    const v = r[k];
    out[k] = v === undefined ? null : v;
  });
  return out;
}

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!url || !key) {
    throw new Error("Faltan NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY en .env.local");
  }

  const maestroPath = findMaestro();
  console.log(`[sync] Excel maestro: ${maestroPath}`);

  const buf = readFileSync(maestroPath);
  const parsed = parseMaestroWorkbook(
    buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength),
  );
  console.log(
    `[sync] Parseadas ${parsed.rows.length} filas (activos: ${parsed.stats.activos}, culminados: ${parsed.stats.culminados}).`,
  );
  const conEntry = parsed.rows.filter((r) => r.entry_yield != null).length;
  const conExit = parsed.rows.filter((r) => r.exit_yield != null).length;
  const conCredito = parsed.rows.filter((r) => r.credito_total != null).length;
  console.log(`[sync] Campos nuevos → entry_yield: ${conEntry} · exit_yield: ${conExit} · credito_total: ${conCredito}`);
  if (parsed.warnings.length) {
    console.log(`[sync] ${parsed.warnings.length} avisos:`);
    parsed.warnings.forEach((w) => console.log("   - " + w));
  }
  if (parsed.rows.length === 0) {
    throw new Error("El Excel no produjo filas con EsUltimaFila = 1. Abortado (no se toca la BD).");
  }

  const sb = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });

  // Verifica que el esquema tiene las columnas nuevas antes de reemplazar.
  const probe = await sb.from("proyectos").select("entry_yield").limit(1);
  if (probe.error) {
    throw new Error(
      `La tabla proyectos no tiene aún la columna entry_yield (${probe.error.message}). ` +
        "Aplica primero el DDL en Supabase SQL Editor (ver cabecera de este script).",
    );
  }

  const payload = parsed.rows.map(serializeRow);
  console.log("[sync] Ejecutando replace_proyectos (reemplazo atómico)…");
  const { error: rpcError } = await sb.rpc("replace_proyectos", { p_rows: payload });
  if (rpcError) {
    throw new Error(`Fallo en replace_proyectos: ${rpcError.message}`);
  }

  // Verificación post-sync.
  const { data, error } = await sb
    .from("proyectos")
    .select("entry_yield,exit_yield,credito_total")
    .eq("es_ultima_fila", 1);
  if (error) {
    console.log(`[sync] OK (no se pudo verificar el recuento: ${error.message})`);
    return;
  }
  const rows = data ?? [];
  const count = (f: (r: (typeof rows)[number]) => unknown) => rows.filter((r) => f(r) != null).length;
  console.log(
    `[sync] OK. Filas es_ultima_fila=1: ${rows.length} · con entry_yield: ${count((r) => r.entry_yield)} · ` +
      `exit_yield: ${count((r) => r.exit_yield)} · credito_total: ${count((r) => r.credito_total)}`,
  );
}

main().catch((e) => {
  console.error("[sync] ERROR:", e instanceof Error ? e.message : e);
  process.exit(1);
});
