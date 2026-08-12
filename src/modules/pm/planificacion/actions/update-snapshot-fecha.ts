"use server";

import { requirePmWriteSupabase } from "@/modules/pm/planificacion/data/writeClient";
import {
  validateFechaIso,
  validateSnapshotCode,
  validateUuid,
} from "@/modules/pm/planificacion/logic/planificacion-validation";

export type UpdateSnapshotFechaInput = {
  hitoId: string;
  /** Código de trimestre (AAAA_Qn) o "levantamiento". */
  snapshotCode: string;
  /** ISO YYYY-MM-DD, o null/"" para vaciar la celda. */
  fecha: string | null;
};

export type UpdateSnapshotFechaResult =
  | { ok: true; fecha: string | null }
  | { ok: false; error: string };

/**
 * Edita la fecha reportada de UN hito en UN trimestre ya añadido.
 *
 * Reescribe historia a propósito: el trimestre recién añadido copia la previsión
 * vigente y la PM necesita corregirlo celda a celda (o vía pegado en columna)
 * antes de validarlo contra el maestro. «levantamiento» también se admite: es la
 * única forma de corregir un levantamiento mal importado.
 *
 * Vaciar (fecha null) BORRA la fila de pm_snapshot_fechas en lugar de dejar la
 * fecha a null: así snapshotsConDatos no cuenta celdas vacías como trimestre
 * con datos.
 */
export async function updateSnapshotFecha(
  input: UpdateSnapshotFechaInput,
): Promise<UpdateSnapshotFechaResult> {
  const id = validateUuid(input.hitoId, "hitoId");
  if (!id.ok) return { ok: false, error: id.error };

  const raw = String(input.snapshotCode ?? "").trim().toLowerCase();
  let code: string;
  if (raw === "levantamiento") {
    code = "levantamiento";
  } else {
    const parsed = validateSnapshotCode(input.snapshotCode);
    if (!parsed.ok) return { ok: false, error: parsed.error };
    code = parsed.value;
  }

  const fecha = validateFechaIso(input.fecha);
  if (!fecha.ok) return { ok: false, error: fecha.error };

  const auth = await requirePmWriteSupabase();
  if (!auth.ok) return { ok: false, error: auth.error };
  const { client } = auth;

  // El código tiene que existir como snapshot registrado: esta acción corrige
  // trimestres añadidos, no los crea (eso es «Añadir trimestre»).
  const { data: snap, error: snapError } = await client
    .from("pm_snapshots")
    .select("snapshot_code")
    .eq("snapshot_code", code)
    .maybeSingle();
  if (snapError) return { ok: false, error: snapError.message };
  if (!snap) return { ok: false, error: `El trimestre «${code}» no está añadido` };

  const { data: hito, error: hitoError } = await client
    .from("pm_hitos")
    .select("id")
    .eq("id", id.value)
    .maybeSingle();
  if (hitoError) return { ok: false, error: hitoError.message };
  if (!hito) return { ok: false, error: "Hito no encontrado" };

  if (fecha.value === null) {
    const { error } = await client
      .from("pm_snapshot_fechas")
      .delete()
      .eq("hito_id", id.value)
      .eq("snapshot_code", code);
    if (error) return { ok: false, error: error.message };
    return { ok: true, fecha: null };
  }

  // La fila puede no existir (el hito no tenía previsión al añadir el trimestre).
  const { error } = await client
    .from("pm_snapshot_fechas")
    .upsert(
      { hito_id: id.value, snapshot_code: code, fecha: fecha.value },
      { onConflict: "hito_id,snapshot_code" },
    );
  if (error) return { ok: false, error: error.message };

  return { ok: true, fecha: fecha.value };
}
