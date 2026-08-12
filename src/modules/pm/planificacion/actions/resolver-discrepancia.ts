"use server";

import { requirePmWriteSupabase } from "@/modules/pm/planificacion/data/writeClient";
import { contarDiscrepanciasPendientes } from "@/modules/pm/planificacion/data/discrepanciasServer";
import {
  validateSnapshotCode,
  validateUuid,
} from "@/modules/pm/planificacion/logic/planificacion-validation";
import {
  PRIMER_TRIMESTRE_VALIDADO,
  sujetoAValidacion,
} from "@/modules/pm/planificacion/logic/publicacion-gate";

export type ResolverDiscrepanciaInput = {
  hitoId: string;
  snapshotCode: string;
  /** Qué fecha es la buena: la de Planificación o la del maestro. */
  eleccion: "pm" | "maestro";
};

export type ResolverDiscrepanciaResult =
  | { ok: true; fecha: string | null; publicadoAuto: boolean; pendientes: number }
  | { ok: false; error: string };

/**
 * Resuelve una discrepancia de fecha entre Planificación y el maestro para un
 * hito × trimestre. La elegida pasa a ser la oficial (pm_snapshot_fechas) y se
 * guarda la foto en pm_snapshot_validacion; si con esto el activo × trimestre
 * queda sin pendientes, se publica automáticamente (se borra la excepción de
 * pm_activo_snapshot).
 *
 * Todo se relee en servidor: el cliente solo dice «pm» o «maestro», nunca
 * manda fechas.
 */
export async function resolverDiscrepancia(
  input: ResolverDiscrepanciaInput,
): Promise<ResolverDiscrepanciaResult> {
  const id = validateUuid(input.hitoId, "hitoId");
  if (!id.ok) return { ok: false, error: id.error };

  // El levantamiento no tiene línea del maestro que validar.
  const code = validateSnapshotCode(input.snapshotCode);
  if (!code.ok) return { ok: false, error: code.error };

  // La historia anterior al corte no se valida ni se reescribe.
  if (!sujetoAValidacion(code.value)) {
    return {
      ok: false,
      error: `Los trimestres anteriores a ${PRIMER_TRIMESTRE_VALIDADO} son historia consolidada: no pasan por la validación.`,
    };
  }

  if (input.eleccion !== "pm" && input.eleccion !== "maestro") {
    return { ok: false, error: "Elección desconocida" };
  }

  const auth = await requirePmWriteSupabase();
  if (!auth.ok) return { ok: false, error: auth.error };
  const { client, user } = auth;

  const { data: hito, error: eHito } = await client
    .from("pm_hitos")
    .select("id, activo_id, catalogo_id, archivado_at")
    .eq("id", id.value)
    .maybeSingle();
  if (eHito) return { ok: false, error: eHito.message };
  if (!hito) return { ok: false, error: "Hito no encontrado" };
  if (hito.archivado_at) return { ok: false, error: "El hito está archivado" };
  if (!hito.catalogo_id) {
    return { ok: false, error: "El hito no está vinculado al catálogo (falta backfill)" };
  }

  const { data: cat, error: eCat } = await client
    .from("pm_hito_catalogo")
    .select("tabla_madre_columna")
    .eq("id", hito.catalogo_id)
    .maybeSingle();
  if (eCat) return { ok: false, error: eCat.message };
  const columna = cat?.tabla_madre_columna?.trim();
  if (!columna) {
    return { ok: false, error: "Este hito no está mapeado a ninguna columna de la Tabla madre" };
  }

  const { data: map, error: eMap } = await client
    .from("pm_activo_proyecto_map")
    .select("proyecto_financiero_key")
    .eq("pm_activo_id", hito.activo_id)
    .maybeSingle();
  if (eMap) return { ok: false, error: eMap.message };
  const proyecto = map?.proyecto_financiero_key ?? null;
  if (!proyecto) {
    return { ok: false, error: "El proyecto no está mapeado al maestro financiero" };
  }

  const { data: lineaFechas, error: eLinea } = await client
    .from("maestro_hito_fechas")
    .select("columna, fecha")
    .eq("proyecto", proyecto)
    .eq("trimestre_code", code.value);
  if (eLinea) return { ok: false, error: eLinea.message };
  if (!lineaFechas || lineaFechas.length === 0) {
    return { ok: false, error: `El maestro no tiene línea de ${proyecto} para ${code.value}` };
  }

  const celda = lineaFechas.find(
    (c) => c.columna.trim().toLowerCase() === columna.toLowerCase(),
  );
  if (!celda) {
    return { ok: false, error: `La línea del maestro no trae la columna «${columna}»` };
  }
  const fechaMaestro = (celda.fecha as string | null) ?? null;
  if (fechaMaestro === null && input.eleccion === "maestro") {
    return { ok: false, error: "El maestro no tiene fecha para este hito: no hay nada que copiar" };
  }

  const { data: oficial, error: eOficial } = await client
    .from("pm_snapshot_fechas")
    .select("fecha")
    .eq("hito_id", id.value)
    .eq("snapshot_code", code.value)
    .maybeSingle();
  if (eOficial) return { ok: false, error: eOficial.message };
  const fechaPm = (oficial?.fecha as string | null) ?? null;

  const fechaElegida = input.eleccion === "maestro" ? fechaMaestro : fechaPm;

  if (input.eleccion === "maestro") {
    const { error } = await client
      .from("pm_snapshot_fechas")
      .upsert(
        { hito_id: id.value, snapshot_code: code.value, fecha: fechaMaestro },
        { onConflict: "hito_id,snapshot_code" },
      );
    if (error) return { ok: false, error: error.message };
  }

  const { error: eVal } = await client.from("pm_snapshot_validacion").upsert(
    {
      hito_id: id.value,
      snapshot_code: code.value,
      fuente: input.eleccion,
      fecha_elegida: fechaElegida,
      fecha_pm: fechaPm,
      fecha_maestro: fechaMaestro,
      resuelto_por: user.email,
      resuelto_at: new Date().toISOString(),
    },
    { onConflict: "hito_id,snapshot_code" },
  );
  if (eVal) return { ok: false, error: eVal.message };

  // Autopublicación: sin pendientes en el activo × trimestre → se borra la
  // excepción. La línea del maestro existe (se comprobó arriba).
  const { pendientes, error: ePend } = await contarDiscrepanciasPendientes(
    client,
    hito.activo_id,
    code.value,
    proyecto,
  );
  if (ePend) return { ok: false, error: ePend };

  let publicadoAuto = false;
  if (pendientes === 0) {
    const { data: excepcion, error: eExc } = await client
      .from("pm_activo_snapshot")
      .select("publicado")
      .eq("activo_id", hito.activo_id)
      .eq("snapshot_code", code.value)
      .maybeSingle();
    if (eExc) return { ok: false, error: eExc.message };
    if (excepcion && excepcion.publicado === false) {
      const { error } = await client
        .from("pm_activo_snapshot")
        .delete()
        .eq("activo_id", hito.activo_id)
        .eq("snapshot_code", code.value);
      if (error) return { ok: false, error: error.message };
      publicadoAuto = true;
    }
  }

  return { ok: true, fecha: fechaElegida, publicadoAuto, pendientes };
}
