"use server";

import { requirePmWriteSupabase } from "@/modules/pm/planificacion/data/writeClient";

export type ToggleSnapshotVisibleInput = {
  snapshotCode: string;
  visible: boolean;
};

export type ToggleSnapshotVisibleResult =
  | { ok: true; visible: boolean }
  | { ok: false; error: string };

/**
 * El check por columna: publica o retira un snapshot del dashboard.
 *
 * Ojo con lo que NO hace: no borra ninguna fecha. Ocultar un trimestre solo lo
 * saca del selector del Overview y del gráfico de evolución; sigue estando en la
 * rejilla y en la base de datos. Es una decisión de reporte, reversible.
 *
 * Distinto de ocultar la columna en la rejilla, que es preferencia local de cada
 * usuario y no se guarda aquí.
 */
export async function toggleSnapshotVisible(
  input: ToggleSnapshotVisibleInput,
): Promise<ToggleSnapshotVisibleResult> {
  const code = String(input.snapshotCode ?? "").trim();
  if (!code) return { ok: false, error: "Falta el código de snapshot" };

  const auth = await requirePmWriteSupabase();
  if (!auth.ok) return { ok: false, error: auth.error };

  const { error, count } = await auth.client
    .from("pm_snapshots")
    .update({ visible_en_dashboard: Boolean(input.visible) }, { count: "exact" })
    .eq("snapshot_code", code);

  if (error) return { ok: false, error: error.message };
  if (count === 0) return { ok: false, error: `Snapshot «${code}» no encontrado` };

  return { ok: true, visible: Boolean(input.visible) };
}
