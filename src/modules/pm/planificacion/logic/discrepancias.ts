/**
 * Estado de la validación PM ↔ maestro por hito × trimestre. Lógica pura,
 * compartida por la rejilla (columna «Maestro»), el contador de la cabecera,
 * el gate de publicación y la server action que resuelve.
 */

export type EstadoDiscrepancia =
  /** El hito no tiene columna mapeada o el maestro no trae fecha: no bloquea. */
  | "sin_dato_maestro"
  | "coincide"
  | "pendiente"
  | "resuelta";

export interface ResolucionFoto {
  fecha_elegida: string | null;
  fecha_maestro: string | null;
}

/**
 * Reglas:
 * - sin fecha del maestro (columna sin mapear, columna ausente o celda vacía)
 *   → sin_dato_maestro: 9 de los 17 hitos de PM no existen en el maestro y no
 *   pueden bloquear la publicación;
 * - iguales → coincide;
 * - distintas con resolución VIGENTE → resuelta. Vigente = la fecha elegida
 *   sigue siendo la oficial Y el maestro no ha cambiado desde que se resolvió.
 *   Editar la celda a mano o una nueva carga del maestro con otra fecha rompen
 *   la vigencia y la discrepancia reaparece sola;
 * - distintas sin resolución vigente → pendiente.
 */
export function estadoDiscrepancia(input: {
  /** pm_snapshot_fechas.fecha del hito en ese trimestre. */
  fechaOficial: string | null;
  /** undefined = hito sin columna en la línea del maestro. */
  fechaMaestro: string | null | undefined;
  resolucion?: ResolucionFoto | null;
}): EstadoDiscrepancia {
  const { fechaOficial, fechaMaestro, resolucion } = input;
  if (fechaMaestro === undefined || fechaMaestro === null) return "sin_dato_maestro";
  if (fechaOficial === fechaMaestro) return "coincide";
  if (
    resolucion &&
    resolucion.fecha_elegida === fechaOficial &&
    resolucion.fecha_maestro === fechaMaestro
  ) {
    return "resuelta";
  }
  return "pendiente";
}

/** El caller comprueba aparte que la línea del maestro exista. */
export function puedePublicarAuto(estados: EstadoDiscrepancia[]): boolean {
  return estados.every((e) => e !== "pendiente");
}

/**
 * Cruza los hitos de un activo con una línea del maestro vía el mapeo del
 * catálogo (pm_hito_catalogo.tabla_madre_columna). Comparación laxa de la
 * cabecera (case-insensitive), igual que updateHitoCatalogo al guardarla.
 *
 * Solo devuelve entradas para hitos cuya columna ESTÁ en la línea: los demás
 * quedan fuera del mapa (fechaMaestro undefined → sin_dato_maestro).
 */
export function fechasMaestroPorHito(
  hitos: { id: string; catalogoColumna: string | null }[],
  lineaMaestro: { columna: string; fecha: string | null }[],
): Map<string, string | null> {
  const porColumna = new Map(
    lineaMaestro.map((c) => [c.columna.trim().toLowerCase(), c.fecha]),
  );
  const out = new Map<string, string | null>();
  for (const h of hitos) {
    const col = h.catalogoColumna?.trim().toLowerCase();
    if (!col || !porColumna.has(col)) continue;
    out.set(h.id, porColumna.get(col) ?? null);
  }
  return out;
}

/**
 * Cuenta las discrepancias pendientes de un activo × trimestre. Los hitos
 * archivados no deben entrar (los filtra el caller al construir `hitos`).
 */
export function contarPendientes(
  hitos: { id: string; catalogoColumna: string | null; fechaOficial: string | null }[],
  lineaMaestro: { columna: string; fecha: string | null }[],
  resoluciones: Map<string, ResolucionFoto>,
): number {
  const fechasMaestro = fechasMaestroPorHito(hitos, lineaMaestro);
  let pendientes = 0;
  for (const h of hitos) {
    const estado = estadoDiscrepancia({
      fechaOficial: h.fechaOficial,
      fechaMaestro: fechasMaestro.has(h.id) ? fechasMaestro.get(h.id) : undefined,
      resolucion: resoluciones.get(h.id) ?? null,
    });
    if (estado === "pendiente") pendientes += 1;
  }
  return pendientes;
}
