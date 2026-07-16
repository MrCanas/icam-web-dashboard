"use server";

import { requirePmWriteSupabase } from "@/modules/pm/planificacion/data/writeClient";
import {
  validateSnapshotCode,
  validateUuid,
} from "@/modules/pm/planificacion/logic/planificacion-validation";

export type AnadirTrimestreInput = {
  /** Trimestre que se reporta, AAAA_Qn. */
  snapshotCode: string;
  /**
   * Proyectos a los que añadir el trimestre. Vacío o ausente = todo el portfolio.
   *
   * Se selecciona a propósito: no todos los proyectos se reportan cada
   * trimestre. En los datos históricos DC-15 no tiene ninguna fecha en Q4 2025
   * ni en Q1 2026, así que añadirlo en bloque le inventaría reportes que nunca
   * existieron.
   */
  activoIds?: string[];
  /**
   * Sobrescribir un snapshot ya añadido. La UI debe preguntar antes: rehacer
   * un trimestre pisa el reporte anterior, que es historia.
   */
  sobrescribir?: boolean;
};

export type AnadirTrimestreResult =
  | { ok: true; snapshotCode: string; fechas: number; sobrescrito: boolean }
  | { ok: false; error: string; yaExiste?: true };

/**
 * Añade el trimestre reportado al histórico: copia la previsión vigente
 * (pm_hitos.fecha_actual) a pm_snapshot_fechas bajo un snapshot_code.
 *
 * Es lo que sustituye a «añadir una columna de trimestre al Excel»: una columna
 * existe para un proyecto justo cuando ese proyecto tiene alguna fecha en ella.
 * No hay un «crear columna» aparte.
 *
 * Idempotente por el UNIQUE (hito_id, snapshot_code) de pm_schema.sql: volver a
 * añadirlo actualiza las fechas en vez de duplicarlas. Ignora los hitos
 * archivados (no aplican a ese proyecto, no deben entrar en el reporte).
 */
export async function anadirTrimestre(
  input: AnadirTrimestreInput,
): Promise<AnadirTrimestreResult> {
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
    .select("snapshot_code, anadido_at")
    .eq("snapshot_code", code.value)
    .maybeSingle();

  if (eSel) return { ok: false, error: eSel.message };

  const yaAnadido = Boolean(existente?.anadido_at);
  if (yaAnadido && !input.sobrescribir) {
    return {
      ok: false,
      yaExiste: true,
      error: `El trimestre ${code.value} ya existe. Volver a añadirlo sobrescribe lo reportado en los proyectos que elijas.`,
    };
  }

  const { data, error } = await client.rpc("anadir_pm_snapshot", {
    p_snapshot_code: code.value,
    p_activo_ids: ids.length > 0 ? ids : null,
  });

  if (error) return { ok: false, error: error.message };

  return {
    ok: true,
    snapshotCode: code.value,
    fechas: typeof data === "number" ? data : 0,
    sobrescrito: yaAnadido,
  };
}
