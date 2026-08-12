"use server";

import { requirePmWriteSupabase } from "@/modules/pm/planificacion/data/writeClient";
import {
  shiftIsoMonths,
  validateMeses,
  validateOrdenHito,
  validateUuid,
} from "@/modules/pm/planificacion/logic/planificacion-validation";

export type AddHitoInput = {
  activoId: string;
  catalogoId: string;
  /** Si se omite, se usa el orden_default del catálogo. */
  ordenHito?: number;
};

export async function addHitoAActivo(
  input: AddHitoInput,
): Promise<{ ok: true; hitoId: string } | { ok: false; error: string }> {
  const activoId = validateUuid(input.activoId, "activoId");
  if (!activoId.ok) return { ok: false, error: activoId.error };
  const catalogoId = validateUuid(input.catalogoId, "catalogoId");
  if (!catalogoId.ok) return { ok: false, error: catalogoId.error };

  const auth = await requirePmWriteSupabase();
  if (!auth.ok) return { ok: false, error: auth.error };
  const { client } = auth;

  const { data: cat, error: eCat } = await client
    .from("pm_hito_catalogo")
    .select("id, nombre, orden_default")
    .eq("id", catalogoId.value)
    .maybeSingle();

  if (eCat) return { ok: false, error: eCat.message };
  if (!cat) return { ok: false, error: "Ese hito no está en el catálogo" };

  let orden = cat.orden_default as number;
  if (input.ordenHito !== undefined) {
    const v = validateOrdenHito(input.ordenHito);
    if (!v.ok) return { ok: false, error: v.error };
    orden = v.value;
  }

  const { data, error } = await client
    .from("pm_hitos")
    .insert({
      activo_id: activoId.value,
      catalogo_id: cat.id,
      hito: cat.nombre,
      orden_hito: orden,
      fecha_actual: null,
    })
    .select("id")
    .single();

  if (error) {
    // uq_pm_hitos_activo_catalogo / UNIQUE (activo_id, hito)
    if (error.code === "23505") {
      return { ok: false, error: `El proyecto ya tiene el hito «${cat.nombre}»` };
    }
    return { ok: false, error: error.message };
  }

  return { ok: true, hitoId: data.id as string };
}

/**
 * Quita un hito de un proyecto.
 *
 * Esto SÍ borra: se lleva por cascada las fechas de snapshot del hito, que son
 * histórico de reportes. La UI debe avisar de cuántas se pierden — por eso se
 * devuelve el recuento antes de borrar.
 */
export async function removeHitoDeActivo(
  hitoId: string,
  confirmar = false,
): Promise<
  | { ok: true }
  | { ok: false; error: string; requiereConfirmacion?: true; snapshots?: number }
> {
  const id = validateUuid(hitoId, "hitoId");
  if (!id.ok) return { ok: false, error: id.error };

  const auth = await requirePmWriteSupabase();
  if (!auth.ok) return { ok: false, error: auth.error };
  const { client } = auth;

  const { count: snapshots, error: eCount } = await client
    .from("pm_snapshot_fechas")
    .select("id", { count: "exact", head: true })
    .eq("hito_id", id.value);

  if (eCount) return { ok: false, error: eCount.message };

  if (!confirmar && (snapshots ?? 0) > 0) {
    return {
      ok: false,
      requiereConfirmacion: true,
      snapshots: snapshots ?? 0,
      error: `Este hito tiene ${snapshots} fechas de trimestres ya reportados. Quitarlo las borra.`,
    };
  }

  const { error } = await client.from("pm_hitos").delete().eq("id", id.value);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

export async function reorderHitos(
  hitoIds: string[],
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!Array.isArray(hitoIds) || hitoIds.length === 0) {
    return { ok: false, error: "Lista de hitos vacía" };
  }
  for (const id of hitoIds) {
    const v = validateUuid(id, "hitoId");
    if (!v.ok) return { ok: false, error: v.error };
  }

  const auth = await requirePmWriteSupabase();
  if (!auth.ok) return { ok: false, error: auth.error };

  for (const [index, id] of hitoIds.entries()) {
    const { error } = await auth.client
      .from("pm_hitos")
      .update({ orden_hito: index + 1, updated_at: new Date().toISOString() })
      .eq("id", id);
    if (error) return { ok: false, error: error.message };
  }
  return { ok: true };
}

export type ShiftHitosInput = {
  /** Hitos a desplazar. La UI manda el hito pinchado y todos los posteriores. */
  hitoIds: string[];
  meses: number;
};

/**
 * Desplaza en bloque la previsión de varios hitos.
 *
 * Es lo que hace que la rejilla compita con Excel: cuando una licencia se
 * retrasa 3 meses, todo lo que va detrás se mueve con ella. Solo toca hitos con
 * fecha: los que no tienen previsión siguen sin tenerla.
 */
export async function shiftHitosFechas(
  input: ShiftHitosInput,
): Promise<{ ok: true; movidos: number } | { ok: false; error: string }> {
  const meses = validateMeses(input.meses);
  if (!meses.ok) return { ok: false, error: meses.error };

  if (!Array.isArray(input.hitoIds) || input.hitoIds.length === 0) {
    return { ok: false, error: "No hay hitos seleccionados" };
  }
  for (const id of input.hitoIds) {
    const v = validateUuid(id, "hitoId");
    if (!v.ok) return { ok: false, error: v.error };
  }

  const auth = await requirePmWriteSupabase();
  if (!auth.ok) return { ok: false, error: auth.error };
  const { client } = auth;

  const { data: hitos, error: eSel } = await client
    .from("pm_hitos")
    .select("id, fecha_actual")
    .in("id", input.hitoIds)
    .not("fecha_actual", "is", null);

  if (eSel) return { ok: false, error: eSel.message };

  let movidos = 0;
  for (const h of hitos ?? []) {
    const actual = String(h.fecha_actual).slice(0, 10);
    const nueva = shiftIsoMonths(actual, meses.value);
    const { error } = await client
      .from("pm_hitos")
      .update({ fecha_actual: nueva, updated_at: new Date().toISOString() })
      .eq("id", h.id);
    if (error) return { ok: false, error: error.message };
    movidos++;
  }

  return { ok: true, movidos };
}
