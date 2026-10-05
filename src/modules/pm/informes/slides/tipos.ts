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
  /**
   * Nodos que van fuera del área de contenido, colocados por su propio CSS (los
   * logos de colaboradores). Lo usa el editor al abrir una plantilla cerrada
   * para reorganizarla: se pinta igual que la plantilla original.
   */
  fuera?: NodoJson[];
}

/**
 * Imagen colocada a mano en un área de la slide, por encima de su contenido:
 * no forma parte de la plantilla ni del flujo. Unidades de slide (960 × 540).
 */
export interface Flotante {
  id: string;
  src: string;
  x: number;
  y: number;
  ancho: number;
  alto: number;
  /** Punto de la foto que queda a la vista (0–1), como en ImagenMarco. */
  focalX?: number;
  focalY?: number;
  /** Viene del informe anterior y nadie la ha tocado todavía en este. */
  heredada?: boolean;
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
  /** Imágenes puestas a mano en un área; las pinta `elemento()` encima de la slide. */
  flotantes?: Flotante[];
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
