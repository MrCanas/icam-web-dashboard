/**
 * Saneado y construcción de los parámetros de URL del tab Corporativas.
 *
 * Mismo principio que en portfolio: los filtros viven en la query string y no en
 * estado de cliente, porque las páginas son Server Components y filtran en
 * servidor. Así la vista es compartible por enlace y el botón atrás funciona.
 */
import { SOCIEDADES, type Sociedad } from "@/modules/corporativo/types";

/** Granularidad temporal: qué `tipo_periodo` se pinta en las series. */
export type Granularidad = "trimestre" | "anio";

export const SOCIEDAD_DEFAULT: Sociedad = "GRUPO";
export const GRANULARIDAD_DEFAULT: Granularidad = "trimestre";

const GRANULARIDADES: Granularidad[] = ["trimestre", "anio"];

/** El maestro arranca en 2021 (primer trimestre con datos de GIIC). */
export const ANIO_MINIMO = 2021;
/** Techo generoso: solo sirve para descartar basura en la query string. */
const ANIO_MAXIMO = 2100;

export function sanitizeSociedad(raw?: string): Sociedad {
  return SOCIEDADES.find((s) => s === raw) ?? SOCIEDAD_DEFAULT;
}

export function sanitizeGranularidad(raw?: string): Granularidad {
  return GRANULARIDADES.find((g) => g === raw) ?? GRANULARIDAD_DEFAULT;
}

/** Año desde el que arrancan las series. `undefined` = sin recorte. */
export function sanitizeDesde(raw?: string): number | undefined {
  if (!raw) return undefined;
  const n = Number(raw);
  if (!Number.isInteger(n) || n < ANIO_MINIMO || n > ANIO_MAXIMO) return undefined;
  return n === ANIO_MINIMO ? undefined : n;
}

/**
 * ¿Se pintan los periodos de PREVISIÓN? Por defecto sí, diferenciados: esconder
 * el plan del año en curso deja media gráfica sin explicación. Solo se escribe en
 * la URL cuando se apagan.
 */
export function sanitizePrevision(raw?: string): boolean {
  return raw !== "0";
}

/** El tipo_periodo de `corp_periodos` que corresponde a cada granularidad. */
export function tipoPeriodoDe(granularidad: Granularidad): "TRIMESTRE" | "AÑO" {
  return granularidad === "anio" ? "AÑO" : "TRIMESTRE";
}

export interface CorporativoUrlParams {
  sociedad?: Sociedad;
  granularidad?: Granularidad;
  desde?: number;
  prevision?: boolean;
}

/**
 * Href con solo lo que se aparta de los valores por defecto, para que la URL
 * limpia sea la del estado sin filtrar.
 */
export function buildCorporativoHref(basePath: string, params: CorporativoUrlParams): string {
  const search = new URLSearchParams();

  if (params.sociedad && params.sociedad !== SOCIEDAD_DEFAULT) {
    search.set("sociedad", params.sociedad);
  }
  if (params.granularidad && params.granularidad !== GRANULARIDAD_DEFAULT) {
    search.set("granularidad", params.granularidad);
  }
  if (typeof params.desde === "number" && params.desde > ANIO_MINIMO) {
    search.set("desde", String(params.desde));
  }
  if (params.prevision === false) search.set("prevision", "0");

  const query = search.toString();
  return query ? `${basePath}?${query}` : basePath;
}
