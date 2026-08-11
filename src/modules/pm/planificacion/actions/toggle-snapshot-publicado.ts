"use server";

import { requirePmWriteSupabase } from "@/modules/pm/planificacion/data/writeClient";
import { contarDiscrepanciasPendientes } from "@/modules/pm/planificacion/data/discrepanciasServer";
import { validateUuid } from "@/modules/pm/planificacion/logic/planificacion-validation";
import {
  evaluarGatePublicacion,
  motivoGateTexto,
} from "@/modules/pm/planificacion/logic/publicacion-gate";

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
 * y retirar la inserta. Así un trimestre recién añadido se publica solo y la
 * tabla no crece con filas que no dicen nada.
 *
 * No borra ninguna fecha: el trimestre sigue en la rejilla, solo deja de salir
 * en el Overview de ese proyecto.
 *
 * Publicar pasa por el gate del maestro (migración 025): sin mapeo a proyecto
 * financiero o sin línea reportada en maestro_lineas_trimestre no se publica.
 * Retirar siempre está permitido. La UI deshabilita el check por cortesía, pero
 * la decisión de verdad es esta.
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
    if (code !== "levantamiento") {
      const { data: map, error: mapError } = await client
        .from("pm_activo_proyecto_map")
        .select("proyecto_financiero_key")
        .eq("pm_activo_id", activoId.value)
        .maybeSingle();
      if (mapError) return { ok: false, error: mapError.message };
      const proyectoFinanciero = map?.proyecto_financiero_key ?? null;

      let lineaMaestroExiste = false;
      let discrepanciasPendientes = 0;
      if (proyectoFinanciero) {
        const { data: linea, error: lineaError } = await client
          .from("maestro_lineas_trimestre")
          .select("trimestre_code")
          .eq("proyecto", proyectoFinanciero)
          .eq("trimestre_code", code)
          .maybeSingle();
        if (lineaError) return { ok: false, error: lineaError.message };
        lineaMaestroExiste = Boolean(linea);

        if (lineaMaestroExiste) {
          const pend = await contarDiscrepanciasPendientes(
            client,
            activoId.value,
            code,
            proyectoFinanciero,
          );
          if (pend.error) return { ok: false, error: pend.error };
          discrepanciasPendientes = pend.pendientes;
        }
      }

      const gate = evaluarGatePublicacion({
        snapshotCode: code,
        proyectoFinanciero,
        lineaMaestroExiste,
        discrepanciasPendientes,
      });
      if (!gate.permitido) {
        return {
          ok: false,
          error: motivoGateTexto(gate.motivo, {
            proyectoFinanciero,
            etiquetaTrimestre: code,
            pendientes: discrepanciasPendientes,
          }),
        };
      }
    }

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
