"use server";

import { requirePmWriteSupabase } from "@/modules/pm/planificacion/data/writeClient";
import { validateSnapshotCode } from "@/modules/pm/planificacion/logic/planificacion-validation";

export type CongelarSnapshotInput = {
  /** Trimestre que se reporta, AAAA_Qn. */
  snapshotCode: string;
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
 * Congela el trimestre reportado: copia la previsión vigente de cada hito
 * (pm_hitos.fecha_actual) a pm_snapshot_fechas bajo un snapshot_code nuevo.
 *
 * Es la operación que sustituye a "añadir una columna de trimestre al Excel".
 * Idempotente gracias al UNIQUE (hito_id, snapshot_code) que ya existía: volver
 * a congelar el mismo código actualiza las fechas en vez de duplicarlas.
 *
 * Global al portfolio: un snapshot = un trimestre reportado para todos los
 * proyectos, que es como lo trata el selector del Overview.
 */
export async function congelarSnapshot(
  input: CongelarSnapshotInput,
): Promise<CongelarSnapshotResult> {
  const code = validateSnapshotCode(input.snapshotCode);
  if (!code.ok) return { ok: false, error: code.error };

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
      error: `El trimestre ${code.value} ya está congelado. Volver a congelarlo sobrescribe el reporte anterior.`,
    };
  }

  const { data, error } = await client.rpc("congelar_pm_snapshot", {
    p_snapshot_code: code.value,
  });

  if (error) return { ok: false, error: error.message };

  return {
    ok: true,
    snapshotCode: code.value,
    fechas: typeof data === "number" ? data : 0,
    sobrescrito: yaCongelado,
  };
}
