/**
 * Formato de informe.json: el mismo del skill `informe-trimestral` y de la app
 * del equipo, para que los informes ya hechos se importen tal cual.
 * Referencia completa en referencia/layouts.md.
 */

/** Texto con «**negrita**». */
export type Rich = string;

export interface Pie {
  variante: "sl" | "cnmv";
  vehiculo?: string;
  nif?: string;
  entidad?: string;
  tipo?: string;
  fondo?: string;
  isin?: string;
}

export interface MetaInforme {
  proyecto: string;
  codigo: string;
  trimestre: string;
  trimestreAnterior?: string;
  siguiente?: string;
  fechaCierre?: string;
  arquetipo?: string;
  pie?: Pie;
  version?: string;
  estado?: string;
  actualizado?: string;
  [clave: string]: unknown;
}

/** Nodo del JSON: texto, número o {c, props, hijos}. Cualquier prop con forma de nodo se pinta. */
export type NodoJson =
  | string
  | number
  | boolean
  | null
  | undefined
  | NodoJson[]
  | { c?: string; props?: Record<string, unknown>; hijos?: NodoJson[]; [k: string]: unknown };

export interface Compuesto {
  layout?: string;
  seccion?: number;
  titulo?: string;
  clase?: string;
  estilo?: Record<string, unknown>;
  contenido?: NodoJson[];
  nota?: Rich;
}

export interface SlideJson {
  id: string;
  c?: string;
  props?: Record<string, unknown>;
  hijos?: NodoJson[];
  compuesto?: Compuesto;
  oculto?: boolean;
  /** heredada · actualizada · nueva · bloqueada */
  origen?: string;
  fuentes?: string;
}

export interface InformeJson {
  meta: MetaInforme;
  slides: SlideJson[];
}

/** Resultado de medir y airear un slide pintado. */
export interface Medida {
  ocupacion: number;
  relleno: number;
  desborde: boolean;
}
