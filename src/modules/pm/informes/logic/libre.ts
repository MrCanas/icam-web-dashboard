import type { SlideJson } from "../slides/tipos";
import { leerRuta } from "./edicion";
import { clon, type Ruta } from "./informe";

/**
 * Disposición libre de los bloques de una slide: un bloque marcado con `libre`
 * sale del flujo de su columna y se coloca donde diga `libre` (esquina
 * superior izquierda y ancho, en unidades de slide), dentro del área de
 * contenido. El resto de la slide se recoloca como si el bloque no estuviera.
 * Lógica pura: ninguna función modifica lo que recibe.
 */

/** Área de contenido de las slides (`.iq-contenido` en slides.css), en unidades de slide. */
export const AREA = { izquierda: 67, arriba: 80, derecha: 960 - 38, abajo: 540 - 36 };
/** Ancho mínimo de un bloque libre. */
export const MIN_LIBRE = 40;
/** Separación entre dos bloques alineados. */
export const HUECO_ALINEAR = 10;

export interface Libre {
  x: number;
  y: number;
  ancho: number;
}

/** Caja medida de un bloque (lo que se ve), para colocarlo o alinearlo. */
export interface CajaBloque extends Libre {
  alto: number;
}

type Objeto = Record<string, unknown>;

function esObjeto(v: unknown): v is Objeto {
  return !!v && typeof v === "object" && !Array.isArray(v);
}

const entre = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v));

/** Posición libre de un nodo, si la tiene bien formada. */
export function libreDe(nodo: unknown): Libre | null {
  if (!esObjeto(nodo) || !esObjeto(nodo.libre)) return null;
  const l = nodo.libre;
  return [l.x, l.y, l.ancho].every((n) => typeof n === "number" && Number.isFinite(n)) ? { x: l.x as number, y: l.y as number, ancho: l.ancho as number } : null;
}

/** Caja entera, con el ancho mínimo y dentro del área de contenido (la parte de abajo puede quedar fuera: el alto no se controla). */
export function limitarLibre(l: Libre): Libre {
  const ancho = entre(Math.round(l.ancho), MIN_LIBRE, AREA.derecha - AREA.izquierda);
  return {
    x: entre(Math.round(l.x), AREA.izquierda, AREA.derecha - ancho),
    y: entre(Math.round(l.y), AREA.arriba, AREA.abajo - 8),
    ancho,
  };
}

function nodoEn(s: SlideJson, ruta: Ruta): Objeto {
  const n = leerRuta(s, ruta);
  if (!esObjeto(n) || typeof n.c !== "string") throw new Error("Ese bloque ya no está en la slide.");
  return n;
}

/** Una imagen suelta ocupa todo el ancho de su caja libre: su `ancho` va con ella. */
function ajustarImagen(n: Objeto, ancho: number) {
  if (n.c !== "ImagenMarco") return;
  if (!esObjeto(n.props)) n.props = {};
  (n.props as Objeto).ancho = ancho;
}

/** Saca el bloque del flujo y lo deja en `caja` (o lo mueve, si ya era libre). */
export function colocarLibre(slide: SlideJson, ruta: Ruta, caja: Libre): SlideJson {
  const s = clon(slide);
  const n = nodoEn(s, ruta);
  const l = limitarLibre(caja);
  n.libre = l;
  ajustarImagen(n, l.ancho);
  return s;
}

/** Devuelve el bloque al flujo de su columna. */
export function volverAlFlujo(slide: SlideJson, ruta: Ruta): SlideJson {
  const s = clon(slide);
  const n = nodoEn(s, ruta);
  delete n.libre;
  return s;
}

export type EjeAlineacion = "horizontal" | "vertical";

export const RATIOS: { valor: string; nombre: string; partes: [number, number] | null }[] = [
  { valor: "", nombre: "Mantener tamaños", partes: null },
  { valor: "1:1", nombre: "Mitad y mitad", partes: [1, 1] },
  { valor: "2:3", nombre: "40 % – 60 %", partes: [2, 3] },
  { valor: "3:2", nombre: "60 % – 40 %", partes: [3, 2] },
  { valor: "1:2", nombre: "Un tercio – dos tercios", partes: [1, 2] },
  { valor: "2:1", nombre: "Dos tercios – un tercio", partes: [2, 1] },
  { valor: "3:7", nombre: "30 % – 70 %", partes: [3, 7] },
  { valor: "7:3", nombre: "70 % – 30 %", partes: [7, 3] },
];

/**
 * Alinea el bloque `a` con el bloque `b` (la referencia): los dos pasan a
 * disposición libre.
 * - horizontal: en la misma fila, con el borde superior de `b`; el de más a la
 *   izquierda se queda a la izquierda. Con ratio, se reparten el ancho que
 *   ocupaban entre los dos (de izquierda a derecha); sin ratio, cada uno
 *   conserva su ancho y van seguidos.
 * - vertical: en la misma columna, con el borde izquierdo y el ancho de `b`; el
 *   de más arriba se queda arriba. Con ratio, se reparten el alto que ocupaban
 *   entre los dos, pero solo si los dos son imágenes sueltas (lo demás no tiene
 *   alto fijo); sin ratio, van seguidos con el alto que tienen.
 */
export function alinear(
  slide: SlideJson,
  a: { ruta: Ruta; caja: CajaBloque },
  b: { ruta: Ruta; caja: CajaBloque },
  opciones: { eje: EjeAlineacion; ratio: [number, number] | null },
): SlideJson {
  const s = clon(slide);
  const na = nodoEn(s, a.ruta);
  const nb = nodoEn(s, b.ruta);
  const total = opciones.ratio ? opciones.ratio[0] + opciones.ratio[1] : 0;
  const parte = (i: 0 | 1, espacio: number) => (opciones.ratio ? Math.round(((espacio - HUECO_ALINEAR) * opciones.ratio[i]) / total) : null);
  if (opciones.eje === "horizontal") {
    const [primero, segundo] = a.caja.x <= b.caja.x ? ([a, b] as const) : ([b, a] as const);
    const izquierda = Math.min(a.caja.x, b.caja.x);
    const derecha = Math.max(a.caja.x + a.caja.ancho, b.caja.x + b.caja.ancho);
    const w1 = parte(0, derecha - izquierda) ?? primero.caja.ancho;
    const w2 = parte(1, derecha - izquierda) ?? segundo.caja.ancho;
    const l1 = limitarLibre({ x: izquierda, y: b.caja.y, ancho: w1 });
    const l2 = limitarLibre({ x: l1.x + l1.ancho + HUECO_ALINEAR, y: b.caja.y, ancho: w2 });
    for (const [ruta, l] of [[primero.ruta, l1], [segundo.ruta, l2]] as const) {
      const n = ruta === a.ruta ? na : nb;
      n.libre = l;
      ajustarImagen(n, l.ancho);
    }
    return s;
  }
  const [primero, segundo] = a.caja.y <= b.caja.y ? ([a, b] as const) : ([b, a] as const);
  const arriba = Math.min(a.caja.y, b.caja.y);
  const abajo = Math.max(a.caja.y + a.caja.alto, b.caja.y + b.caja.alto);
  const imagenes = na.c === "ImagenMarco" && nb.c === "ImagenMarco";
  const h1 = imagenes ? parte(0, abajo - arriba) : null;
  const h2 = imagenes ? parte(1, abajo - arriba) : null;
  const l1 = limitarLibre({ x: b.caja.x, y: arriba, ancho: b.caja.ancho });
  const l2 = limitarLibre({ x: b.caja.x, y: l1.y + (h1 ?? primero.caja.alto) + HUECO_ALINEAR, ancho: b.caja.ancho });
  for (const [ruta, l, h] of [[primero.ruta, l1, h1], [segundo.ruta, l2, h2]] as const) {
    const n = ruta === a.ruta ? na : nb;
    n.libre = l;
    ajustarImagen(n, l.ancho);
    if (h != null) (n.props as Objeto).alto = Math.max(MIN_LIBRE, h);
  }
  return s;
}
