"use server";

import { requirePmWriteSupabase } from "@/modules/pm/planificacion/data/writeClient";
import {
  validateIdActivo,
  validateTipoUso,
  validateUuid,
} from "@/modules/pm/planificacion/logic/planificacion-validation";

export type ActionResult<T = undefined> =
  | ({ ok: true } & (T extends undefined ? object : { value: T }))
  | { ok: false; error: string };

export type CreateActivoInput = {
  idActivo: string;
  tipoUso: string;
  nombreDisplay?: string | null;
  /** Hitos del catálogo a activar de entrada. Sin ellos el proyecto nace vacío. */
  catalogoIds?: string[];
};

export type CreateActivoResult =
  | { ok: true; id: string; hitos: number }
  | { ok: false; error: string };

/**
 * Alta de proyecto.
 *
 * Nace con los hitos del catálogo que se le indiquen, con `orden_hito` tomado de
 * `orden_default` y sin fechas: la PMO las rellena en la rejilla. Si no se pasa
 * ninguno se crea vacío y luego se añaden desde la rejilla.
 */
export async function createActivo(input: CreateActivoInput): Promise<CreateActivoResult> {
  const idActivo = validateIdActivo(input.idActivo);
  if (!idActivo.ok) return { ok: false, error: idActivo.error };

  const tipoUso = validateTipoUso(input.tipoUso);
  if (!tipoUso.ok) return { ok: false, error: tipoUso.error };

  const auth = await requirePmWriteSupabase();
  if (!auth.ok) return { ok: false, error: auth.error };
  const { client } = auth;

  const { data: yaExiste, error: eDup } = await client
    .from("pm_activos")
    .select("id")
    .eq("id_activo", idActivo.value)
    .maybeSingle();
  if (eDup) return { ok: false, error: eDup.message };
  if (yaExiste) {
    return { ok: false, error: `Ya existe un proyecto con el código «${idActivo.value}»` };
  }

  // Al final del Gantt: reordenar es trivial, pero que un alta se cuele en medio
  // del portfolio sin querer, no.
  const { data: maxOrden } = await client
    .from("pm_activos")
    .select("orden")
    .order("orden", { ascending: false })
    .limit(1)
    .maybeSingle();

  const { data: creado, error } = await client
    .from("pm_activos")
    .insert({
      id_activo: idActivo.value,
      tipo_uso_activo: tipoUso.value,
      nombre_display: input.nombreDisplay?.trim() || null,
      orden: ((maxOrden?.orden as number | undefined) ?? 0) + 1,
    })
    .select("id")
    .single();

  if (error) return { ok: false, error: error.message };

  const catalogoIds = (input.catalogoIds ?? []).filter((c) => validateUuid(c).ok);
  if (catalogoIds.length === 0) {
    return { ok: true, id: creado.id as string, hitos: 0 };
  }

  const { data: entradas, error: eCat } = await client
    .from("pm_hito_catalogo")
    .select("id, nombre, orden_default")
    .in("id", catalogoIds);

  if (eCat) return { ok: false, error: eCat.message };

  const filas = (entradas ?? []).map((c) => ({
    activo_id: creado.id,
    catalogo_id: c.id,
    hito: c.nombre,
    orden_hito: c.orden_default,
    fecha_actual: null,
  }));

  if (filas.length) {
    const { error: eHitos } = await client.from("pm_hitos").insert(filas);
    if (eHitos) return { ok: false, error: eHitos.message };
  }

  return { ok: true, id: creado.id as string, hitos: filas.length };
}

export type UpdateActivoInput = {
  id: string;
  idActivo?: string;
  tipoUso?: string;
  nombreDisplay?: string | null;
};

export async function updateActivo(
  input: UpdateActivoInput,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const id = validateUuid(input.id, "id");
  if (!id.ok) return { ok: false, error: id.error };

  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };

  if (input.idActivo !== undefined) {
    const v = validateIdActivo(input.idActivo);
    if (!v.ok) return { ok: false, error: v.error };
    patch.id_activo = v.value;
  }
  if (input.tipoUso !== undefined) {
    const v = validateTipoUso(input.tipoUso);
    if (!v.ok) return { ok: false, error: v.error };
    patch.tipo_uso_activo = v.value;
  }
  if (input.nombreDisplay !== undefined) {
    patch.nombre_display = input.nombreDisplay?.trim() || null;
  }

  const auth = await requirePmWriteSupabase();
  if (!auth.ok) return { ok: false, error: auth.error };

  const { error, count } = await auth.client
    .from("pm_activos")
    .update(patch, { count: "exact" })
    .eq("id", id.value);

  if (error) {
    if (error.code === "23505") {
      return { ok: false, error: "Ya existe otro proyecto con ese código" };
    }
    return { ok: false, error: error.message };
  }
  if (count === 0) return { ok: false, error: "Proyecto no encontrado" };
  return { ok: true };
}

/**
 * Baja lógica. Los proyectos NUNCA se borran: hacerlo arrastraría en cascada sus
 * hitos y todo el histórico de snapshots, que es justo lo que hay que preservar.
 */
export async function archiveActivo(
  id: string,
  archivar = true,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const v = validateUuid(id, "id");
  if (!v.ok) return { ok: false, error: v.error };

  const auth = await requirePmWriteSupabase();
  if (!auth.ok) return { ok: false, error: auth.error };

  const { error, count } = await auth.client
    .from("pm_activos")
    .update(
      { archivado_at: archivar ? new Date().toISOString() : null },
      { count: "exact" },
    )
    .eq("id", v.value);

  if (error) return { ok: false, error: error.message };
  if (count === 0) return { ok: false, error: "Proyecto no encontrado" };
  return { ok: true };
}

/** Orden del Gantt: se reciben los ids en el orden deseado. */
export async function reorderActivos(
  ids: string[],
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!Array.isArray(ids) || ids.length === 0) {
    return { ok: false, error: "Lista de proyectos vacía" };
  }
  for (const id of ids) {
    const v = validateUuid(id, "id");
    if (!v.ok) return { ok: false, error: v.error };
  }

  const auth = await requirePmWriteSupabase();
  if (!auth.ok) return { ok: false, error: auth.error };

  for (const [index, id] of ids.entries()) {
    const { error } = await auth.client
      .from("pm_activos")
      .update({ orden: index, updated_at: new Date().toISOString() })
      .eq("id", id);
    if (error) return { ok: false, error: error.message };
  }
  return { ok: true };
}
