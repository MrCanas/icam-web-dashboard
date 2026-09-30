/**
 * Consumo de la API de Anthropic de los informes trimestrales (tabla
 * informe_uso): coste por informe y por tipo de petición, y eficacia de la
 * caché. Es lo que hay que mirar en el piloto para decidir si se baja el
 * esfuerzo (INFORMES_CLAUDE_EFFORT) o se cambia de modelo.
 *
 * Solo lectura.
 *
 *   npm run pm:informes-uso
 *   npm run pm:informes-uso -- --desde 2026-10-01
 */
import { createClient } from "@supabase/supabase-js";

import { cargarEnv } from "./lib/env";

interface Fila {
  informe_id: string | null;
  tipo: string | null;
  modelo: string;
  input_tokens: number;
  output_tokens: number;
  cache_creation_tokens: number;
  cache_read_tokens: number;
  coste_usd: string | number;
  stop_reason: string | null;
  duracion_ms: number | null;
}

function argumento(nombre: string): string | null {
  const i = process.argv.indexOf(nombre);
  return i >= 0 ? (process.argv[i + 1] ?? null) : null;
}

function usd(n: number): string {
  return `${n.toFixed(2)} $`;
}

async function main(): Promise<void> {
  cargarEnv();
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Faltan NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY");
  const supabase = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });

  let consulta = supabase
    .from("informe_uso")
    .select("informe_id, tipo, modelo, input_tokens, output_tokens, cache_creation_tokens, cache_read_tokens, coste_usd, stop_reason, duracion_ms");
  const desde = argumento("--desde");
  if (desde) consulta = consulta.gte("created_at", desde);
  const { data, error } = await consulta;
  if (error) throw new Error(error.message);
  const filas = (data ?? []) as Fila[];
  if (!filas.length) {
    console.log("Sin peticiones registradas.");
    return;
  }

  const agrupar = (clave: (f: Fila) => string) => {
    const m = new Map<string, Fila[]>();
    for (const f of filas) m.set(clave(f), [...(m.get(clave(f)) ?? []), f]);
    return m;
  };
  const coste = (fs: Fila[]) => fs.reduce((s, f) => s + Number(f.coste_usd), 0);

  console.log("Por informe:");
  for (const [id, fs] of [...agrupar((f) => f.informe_id ?? "(sin informe)")].sort()) {
    const cortadas = fs.filter((f) => f.stop_reason === "max_tokens" || f.stop_reason === "refusal").length;
    console.log(`  ${id.padEnd(22)} ${String(fs.length).padStart(4)} peticiones  ${usd(coste(fs)).padStart(10)}${cortadas ? `  (${cortadas} cortadas o rechazadas)` : ""}`);
  }

  console.log("\nPor tipo de petición:");
  for (const [tipo, fs] of [...agrupar((f) => f.tipo ?? "otra")].sort()) {
    const ms = fs.map((f) => f.duracion_ms ?? 0).sort((a, b) => a - b);
    const mediana = ms[Math.floor(ms.length / 2)] ?? 0;
    console.log(`  ${tipo.padEnd(12)} ${String(fs.length).padStart(4)} peticiones  ${usd(coste(fs)).padStart(10)}  media ${usd(coste(fs) / fs.length)}  mediana ${(mediana / 1000).toFixed(0)} s`);
  }

  const leidos = filas.reduce((s, f) => s + f.cache_read_tokens, 0);
  const entrada = filas.reduce((s, f) => s + f.input_tokens + f.cache_read_tokens + f.cache_creation_tokens, 0);
  console.log(
    `\nCaché: ${entrada ? Math.round((100 * leidos) / entrada) : 0} % de los tokens de entrada se leyeron de caché.` +
      `\nTotal: ${filas.length} peticiones, ${usd(coste(filas))} (${[...new Set(filas.map((f) => f.modelo))].join(", ")}).`,
  );
}

main().catch((err: unknown) => {
  console.error(`✗ ${err instanceof Error ? err.message : err}`);
  process.exitCode = 1;
});
