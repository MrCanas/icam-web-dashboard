/**
 * Orden de proyectos del Gantt, histórico.
 *
 * Vivía hardcodeado dentro de PmGanttOverview.tsx, lo que dejaba fuera del
 * gráfico a cualquier proyecto dado de alta por la PMO. La fuente real pasa a
 * ser `pm_activos.orden` (migración 020).
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

/** Lo mínimo que necesita el orden; evita atar esta lógica a PmPortfolioRow. */
interface OrdenableActivo {
  activo: { id_activo: string; orden?: number };
}

/**
 * Orden del Gantt: manda `pm_activos.orden`, editable desde PM → Proyectos.
 *
 * Si TODOS los activos siguen a 0 se cae a la lista histórica: es el estado tras
 * restaurar el Excel, porque replace_pm_portfolio no conoce la columna `orden`.
 * Basta con que uno tenga orden para que mande la base de datos — si no, un alta
 * con orden=1 quedaría por detrás de los que valen 0 y el fallback los mezclaría.
 *
 * Desempate por id_activo para que el orden sea estable y no dependa de cómo
 * venga la consulta.
 */
export function sortPortfolioRows<T extends OrdenableActivo>(rows: T[]): T[] {
  const sinOrden = rows.every((r) => (r.activo.orden ?? 0) === 0);
  const idx = (r: T) =>
    sinOrden ? legacyProjectOrderIndex(r.activo.id_activo) : (r.activo.orden ?? 0);

  return [...rows].sort(
    (a, b) => idx(a) - idx(b) || a.activo.id_activo.localeCompare(b.activo.id_activo),
  );
}
