"use server";

import { requirePmWriteSupabase } from "@/modules/pm/planificacion/data/writeClient";
import {
  validateSnapshotCode,
  validateUuid,
} from "@/modules/pm/planificacion/logic/planificacion-validation";

export type CongelarSnapshotInput = {
  /** Trimestre que se reporta, AAAA_Qn. */
  snapshotCode: string;
  /**
   * Proyectos a congelar. Vacío o ausente = todo el portfolio.
   *
   * Se selecciona a propósito: no todos los proyectos se reportan cada
   * trimestre. En los datos históricos DC-15 no tiene ninguna fecha en Q4 2025
   * ni en Q1 2026, así que congelar en bloque le inventaría reportes que nunca
   * existieron.
   */
  activoIds?: string[];
  /**
   * Sobrescribir un snapshot ya congelado. La UI debe preguntar antes: rehacer
   * un trimestre pisa el reporte anterior, que es historia.
   */
  sobrescribir?: boolean;
};

export type CongelarSnapshotResult =
  | { ok: true; snapshotCode: string; fechas: number; sobrescrito: boolean }
  | { ok: false; error: string; yaExiste?: true };

/**
 * Congela el trimestre reportado: copia la previsión vigente
 * (pm_hitos.fecha_actual) a pm_snapshot_fechas bajo un snapshot_code.
 *
 * Es lo que sustituye a «añadir una columna de trimestre al Excel»: una columna
 * existe para un proyecto justo cuando ese proyecto tiene alguna fecha congelada
 * en ella. No hay un «crear columna» aparte.
 *
 * Idempotente por el UNIQUE (hito_id, snapshot_code) de pm_schema.sql: volver a
 * congelar actualiza las fechas en vez de duplicarlas. Ignora los hitos
 * archivados (no aplican a ese proyecto, no deben entrar en el reporte).
 */
export async function congelarSnapshot(
  input: CongelarSnapshotInput,
): Promise<CongelarSnapshotResult> {
  const code = validateSnapshotCode(input.snapshotCode);
  if (!code.ok) return { ok: false, error: code.error };

  const ids = input.activoIds ?? [];
  for (const id of ids) {
    const v = validateUuid(id, "activoId");
    if (!v.ok) return { ok: false, error: v.error };
  }

  const auth = await requirePmWriteSupabase();
  if (!auth.ok) return { ok: false, error: auth.error };
  const { client } = auth;

  const { data: existente, error: eSel } = await client
    .from("pm_snapshots")
    .select("snapshot_code, congelado_at")
    .eq("snapshot_code", code.value)
    .maybeSingle();

  if (eSel) return { ok: false, error: eSel.message };

  const yaCongelado = Boolean(existente?.congelado_at);
  if (yaCongelado && !input.sobrescribir) {
    return {
      ok: false,
      yaExiste: true,
      error: `El trimestre ${code.value} ya está congelado. Volver a congelarlo sobrescribe lo reportado en los proyectos que elijas.`,
    };
  }

  const { data, error } = await client.rpc("congelar_pm_snapshot", {
    p_snapshot_code: code.value,
    p_activo_ids: ids.length > 0 ? ids : null,
  });

  if (error) return { ok: false, error: error.message };

  return {
    ok: true,
    snapshotCode: code.value,
    fechas: typeof data === "number" ? data : 0,
    sobrescrito: yaCongelado,
  };
}
