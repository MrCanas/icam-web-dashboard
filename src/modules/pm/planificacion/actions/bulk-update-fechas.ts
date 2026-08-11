"use server";

import { requirePmWriteSupabase } from "@/modules/pm/planificacion/data/writeClient";
import { MAX_LINEAS_PASTE } from "@/modules/pm/planificacion/logic/planificacion-paste";
import {
  validateFechaIso,
  validateSnapshotCode,
  validateUuid,
} from "@/modules/pm/planificacion/logic/planificacion-validation";

export type BulkUpdateFechasTarget =
  | { tipo: "prevision" }
  | { tipo: "snapshot"; snapshotCode: string };

export type BulkUpdateFechasInput = {
  target: BulkUpdateFechasTarget;
  items: { hitoId: string; fecha: string | null }[];
};

export type BulkUpdateFechasResult =
  | { ok: true; actualizados: number }
  | { ok: false; error: string };

/**
 * Escribe de golpe las fechas de un pegado en columna: la previsión vigente de
 * varios hitos, o sus celdas de un trimestre ya añadido.
 *
 * Todo o nada a nivel de validación (con una fecha mala no se escribe ninguna),
 * pero sin transacción entre filas: a esta escala (≤17 hitos por proyecto) un
 * fallo a mitad se resuelve con el router.refresh() del cliente, que repinta la
 * verdad del servidor. fecha null borra la fila en snapshots (igual que
 * updateSnapshotFecha) y vacía fecha_actual en previsión.
 */
export async function bulkUpdateFechas(
  input: BulkUpdateFechasInput,
): Promise<BulkUpdateFechasResult> {
  const items = Array.isArray(input.items) ? input.items : [];
  if (items.length === 0) return { ok: false, error: "No hay fechas que pegar" };
  if (items.length > MAX_LINEAS_PASTE) {
    return { ok: false, error: `Como mucho ${MAX_LINEAS_PASTE} fechas por pegado` };
  }

  const validados: { hitoId: string; fecha: string | null }[] = [];
  const vistos = new Set<string>();
  for (const item of items) {
    const id = validateUuid(item.hitoId, "hitoId");
    if (!id.ok) return { ok: false, error: id.error };
    const fecha = validateFechaIso(item.fecha);
    if (!fecha.ok) return { ok: false, error: fecha.error };
    if (vistos.has(id.value)) return { ok: false, error: "Hito repetido en el pegado" };
    vistos.add(id.value);
    validados.push({ hitoId: id.value, fecha: fecha.value });
  }

  const tipo = input.target?.tipo;
  let snapshotCode: string | null = null;
  if (tipo === "snapshot") {
    const raw = String(input.target && "snapshotCode" in input.target ? input.target.snapshotCode : "")
      .trim()
      .toLowerCase();
    if (raw === "levantamiento") {
      snapshotCode = "levantamiento";
    } else {
      const parsed = validateSnapshotCode(raw);
      if (!parsed.ok) return { ok: false, error: parsed.error };
      snapshotCode = parsed.value;
    }
  } else if (tipo !== "prevision") {
    return { ok: false, error: "Destino de pegado desconocido" };
  }

  const auth = await requirePmWriteSupabase();
  if (!auth.ok) return { ok: false, error: auth.error };
  const { client } = auth;

  if (tipo === "prevision") {
    // Fechas distintas por fila: un update por hito, en paralelo. Volumen ≤17.
    const ahora = new Date().toISOString();
    const resultados = await Promise.all(
      validados.map((v) =>
        client
          .from("pm_hitos")
          .update({ fecha_actual: v.fecha, updated_at: ahora }, { count: "exact" })
          .eq("id", v.hitoId),
      ),
    );
    const fallo = resultados.find((r) => r.error);
    if (fallo?.error) return { ok: false, error: fallo.error.message };
    const actualizados = resultados.reduce((n, r) => n + (r.count ?? 0), 0);
    if (actualizados < validados.length) {
      return { ok: false, error: "Algún hito del pegado ya no existe. Recarga la página." };
    }
    return { ok: true, actualizados };
  }

  // El trimestre tiene que existir: el pegado corrige, no crea snapshots.
  const { data: snap, error: snapError } = await client
    .from("pm_snapshots")
    .select("snapshot_code")
    .eq("snapshot_code", snapshotCode)
    .maybeSingle();
  if (snapError) return { ok: false, error: snapError.message };
  if (!snap) return { ok: false, error: `El trimestre «${snapshotCode}» no está añadido` };

  const conFecha = validados.filter((v) => v.fecha !== null);
  const sinFecha = validados.filter((v) => v.fecha === null);

  if (conFecha.length > 0) {
    const { error } = await client.from("pm_snapshot_fechas").upsert(
      conFecha.map((v) => ({
        hito_id: v.hitoId,
        snapshot_code: snapshotCode,
        fecha: v.fecha,
      })),
      { onConflict: "hito_id,snapshot_code" },
    );
    if (error) return { ok: false, error: error.message };
  }

  if (sinFecha.length > 0) {
    const { error } = await client
      .from("pm_snapshot_fechas")
      .delete()
      .eq("snapshot_code", snapshotCode)
      .in(
        "hito_id",
        sinFecha.map((v) => v.hitoId),
      );
    if (error) return { ok: false, error: error.message };
  }

  return { ok: true, actualizados: validados.length };
}
