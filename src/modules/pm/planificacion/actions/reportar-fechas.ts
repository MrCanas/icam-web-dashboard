"use server";

import { withAudit } from "@/lib/audit/withAudit";
import { requirePmWriteSupabase } from "@/modules/pm/planificacion/data/writeClient";
import { contarDiscrepanciasPendientes } from "@/modules/pm/planificacion/data/discrepanciasServer";
import {
  validateSnapshotCode,
  validateUuid,
} from "@/modules/pm/planificacion/logic/planificacion-validation";
import { TABLA_MADRE_COLUMNAS_HITO } from "@/modules/pm/planificacion/logic/tabla-madre-columnas";
import {
  reportarFechasAlMaestro,
  type ReporteFechaCelda,
} from "@/modules/portfolio/data/maestroWriteback";

export type ReportarFechasInput = {
  activoId: string;
  snapshotCode: string;
};

export type ReportarFechasResult =
  | {
      ok: true;
      modo: "graph" | "manual";
      proyecto: string;
      trimestreCode: string;
      /** Celdas a rellenar (modo manual: para copiar a mano). */
      fechas: ReporteFechaCelda[];
      /** Otros activos PM comparten este proyecto financiero (caso PC25). */
      proyectoCompartido: boolean;
    }
  | { ok: false; error: string };

/**
 * «Reportar fechas»: lleva al maestro las fechas oficiales YA VALIDADAS de un
 * activo × trimestre. Solo con cero discrepancias pendientes — reportar a
 * medias mandaría al Financiero una mezcla de fechas validadas y en disputa.
 *
 * En modo manual (defecto) no escribe nada en SharePoint: devuelve las celdas
 * (columna, letra DW-EL, fecha) para que el Financiero las pegue, y deja
 * constancia en audit_log de qué se reportó y quién.
 */
export async function reportarFechas(
  input: ReportarFechasInput,
): Promise<ReportarFechasResult> {
  const activoId = validateUuid(input.activoId, "activoId");
  if (!activoId.ok) return { ok: false, error: activoId.error };

  const code = validateSnapshotCode(input.snapshotCode);
  if (!code.ok) return { ok: false, error: code.error };

  const auth = await requirePmWriteSupabase();
  if (!auth.ok) return { ok: false, error: auth.error };
  const { client, user } = auth;

  const { data: map, error: eMap } = await client
    .from("pm_activo_proyecto_map")
    .select("proyecto_financiero_key")
    .eq("pm_activo_id", activoId.value)
    .maybeSingle();
  if (eMap) return { ok: false, error: eMap.message };
  const proyecto = map?.proyecto_financiero_key ?? null;
  if (!proyecto) {
    return { ok: false, error: "El proyecto no está mapeado al maestro financiero" };
  }

  const { data: linea, error: eLinea } = await client
    .from("maestro_lineas_trimestre")
    .select("trimestre_code")
    .eq("proyecto", proyecto)
    .eq("trimestre_code", code.value)
    .maybeSingle();
  if (eLinea) return { ok: false, error: eLinea.message };
  if (!linea) {
    return { ok: false, error: `El maestro no tiene línea de ${proyecto} para ${code.value}` };
  }

  const pend = await contarDiscrepanciasPendientes(client, activoId.value, code.value, proyecto);
  if (pend.error) return { ok: false, error: pend.error };
  if (pend.pendientes > 0) {
    return {
      ok: false,
      error: `Quedan ${pend.pendientes} discrepancias sin resolver: resuélvelas antes de reportar.`,
    };
  }

  // Fechas oficiales del trimestre para los hitos mapeados a columna del maestro.
  const { data: hitos, error: eHitos } = await client
    .from("pm_hitos")
    .select("id, catalogo_id")
    .eq("activo_id", activoId.value)
    .is("archivado_at", null);
  if (eHitos) return { ok: false, error: eHitos.message };

  const { data: cat, error: eCat } = await client
    .from("pm_hito_catalogo")
    .select("id, tabla_madre_columna");
  if (eCat) return { ok: false, error: eCat.message };
  const columnaPorCatalogo = new Map(
    (cat ?? []).map((c) => [c.id as string, c.tabla_madre_columna as string | null]),
  );

  const ids = (hitos ?? []).map((h) => h.id as string);
  const { data: fechasSnap, error: eFechas } = await client
    .from("pm_snapshot_fechas")
    .select("hito_id, fecha")
    .eq("snapshot_code", code.value)
    .in("hito_id", ids);
  if (eFechas) return { ok: false, error: eFechas.message };
  const fechaPorHito = new Map(
    (fechasSnap ?? []).map((f) => [f.hito_id as string, f.fecha as string | null]),
  );

  // Cabecera canónica (case-insensitive) → fecha oficial del hito mapeado.
  const fechaPorColumna = new Map<string, string | null>();
  for (const h of hitos ?? []) {
    const columna = h.catalogo_id
      ? columnaPorCatalogo.get(h.catalogo_id as string)?.trim()
      : null;
    if (!columna) continue;
    fechaPorColumna.set(columna.toLowerCase(), fechaPorHito.get(h.id as string) ?? null);
  }

  const fechas: ReporteFechaCelda[] = TABLA_MADRE_COLUMNAS_HITO.filter((c) =>
    fechaPorColumna.has(c.cabecera.toLowerCase()),
  ).map((c) => ({
    columna: c.cabecera,
    letra: c.letra,
    fecha: fechaPorColumna.get(c.cabecera.toLowerCase()) ?? null,
  }));

  if (fechas.length === 0) {
    return { ok: false, error: "Ningún hito de este proyecto está mapeado a columnas del maestro" };
  }

  // PC25: dos activos PM alimentan la misma línea. Se avisa para que el
  // Financiero sepa que este reporte solo cubre los hitos de UNO de ellos.
  const { data: comparten, error: eComp } = await client
    .from("pm_activo_proyecto_map")
    .select("pm_activo_id")
    .eq("proyecto_financiero_key", proyecto)
    .neq("pm_activo_id", activoId.value);
  if (eComp) return { ok: false, error: eComp.message };
  const proyectoCompartido = (comparten ?? []).length > 0;

  const resultado = await withAudit(
    user,
    "pm.maestro.reportar_fechas",
    {
      resourceType: "maestro_linea_trimestre",
      resourceId: `${proyecto}|${code.value}`,
      payload: { proyecto, trimestre: code.value, fechas, activoId: activoId.value },
    },
    async () =>
      reportarFechasAlMaestro({
        proyecto,
        trimestreCode: code.value,
        fechas,
      }),
  );

  if (!resultado.ok) return { ok: false, error: resultado.error };

  return {
    ok: true,
    modo: resultado.modo,
    proyecto,
    trimestreCode: code.value,
    fechas,
    proyectoCompartido,
  };
}
