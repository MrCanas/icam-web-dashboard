"use server";

import { requirePmWriteSupabase } from "@/modules/pm/planificacion/data/writeClient";
import { validateUuid } from "@/modules/pm/planificacion/logic/planificacion-validation";

export type ToggleSnapshotPublicadoInput = {
  activoId: string;
  snapshotCode: string;
  publicado: boolean;
};

export type ToggleSnapshotPublicadoResult =
  | { ok: true; publicado: boolean }
  | { ok: false; error: string };

/**
 * Publica o retira un trimestre EN UN PROYECTO CONCRETO.
 *
 * Sustituye a toggleSnapshotVisible, que era global: los proyectos ni empiezan a
 * la vez ni se reportan todos cada trimestre, así que publicar en bloque no
 * tenía sentido.
 *
 * Solo se guardan las excepciones: publicar borra la fila (sin fila = publicado)
 * y retirar la inserta. Así un trimestre recién congelado se publica solo y la
 * tabla no crece con filas que no dicen nada.
 *
 * No borra ninguna fecha: el trimestre sigue en la rejilla, solo deja de salir
 * en el Overview de ese proyecto.
 */
export async function toggleSnapshotPublicado(
  input: ToggleSnapshotPublicadoInput,
): Promise<ToggleSnapshotPublicadoResult> {
  const activoId = validateUuid(input.activoId, "activoId");
  if (!activoId.ok) return { ok: false, error: activoId.error };

  const code = String(input.snapshotCode ?? "").trim();
  if (!code) return { ok: false, error: "Falta el código de snapshot" };

  const auth = await requirePmWriteSupabase();
  if (!auth.ok) return { ok: false, error: auth.error };
  const { client } = auth;

  if (input.publicado) {
    const { error } = await client
      .from("pm_activo_snapshot")
      .delete()
      .eq("activo_id", activoId.value)
      .eq("snapshot_code", code);
    if (error) return { ok: false, error: error.message };
    return { ok: true, publicado: true };
  }

  const { error } = await client.from("pm_activo_snapshot").upsert({
    activo_id: activoId.value,
    snapshot_code: code,
    publicado: false,
    updated_at: new Date().toISOString(),
  });
  if (error) return { ok: false, error: error.message };
  return { ok: true, publicado: false };
}
