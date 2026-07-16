import { compareQuarterCodes, parseQuarterCode } from "@/modules/pm/logic/pm-viz";

/**
 * Trimestres de respaldo, solo si no llega ninguno desde la base de datos
 * (p. ej. antes de aplicar la migración 020, cuando pm_snapshots no existe).
 */
export const PRESET_QUARTERS = ["2026_Q1", "2025_Q4", "2025_Q3", "2025_Q2"] as const;

/**
 * Trimestres a mostrar en el selector, del más reciente al más antiguo.
 *
 * `extraCodes` llega ya filtrado por `visible_en_dashboard`, así que aquí solo
 * se descarta `levantamiento` (es el plan original, no un trimestre reportado) y
 * lo que no tenga forma AAAA_Qn.
 *
 * Los presets son RESPALDO y NO se suman a lo recibido. Antes se unían siempre,
 * y eso hacía que desmarcar «publicar» en Planificación no tuviera ningún efecto
 * sobre esos cuatro trimestres: seguían apareciendo en el Overview.
 */
export function mergeQuarterCodes(extraCodes: string[]): string[] {
  const fromData = extraCodes.filter(
    (c) => c !== "levantamiento" && parseQuarterCode(c) !== null,
  );

  const source: readonly string[] =
    fromData.length > 0
      ? fromData
      : PRESET_QUARTERS.filter((c) => parseQuarterCode(c) !== null);

  const list = [...new Set(source)];
  list.sort((a, b) => -compareQuarterCodes(a, b));
  return list;
}
