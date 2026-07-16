/**
 * Orden de proyectos del Gantt, histórico.
 *
 * Vivía hardcodeado dentro de PmGanttOverview.tsx, lo que dejaba fuera del
 * gráfico a cualquier proyecto dado de alta por la PMO. La fuente real pasa a
 * ser `pm_activos.orden` (migración 018).
 *
 * Se conserva por dos motivos:
 *   1. Es la semilla de `pm_activos.orden` en scripts/pm/backfill-planificacion.ts,
 *      para que el Overview se vea idéntico tras migrar.
 *   2. Es el fallback para activos sin orden asignado (p. ej. tras restaurar el
 *      Excel con replace_pm_portfolio, que no conoce la columna `orden`).
 */
export const PM_PROJECT_ORDER_LEGACY = [
  "SE84",
  "DC-15",
  "GQ8",
  "CSP-10",
  "PC25-CP6",
  "SA-33-31",
  "PC25-26-RESIDENCIAL",
  "EM-RESIDENCIAL",
  "CA1",
] as const;

/** Posición histórica del activo; 1000 para los que no estaban en la lista. */
export function legacyProjectOrderIndex(idActivo: string): number {
  const i = (PM_PROJECT_ORDER_LEGACY as readonly string[]).indexOf(idActivo);
  return i >= 0 ? i : 1000;
}
