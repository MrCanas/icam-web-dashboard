"use server";

import { requirePmWriteSupabase } from "@/modules/pm/planificacion/data/writeClient";
import {
  validateFechaIso,
  validateUuid,
} from "@/modules/pm/planificacion/logic/planificacion-validation";

export type UpdateHitoFechaInput = {
  hitoId: string;
  /** ISO YYYY-MM-DD, o null/"" para dejar el hito sin previsión. */
  fecha: string | null;
};

export type UpdateHitoFechaResult =
  | { ok: true; fecha: string | null }
  | { ok: false; error: string };

/**
 * Edita la previsión vigente (`fecha_actual`) de un hito.
 *
 * Solo toca fecha_actual: las columnas de snapshot son historia congelada y no
 * se reescriben desde la rejilla. La desviación no se guarda, se deriva al leer
 * (ver deviationVsLevantamientoDays), así que no hay nada que recalcular aquí.
 */
export async function updateHitoFecha(
  input: UpdateHitoFechaInput,
): Promise<UpdateHitoFechaResult> {
  const id = validateUuid(input.hitoId, "hitoId");
  if (!id.ok) return { ok: false, error: id.error };

  const fecha = validateFechaIso(input.fecha);
  if (!fecha.ok) return { ok: false, error: fecha.error };

  const auth = await requirePmWriteSupabase();
  if (!auth.ok) return { ok: false, error: auth.error };

  const { error, count } = await auth.client
    .from("pm_hitos")
    .update({ fecha_actual: fecha.value, updated_at: new Date().toISOString() }, { count: "exact" })
    .eq("id", id.value);

  if (error) return { ok: false, error: error.message };
  if (count === 0) return { ok: false, error: "Hito no encontrado" };

  return { ok: true, fecha: fecha.value };
}
