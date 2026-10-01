"use client";

import { gruposDeImagenes, mismaRuta, nodosDe, sinFormato, type GrupoImagenes, type NodoArbol } from "../../logic/edicion";
import type { Ruta } from "../../logic/informe";
import type { SlideJson } from "../../slides/tipos";

/**
 * Relación entre la slide pintada y su JSON, para la edición a mano. Los
 * componentes de slide no llevan marcas: se recorre en paralelo el árbol de
 * bloques (logic/edicion.ts) y el DOM, y solo se da por buena una
 * correspondencia cuando los recuentos cuadran.
 */

/** Rectángulo en píxeles de pantalla, relativo a la capa de edición. */
export interface Caja {
  x: number;
  y: number;
  w: number;
  h: number;
}

export function cajaDe(el: Element, capa: Element): Caja {
  const r = el.getBoundingClientRect();
  const b = capa.getBoundingClientRect();
  return { x: r.left - b.left, y: r.top - b.top, w: r.width, h: r.height };
}

/* ------------------------------------------------------------------ textos */

const BLOQUE_TEXTO = "p, li, td, th, h1, h2, h3, figcaption, .iq-nota, .iq-nota-inline";
/** Texto que pone la plantilla con datos del informe (pie legal, número de página): no sale del slide. */
const FUERA = ".iq-pie, .iq-pagina";

function tieneTextoPropio(el: Element): boolean {
  return Array.from(el.childNodes).some((n) => n.nodeType === Node.TEXT_NODE && !!n.nodeValue?.trim());
}

/** Párrafo, viñeta, celda o rótulo que hay bajo un elemento de la slide; null si no es texto editable. */
export function bloqueDeTexto(lienzo: HTMLElement, objetivo: EventTarget | null): HTMLElement | null {
  if (!(objetivo instanceof HTMLElement) || !lienzo.contains(objetivo) || objetivo.closest(FUERA)) return null;
  const bloque = objetivo.closest<HTMLElement>(BLOQUE_TEXTO);
  if (bloque && lienzo.contains(bloque)) return bloque.textContent?.trim() ? bloque : null;
  // Rótulos sueltos (cifras de KPI, etiquetas): el propio elemento, o su padre si es una negrita o un resaltado.
  let el: HTMLElement | null = objetivo;
  while (el && el !== lienzo && ["STRONG", "EM", "MARK", "SPAN"].includes(el.tagName) && !tieneTextoPropio(el)) el = el.parentElement;
  if (!el || el === lienzo) return null;
  if (tieneTextoPropio(el)) return el;
  return el.children.length === 0 && el.textContent?.trim() ? el : null;
}

/** Texto exacto bajo el cursor (el trozo de un párrafo con negritas, la línea de un título partido). */
export function textoPulsado(x: number, y: number, bloque: HTMLElement): string {
  const doc = document as Document & {
    caretPositionFromPoint?: (x: number, y: number) => { offsetNode: Node } | null;
    caretRangeFromPoint?: (x: number, y: number) => Range | null;
  };
  const nodo = doc.caretPositionFromPoint?.(x, y)?.offsetNode ?? doc.caretRangeFromPoint?.(x, y)?.startContainer ?? null;
  if (nodo && nodo.nodeType === Node.TEXT_NODE && bloque.contains(nodo) && nodo.nodeValue?.trim()) return nodo.nodeValue;
  return bloque.textContent ?? "";
}

/** Posición de un bloque entre los que tienen su mismo texto, para distinguir textos repetidos. */
export function ocurrencia(lienzo: HTMLElement, bloque: HTMLElement): number {
  const texto = sinFormato(bloque.textContent ?? "");
  const iguales = Array.from(lienzo.querySelectorAll<HTMLElement>(bloque.tagName.toLowerCase())).filter(
    (el) => !el.closest(FUERA) && sinFormato(el.textContent ?? "") === texto,
  );
  return Math.max(0, iguales.indexOf(bloque));
}

/* ------------------------------------------------------------------ bloques */

export interface BloquePintado {
  nodo: NodoArbol;
  padre: NodoArbol;
  el: HTMLElement;
}

export interface ImagenPintada {
  ruta: Ruta;
  grupo: GrupoImagenes;
  indice: number;
  el: HTMLElement;
}

export interface MapaSlide {
  /** Todos los nodos del árbol con su elemento (bloques y contenedores intermedios). */
  bloques: BloquePintado[];
  /** Contenedores cuyo contenido pintado cuadra con el JSON: admiten soltar y reordenar. */
  contenedores: { nodo: NodoArbol; el: HTMLElement }[];
  imagenes: ImagenPintada[];
  /** Contenedores que no cuadran: ahí no se ofrece mover nada. */
  desajustes: number;
}

/** Empareja el árbol de bloques de un slide (normalizado) con su pintado. */
export function mapaSlide(lienzo: HTMLElement, slide: SlideJson, arbol: NodoArbol | null): MapaSlide {
  const mapa: MapaSlide = { bloques: [], contenedores: [], imagenes: [], desajustes: 0 };
  const area = lienzo.querySelector<HTMLElement>(".iq-contenido");

  function emparejar(nodo: NodoArbol, el: HTMLElement) {
    const c = nodo.contenedor;
    if (!c) return;
    const hijos = Array.from(el.children) as HTMLElement[];
    if (c.mixto || hijos.length !== c.hijos.length) {
      mapa.desajustes++;
      return;
    }
    mapa.contenedores.push({ nodo, el });
    c.hijos.forEach((h, i) => {
      mapa.bloques.push({ nodo: h, padre: nodo, el: hijos[i]! });
      emparejar(h, hijos[i]!);
    });
  }
  if (arbol && area) emparejar(arbol, area);

  for (const grupo of gruposDeImagenes(slide)) {
    const el =
      grupo.tipo === "TextoImagen"
        ? lienzo.querySelector<HTMLElement>(".iq-imagenes-col")
        : (mapa.bloques.find((b) => mismaRuta(b.nodo.ruta, grupo.nodo))?.el ?? null);
    if (!el) continue;
    const figuras = el.matches("figure.iq-figura") ? [el] : (Array.from(el.querySelectorAll(":scope > figure.iq-figura")) as HTMLElement[]);
    if (figuras.length !== grupo.imagenes.length) continue;
    figuras.forEach((f, i) => {
      // El hueco de la foto, sin el pie: la imagen o su marcador de «falta foto».
      const hueco = f.querySelector<HTMLElement>("img.iq-img, .iq-ph") ?? f;
      mapa.imagenes.push({ ruta: grupo.imagenes[i]!, grupo, indice: i, el: hueco });
    });
  }
  return mapa;
}

/**
 * Bloque que se mueve al pulsar uno: si es el único de su grupo (un timeline
 * dentro de un `div` que solo lo separa), se mueve el grupo entero.
 */
export function unidadDe(mapa: MapaSlide, bloque: BloquePintado): BloquePintado {
  let actual = bloque;
  for (;;) {
    const c = actual.padre.contenedor;
    const comoBloque = mapa.bloques.find((b) => b.nodo === actual.padre);
    if (!c || c.orientacion !== "pila" || c.hijos.length !== 1 || !comoBloque) return actual;
    // La columna de una rejilla no se promociona: mover su único bloque es cambiarlo de columna.
    if (comoBloque.padre.contenedor?.orientacion === "columnas") return actual;
    actual = comoBloque;
  }
}

/** Bloques que la PM puede seleccionar y mover: las hojas del árbol, agrupadas por `unidadDe`. */
export function seleccionables(mapa: MapaSlide, arbol: NodoArbol | null): BloquePintado[] {
  const out: BloquePintado[] = [];
  const nodos = new Set(nodosDe(arbol));
  for (const b of mapa.bloques) {
    if (b.nodo.contenedor || !nodos.has(b.nodo)) continue;
    const u = unidadDe(mapa, b);
    if (!out.includes(u)) out.push(u);
  }
  return out;
}

/* ------------------------------------------------------------------ encuadre */

/**
 * Encuadre (focalX, focalY) que deja en el centro del hueco el punto pulsado
 * de una foto recortada con `object-fit: cover`. `rx`/`ry` son la posición del
 * clic dentro del hueco (0–1); `actual` es el encuadre vigente.
 */
export function encuadreAlPulsar(img: HTMLImageElement, rx: number, ry: number, actual: { x: number; y: number }): { x: number; y: number } {
  const w = img.clientWidth;
  const h = img.clientHeight;
  if (!img.naturalWidth || !img.naturalHeight || !w || !h) return actual;
  const escala = Math.max(w / img.naturalWidth, h / img.naturalHeight);
  const eje = (pintado: number, hueco: number, pos: number, r: number) => {
    const sobra = pintado - hueco;
    if (sobra < 1) return pos;
    // Punto pulsado en coordenadas de la foto pintada, llevado al centro del hueco.
    const punto = sobra * pos + r * hueco;
    return Math.max(0, Math.min(1, (punto - hueco / 2) / sobra));
  };
  return {
    x: eje(img.naturalWidth * escala, w, actual.x, rx),
    y: eje(img.naturalHeight * escala, h, actual.y, ry),
  };
}
