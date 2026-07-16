/**
 * Columnas de hito que EXISTEN hoy en la hoja "Tabla madre" del maestro
 * financiero (20260414 MAESTRO - VEHICULOS ICAM.xlsm).
 *
 * Leídas del fichero real, no inferidas. Son 8 pares flag+fecha en DW-EL, con
 * una fila por proyecto y por trimestre (columna H «Trimestre»), lo que ya es un
 * mecanismo de snapshots equivalente al de PM.
 *
 * PM maneja 17 hitos, así que estos 8 cubren aproximadamente la mitad y ninguno
 * de la fase pre-obra (anteproyecto, proyecto básico/ejecutivo, solicitud vs
 * obtención de licencia, licitación), que es donde más se desvían los proyectos.
 *
 * Esta lista alimenta el desplegable del mapeo y decide `tabla_madre_existe`:
 * si la PMO escribe una cabecera que NO está aquí, se guarda como PROPUESTA
 * para el día que se añada la columna al Excel.
 *
 * OJO al mantenerla: el emparejamiento hito PM → columna NO se hardcodea, lo
 * decide la PMO en la UI. Aquí solo está el catálogo de columnas disponibles.
 */
export interface TablaMadreColumnaHito {
  /** Cabecera literal de la fecha, tal cual aparece en la fila 1 de la hoja. */
  cabecera: string;
  /** Letra de columna en la hoja, para trazabilidad con el Excel. */
  letra: string;
  /** Cabecera del booleano que la acompaña (hito alcanzado sí/no). */
  flag: string;
}

export const TABLA_MADRE_COLUMNAS_HITO: readonly TablaMadreColumnaHito[] = [
  { cabecera: "Fecha Adquisición", letra: "DX", flag: "Adquisición" },
  { cabecera: "Fecha Licencia y Financiación", letra: "DZ", flag: "Licencia y financiación" },
  { cabecera: "Fecha obra", letra: "EB", flag: "Obra" },
  { cabecera: "Fecha LPO", letra: "ED", flag: "LPO" },
  { cabecera: "Fecha Explotación", letra: "EF", flag: "Explotación" },
  { cabecera: "Fecha Desinversión", letra: "EH", flag: "Desinversión" },
  { cabecera: "Fecha entrega", letra: "EJ", flag: "Entrega de viviendas" },
  { cabecera: "Fecha Finalización", letra: "EL", flag: "Finalizado" },
] as const;

/** Estado de mapeo de un hito, para el señalado en la rejilla. */
export type EstadoMapeoTablaMadre = "en_tabla_madre" | "propuesto" | "sin_mapear";

export function estadoMapeo(
  tablaMadreColumna: string | null,
  tablaMadreExiste: boolean,
): EstadoMapeoTablaMadre {
  if (!tablaMadreColumna) return "sin_mapear";
  return tablaMadreExiste ? "en_tabla_madre" : "propuesto";
}

export const ETIQUETA_MAPEO: Record<EstadoMapeoTablaMadre, string> = {
  en_tabla_madre: "En Tabla madre",
  propuesto: "Propuesto",
  sin_mapear: "Sin mapear",
};
