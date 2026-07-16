"use server";

import { requirePmWriteSupabase } from "@/modules/pm/planificacion/data/writeClient";
import { validateUuid } from "@/modules/pm/planificacion/logic/planificacion-validation";

export type MapActivoProyectoInput = {
  pmActivoId: string;
  /** Valor de proyectos.proyecto, o null para deshacer el mapeo. */
  proyectoFinancieroKey: string | null;
};

export type MapActivoProyectoResult =
  | { ok: true; proyectoFinancieroKey: string | null }
  | { ok: false; error: string };

/**
 * Empareja un activo de PM con su proyecto del maestro financiero.
 *
 * PM y la Tabla madre contienen los mismos proyectos con nombres distintos
 * (SE84 ↔ RETAIL SE84, SICC II ↔ VBARE…), así que el emparejamiento no se puede
 * inferir por código: lo hace la PMO aquí.
 *
 * Varios activos pueden apuntar al mismo proyecto financiero: PM separa PC25 en
 * PC25-CP6 y PC25-26-RESIDENCIAL por uso y el maestro lo mantiene unido. La
 * migración 020 quitó el UNIQUE que lo impedía; es N:1 a propósito.
 */
export async function mapActivoProyecto(
  input: MapActivoProyectoInput,
): Promise<MapActivoProyectoResult> {
  const id = validateUuid(input.pmActivoId, "pmActivoId");
  if (!id.ok) return { ok: false, error: id.error };

  const key = input.proyectoFinancieroKey?.trim() || null;

  const auth = await requirePmWriteSupabase();
  if (!auth.ok) return { ok: false, error: auth.error };
  const { client } = auth;

  if (key === null) {
    const { error } = await client
      .from("pm_activo_proyecto_map")
      .delete()
      .eq("pm_activo_id", id.value);
    if (error) return { ok: false, error: error.message };
    return { ok: true, proyectoFinancieroKey: null };
  }

  // El desplegable se alimenta de la tabla `proyectos`, pero se revalida aquí:
  // no hay FK que lo garantice (proyecto_financiero_key es texto libre) y un
  // mapeo a un proyecto inexistente rompería la exportación futura en silencio.
  const { data: existe, error: eSel } = await client
    .from("proyectos")
    .select("proyecto")
    .eq("proyecto", key)
    .maybeSingle();

  if (eSel) return { ok: false, error: eSel.message };
  if (!existe) {
    return {
      ok: false,
      error: `«${key}» no existe en el maestro financiero. Recarga la página si acabas de sincronizar el Excel.`,
    };
  }

  const { error } = await client
    .from("pm_activo_proyecto_map")
    .upsert({ pm_activo_id: id.value, proyecto_financiero_key: key });

  if (error) return { ok: false, error: error.message };
  return { ok: true, proyectoFinancieroKey: key };
}
