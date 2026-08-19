/**
 * Carga el avance de obra de Zoho en Supabase (migración 028).
 *
 * Idempotente y re-ejecutable: la PMO volverá a descargar el export de Zoho, así
 * que esto no es una migración de datos, es una importación.
 *
 * LA REGLA QUE IMPORTA: reimportar NO pisa lo que la PMO haya editado en el
 * portal. `pm_avance_importar_zoho` refresca siempre `porcentaje_zoho` (la línea
 * base del diff) pero solo toca `porcentaje` si el valor vigente venía del propio
 * Zoho. Y si Zoho ya trae el valor que había propuesto la PMO, el cambio
 * pendiente se cierra como «descartado» en vez de quedarse encallado.
 *
 * Dry-run por defecto; escribe con `--apply`.
 *
 *   npm run pm:seed-avance-obra
 *   npm run pm:seed-avance-obra -- --apply
 *   npm run pm:seed-avance-obra -- --xlsx "C:/.../KPI_AvanceProyectos_Promociones.xlsx"
 *
 * `--xlsx` reparsea el fichero real y muestra el diff contra el fixture
 * versionado SIN escribir en la base: refrescar el fixture tiene que ser una
 * operación revisable, no un `git diff` de 400 líneas a ciegas.
 */
import { readFileSync } from "node:fs";

import type { PoolClient } from "pg";
import * as XLSX from "xlsx";

import {
  AUTOLINK_PROMOCION_POR_ACTIVO,
  resolveAutolink,
} from "../../src/modules/pm/avance/logic/avance-autolink";
import { parsePorcentajeZoho } from "../../src/modules/pm/avance/logic/avance-obra";
import { closePgPool, withPgClient } from "../actas/lib/db";
import {
  COLUMNAS_FASE,
  FUENTE_ARCHIVO,
  PROMOCIONES_ZOHO_SEED,
  type PromocionZohoSeed,
} from "./data/avance-obra-promociones";

// ---------------------------------------------------------------------------
// Reparseo opcional del .xlsx
// ---------------------------------------------------------------------------

/**
 * Zoho Analytics exporta parte del texto doble codificado («RamÃ³n» por
 * «Ramón»). Solo se repara lo que hace el viaje completo latin-1 → utf-8;
 * «Coruña», que ya es correcto, no sobrevive al encode y se queda igual.
 */
function desmojibake(s: string): string {
  try {
    const bytes = Uint8Array.from(s, (c) => {
      const code = c.codePointAt(0) ?? 0;
      if (code > 0xff) throw new Error("fuera de latin-1");
      return code;
    });
    const decoded = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
    return decoded;
  } catch {
    return s;
  }
}

/** Además del mojibake, el export cuela algún soft hyphen («Gran Ví­a 61»). */
function limpia(v: unknown): string {
  if (v === null || v === undefined) return "";
  return desmojibake(String(v)).replace(/\u00ad/g, "").trim().replace(/\s+/g, " ");
}

function leerXlsx(ruta: string): PromocionZohoSeed[] {
  const wb = XLSX.read(readFileSync(ruta), { type: "buffer" });
  const hoja = wb.Sheets[wb.SheetNames[0]];
  const filas = XLSX.utils.sheet_to_json<Record<string, unknown>>(hoja, { defval: null });

  return filas.map((raw) => {
    const fila: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(raw)) fila[limpia(k)] = v;

    const analytics = limpia(fila["Record Id"]);
    const valores: Record<string, number | null> = {};
    for (const col of COLUMNAS_FASE) {
      const p = parsePorcentajeZoho(fila[col]);
      if (!p.ok) throw new Error(`${limpia(fila["Código de Promoción"])} · ${col}: ${p.error}`);
      valores[col] = p.value;
    }
    return {
      zohoAnalyticsId: analytics,
      zohoRecordId: analytics.replace(/^zcrm_/, ""),
      codigo: limpia(fila["Código de Promoción"]),
      nombre: limpia(fila["Nombre Promoción"]),
      ownerZohoId: limpia(fila["Promoción Owner.id"]) || null,
      situacion: limpia(fila["Situación"]),
      valores,
    };
  });
}

function diffContraFixture(reciente: PromocionZohoSeed[]): void {
  const porCodigo = new Map(PROMOCIONES_ZOHO_SEED.map((p) => [p.codigo, p]));
  let cambios = 0;

  for (const nueva of reciente) {
    const vieja = porCodigo.get(nueva.codigo);
    if (!vieja) {
      console.log(`+ ${nueva.codigo} · ${nueva.nombre} (promoción nueva)`);
      cambios++;
      continue;
    }
    porCodigo.delete(nueva.codigo);
    if (vieja.nombre !== nueva.nombre) {
      console.log(`~ ${nueva.codigo} nombre: «${vieja.nombre}» → «${nueva.nombre}»`);
      cambios++;
    }
    if (vieja.situacion !== nueva.situacion) {
      console.log(`~ ${nueva.codigo} situación: ${vieja.situacion} → ${nueva.situacion}`);
      cambios++;
    }
    for (const col of COLUMNAS_FASE) {
      if (vieja.valores[col] !== nueva.valores[col]) {
        console.log(
          `~ ${nueva.codigo} · ${col}: ${fmt(vieja.valores[col])} → ${fmt(nueva.valores[col])}`,
        );
        cambios++;
      }
    }
  }
  for (const huerfana of porCodigo.values()) {
    console.log(`- ${huerfana.codigo} · ${huerfana.nombre} (ya no viene en el export)`);
    cambios++;
  }

  console.log(
    cambios === 0
      ? "\n✓ El fixture coincide con el .xlsx. No hay nada que actualizar."
      : `\n${cambios} diferencias. Actualiza scripts/pm/data/avance-obra-promociones.ts y vuelve a ejecutar.`,
  );
}

/** «sin dato» y «0 %» se imprimen distinto: es toda la trampa de estos datos. */
function fmt(v: number | null): string {
  return v === null ? "—" : String(v);
}

// ---------------------------------------------------------------------------
// Carga
// ---------------------------------------------------------------------------

interface FaseRow {
  id: string;
  nombre: string;
  zoho_columna: string | null;
}

async function leerFases(client: PoolClient): Promise<Map<string, FaseRow>> {
  const { rows } = await client.query<FaseRow>(
    "SELECT id, nombre, zoho_columna FROM public.pm_avance_fase_catalogo",
  );
  if (rows.length === 0) {
    throw new Error(
      "pm_avance_fase_catalogo está vacío: falta aplicar la migración 028 (npm run pm:apply-migration-028 -- --apply)",
    );
  }
  // Se indexa por la cabecera de Zoho, que es la clave de `valores`.
  return new Map(rows.map((r) => [r.zoho_columna ?? r.nombre, r]));
}

async function main(): Promise<void> {
  const apply = process.argv.includes("--apply");
  const iXlsx = process.argv.indexOf("--xlsx");

  if (iXlsx >= 0) {
    const ruta = process.argv[iXlsx + 1];
    if (!ruta) throw new Error("--xlsx necesita la ruta del fichero");
    console.log(`Comparando ${ruta} con el fixture versionado…\n`);
    diffContraFixture(leerXlsx(ruta));
    return;
  }

  const promociones = PROMOCIONES_ZOHO_SEED;
  console.log(`fixture: ${promociones.length} promociones · ${FUENTE_ARCHIVO}`);

  await withPgClient(async (client) => {
    const fases = await leerFases(client);
    for (const col of COLUMNAS_FASE) {
      if (!fases.has(col)) {
        throw new Error(`El catálogo no tiene la fase «${col}». ¿Migración 028 desactualizada?`);
      }
    }

    const { rows: activos } = await client.query<{ id: string; id_activo: string }>(
      "SELECT id, id_activo FROM public.pm_activos",
    );
    const { pares, faltantes } = resolveAutolink(
      activos.map((a) => a.id_activo),
      promociones.map((p) => p.codigo),
    );

    console.log(
      `\nemparejamiento automático: ${pares.length}/${
        Object.keys(AUTOLINK_PROMOCION_POR_ACTIVO).length
      }`,
    );
    for (const p of pares) console.log(`  ${p.idActivo} → ${p.codigo}`);
    for (const f of faltantes) console.log(`  ✗ ${f}`);

    const sinPromocion = activos.length - pares.length;
    console.log(
      `${sinPromocion} activos de PM quedan sin promoción: los empareja la PMO en /dashboard/pm/proyectos`,
    );

    if (!apply) {
      console.log(
        `\nDry-run: se escribirían ${promociones.length} promociones y ` +
          `${promociones.length * COLUMNAS_FASE.length} valores. Repite con --apply.`,
      );
      if (faltantes.length > 0) process.exitCode = 1;
      return;
    }

    console.log("\nescribiendo…");
    let cambiados = 0;
    let respetados = 0;

    for (const p of promociones) {
      const { rows } = await client.query<{ id: string }>(
        `INSERT INTO public.pm_promociones
           (zoho_record_id, zoho_analytics_id, codigo_promocion, nombre,
            owner_zoho_id, situacion, fuente_archivo, importado_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, now())
         ON CONFLICT (zoho_record_id) DO UPDATE SET
           zoho_analytics_id = EXCLUDED.zoho_analytics_id,
           codigo_promocion  = EXCLUDED.codigo_promocion,
           nombre            = EXCLUDED.nombre,
           owner_zoho_id     = EXCLUDED.owner_zoho_id,
           situacion         = EXCLUDED.situacion,
           fuente_archivo    = EXCLUDED.fuente_archivo,
           importado_at      = now()
         RETURNING id`,
        [
          p.zohoRecordId,
          p.zohoAnalyticsId,
          p.codigo,
          p.nombre,
          p.ownerZohoId,
          p.situacion,
          FUENTE_ARCHIVO,
        ],
      );
      const promocionId = rows[0].id;

      for (const col of COLUMNAS_FASE) {
        const fase = fases.get(col)!;
        const { rows: r } = await client.query<{
          pm_avance_importar_zoho: { pisado: boolean; historico: boolean };
        }>("SELECT public.pm_avance_importar_zoho($1, $2, $3)", [
          promocionId,
          fase.id,
          p.valores[col],
        ]);
        const res = r[0].pm_avance_importar_zoho;
        if (res.historico) cambiados++;
        if (!res.pisado) respetados++;
      }
    }

    for (const par of pares) {
      const activo = activos.find((a) => a.id_activo === par.idActivo)!;
      await client.query(
        `INSERT INTO public.pm_activo_promocion_map (pm_activo_id, promocion_id, origen, mapeado_por)
         SELECT $1, pr.id, 'auto', 'seed'
           FROM public.pm_promociones pr
          WHERE pr.codigo_promocion = $2
         ON CONFLICT (pm_activo_id) DO NOTHING`,
        [activo.id, par.codigo],
      );
    }

    // Todo valor vigente tiene que poder explicar de dónde salió. Esta sentencia
    // solo dispara con lo que se cargó antes de que el histórico funcionara; en
    // adelante lo escribe pm_avance_importar_zoho y aquí no queda nada por hacer.
    const { rowCount: backfill } = await client.query(
      `INSERT INTO public.pm_avance_obra_historico
         (promocion_id, fase_id, porcentaje_anterior, porcentaje_nuevo, origen, cambiado_por_email)
       SELECT a.promocion_id, a.fase_id, NULL, a.porcentaje, 'zoho_import', 'import'
         FROM public.pm_avance_obra a
        WHERE a.porcentaje IS NOT NULL
          AND NOT EXISTS (
            SELECT 1 FROM public.pm_avance_obra_historico h
             WHERE h.promocion_id = a.promocion_id AND h.fase_id = a.fase_id)`,
    );

    const resumen = await client.query<{
      promociones: string;
      valores: string;
      sin_dato: string;
      mapeos: string;
      pendientes: string;
      descartados: string;
    }>(
      `SELECT
         (SELECT COUNT(*)::text FROM public.pm_promociones) AS promociones,
         (SELECT COUNT(*)::text FROM public.pm_avance_obra) AS valores,
         (SELECT COUNT(*)::text FROM public.pm_avance_obra WHERE porcentaje IS NULL) AS sin_dato,
         (SELECT COUNT(*)::text FROM public.pm_activo_promocion_map) AS mapeos,
         (SELECT COUNT(*)::text FROM public.pm_avance_zoho_outbox WHERE estado = 'pendiente') AS pendientes,
         (SELECT COUNT(*)::text FROM public.pm_avance_zoho_outbox WHERE motivo IS NOT NULL) AS descartados`,
    );
    const r = resumen.rows[0];

    console.log(
      `\n✓ ${r.promociones} promociones · ${r.valores} valores (${r.sin_dato} sin dato) · ` +
        `${r.mapeos} emparejamientos · ${r.pendientes} cambios pendientes para Zoho`,
    );
    console.log(
      `  ${cambiados} valores cambian respecto a lo que había · ` +
        `${respetados} no se tocan por venir de una edición de la PMO`,
    );
    if (backfill) {
      console.log(`  ${backfill} valores reciben su entrada inicial de histórico`);
    }
    if (Number(r.descartados) > 0) {
      console.log(
        `  ${r.descartados} cambios de la bandeja cerrados porque Zoho ya trae ese valor`,
      );
    }
    if (faltantes.length > 0) process.exitCode = 1;
  });

  await closePgPool();
}

main().catch((err: unknown) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
