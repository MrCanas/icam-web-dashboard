/**
 * Carga `corp_periodos` (y el glosario y las notas) desde el maestro corporativo
 * LOCAL, vía la API REST de Supabase con service role, llamando a las RPC de
 * reemplazo atómico de la migración 038.
 *
 * Es la vía práctica mientras la sincronización desde SharePoint no pueda escribir:
 * el cron ya descarga el fichero, pero la cuota de egress de Supabase la corta con
 * HTTP 402. Este script hace lo mismo desde el Excel que ya está en disco.
 *
 * Uso:
 *   npm run corporativo:sync-maestro -- --dry-run          # parsea y no toca la BD
 *   npm run corporativo:sync-maestro                       # busca el maestro
 *   npm run corporativo:sync-maestro -- ruta.xlsx          # ruta explícita
 *
 * Busca el fichero, por este orden, en: la ruta pasada como argumento, la variable
 * MAESTRO_CORPORATIVO_PATH, la raíz del repo y la carpeta MAESTRO de SharePoint
 * sincronizada en local.
 *
 * Requiere en .env.local: NEXT_PUBLIC_SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY
 * (salvo con --dry-run, que no se conecta).
 */
import { config } from "dotenv";
import { createClient } from "@supabase/supabase-js";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { homedir } from "node:os";
import { join, resolve } from "node:path";

import { parseCorporativoWorkbook } from "../../src/modules/corporativo/data/corporativo-excel-parser";

config({ path: resolve(process.cwd(), ".env.local") });

const NOMBRE_RE = /maestro.*corporativo.*\.xls[xmb]$/i;

const args = process.argv.slice(2);
const dryRun = args.includes("--dry-run");
const rutaArg = args.find((a) => !a.startsWith("--"));

function buscarEnCarpeta(dir: string): string | null {
  if (!existsSync(dir)) return null;
  const match = readdirSync(dir).find((f) => NOMBRE_RE.test(f));
  return match ? join(dir, match) : null;
}

function localizarMaestro(): string {
  if (rutaArg) return resolve(rutaArg);

  const porEntorno = process.env.MAESTRO_CORPORATIVO_PATH?.trim();
  if (porEntorno) return resolve(porEntorno);

  const candidatos = [
    process.cwd(),
    join(homedir(), "Impar Capital", "Capital - General", "MAESTRO"),
  ];
  for (const dir of candidatos) {
    const encontrado = buscarEnCarpeta(dir);
    if (encontrado) return encontrado;
  }

  throw new Error(
    "No se encontró el maestro corporativo (*MAESTRO*CORPORATIVO*.xlsx). " +
      "Pasa la ruta como argumento o define MAESTRO_CORPORATIVO_PATH.",
  );
}

function fmt(n: number | null | undefined): string {
  return n == null ? "—" : new Intl.NumberFormat("es-ES", { maximumFractionDigits: 0 }).format(n);
}

async function main() {
  const ruta = localizarMaestro();
  console.log(`[corp] Maestro: ${ruta}`);

  const buf = readFileSync(ruta);
  const parsed = parseCorporativoWorkbook(
    buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) as ArrayBuffer,
  );

  console.log(
    `[corp] ${parsed.rows.length} filas · ${parsed.stats.columnasReconocidas}/46 columnas reconocidas · ` +
      `${parsed.diccionario.length} entradas de glosario · ${parsed.notas.length} notas`,
  );
  console.log(`[corp] Por tipo de periodo: ${JSON.stringify(parsed.stats.porTipoPeriodo)}`);
  console.log(`[corp] Por sociedad:        ${JSON.stringify(parsed.stats.porSociedad)}`);
  console.log(`[corp] Último real:         ${parsed.stats.ultimosPeriodosReales.join(" · ")}`);

  if (parsed.warnings.length) {
    console.log(`[corp] ${parsed.warnings.length} aviso(s):`);
    parsed.warnings.forEach((w) => console.log("   - " + w));
  }

  // Contraste rápido contra cifras conocidas del maestro, para que un error de
  // parseo se vea aquí y no tres pantallas más abajo.
  const grupo2025 = parsed.rows.find((f) => f.id === "GRUPO|2025");
  const grupoUltimo = parsed.rows.find((f) => f.sociedad === "GRUPO" && f.es_ultima_fila === 1);
  console.log(
    `[corp] Control · GRUPO 2025: facturación ${fmt(grupo2025?.facturacion)} € · ` +
      `EBITDA ${fmt(grupo2025?.ebitda)} €`,
  );
  console.log(
    `[corp] Control · GRUPO ${grupoUltimo?.periodo ?? "?"}: AUM ${fmt(grupoUltimo?.capital_bajo_gestion)} € · ` +
      `${fmt(grupoUltimo?.n_vehiculos)} vehículos`,
  );

  if (dryRun) {
    console.log("[corp] --dry-run: la base de datos no se ha tocado.");
    return;
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!url || !key) {
    throw new Error("Faltan NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY en .env.local");
  }
  const sb = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });

  console.log("[corp] replace_corp_periodos (reemplazo atómico)…");
  const { error } = await sb.rpc("replace_corp_periodos", { p_rows: parsed.rows });
  if (error) {
    throw new Error(
      `Fallo en replace_corp_periodos: ${error.message}. ` +
        "¿Está aplicada supabase/migrations/20260908120000_038_corporativo.sql?",
    );
  }

  // Glosario y notas no son críticos: si fallan, se avisa y se sigue.
  if (parsed.diccionario.length) {
    const r = await sb.rpc("replace_corp_diccionario", { p_rows: parsed.diccionario });
    if (r.error) console.warn(`[corp] Aviso · glosario no cargado: ${r.error.message}`);
  }
  if (parsed.notas.length) {
    const r = await sb.rpc("replace_corp_notas", { p_rows: parsed.notas });
    if (r.error) console.warn(`[corp] Aviso · notas no cargadas: ${r.error.message}`);
  }

  const { count, error: countError } = await sb
    .from("corp_periodos")
    .select("id", { count: "exact", head: true });
  if (countError) {
    console.log(`[corp] OK (no se pudo verificar el recuento: ${countError.message})`);
    return;
  }
  console.log(`[corp] OK. Filas en corp_periodos: ${count}`);
}

main().catch((e) => {
  console.error("[corp] ERROR:", e instanceof Error ? e.message : e);
  process.exit(1);
});
