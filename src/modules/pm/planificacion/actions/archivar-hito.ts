"use server";

import { requirePmWriteSupabase } from "@/modules/pm/planificacion/data/writeClient";
import { validateUuid } from "@/modules/pm/planificacion/logic/planificacion-validation";

export type ArchivarHitoResult =
  | { ok: true; archivado: boolean }
  | { ok: false; error: string };

/**
 * Archiva o restaura un hito EN UN PROYECTO.
 *
 * Es intrínsecamente por proyecto: cada fila de pm_hitos ya es un par
 * activo×hito, así que archivar «Inspeccion Turismo» en un residencial no toca a
 * los cinco APT que sí lo usan.
 *
 * Sustituye a removeHitoDeActivo, que hacía DELETE y se llevaba por cascada las
 * pm_snapshot_fechas del hito — histórico de trimestres ya reportados. Aquí no
 * se borra nada: el hito baja al apartado «Archivados» de la rejilla con sus
 * fechas intactas y se puede restaurar.
 *
 * Efecto: desaparece del Gantt, del detalle y de los KPIs (fetchPmPortfolio lo
 * filtra), porque un hito archivado no aplica a ese proyecto.
 */
export async function archivarHito(
  hitoId: string,
  archivar = true,
): Promise<ArchivarHitoResult> {
  const id = validateUuid(hitoId, "hitoId");
  if (!id.ok) return { ok: false, error: id.error };

  const auth = await requirePmWriteSupabase();
  if (!auth.ok) return { ok: false, error: auth.error };

  const { error, count } = await auth.client
    .from("pm_hitos")
    .update(
      {
        archivado_at: archivar ? new Date().toISOString() : null,
        updated_at: new Date().toISOString(),
      },
      { count: "exact" },
    )
    .eq("id", id.value);

  if (error) return { ok: false, error: error.message };
  if (count === 0) return { ok: false, error: "Hito no encontrado" };

  return { ok: true, archivado: archivar };
}
