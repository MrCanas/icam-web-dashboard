import type { CuentaInversion } from "@/modules/portfolio/inversores/types";

/**
 * Un fotograma de la pila del drill-down.
 *
 * Dos niveles: de una cifra agregada a las cuentas que la componen, y de una
 * cuenta a sus contactos con su correo. Es literalmente el recorrido que se
 * pidió: «si pone que hay 12 cuentas, que me aparezcan las 12; y si me meto en
 * una, sus contactos con sus correos».
 */
export type NivelInversores =
  | { nivel: "cuentas"; titulo: string; subtitulo?: string; cuentas: CuentaInversion[] }
  | { nivel: "cuenta"; titulo: string; subtitulo?: string; cuenta: CuentaInversion };

/** Lo que abre una marca de gráfica, una fila de leyenda o un KPI. */
export interface AperturaCuentas {
  titulo: string;
  subtitulo?: string;
  cuentas: CuentaInversion[];
}
