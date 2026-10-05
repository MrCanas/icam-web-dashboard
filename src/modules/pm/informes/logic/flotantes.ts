import type { Flotante, SlideJson } from "../slides/tipos";

/**
 * Imágenes flotantes: las que el equipo pone a mano dibujando un área sobre la
 * slide. Van aparte del contenido (`slide.flotantes`), en unidades de slide, y
 * se pintan encima de todo; por eso valen en cualquier plantilla, también en
 * portada, índice, cierre y las páginas de Finanzas. Lógica pura: ninguna
 * función modifica lo que recibe.
 */

export const ANCHO_SLIDE = 960;
export const ALTO_SLIDE = 540;
/** Lado mínimo de una imagen flotante, en unidades de slide. */
export const MIN_FLOTANTE = 24;

/** Rectángulo en unidades de slide. */
export interface CajaSlide {
  x: number;
  y: number;
  ancho: number;
  alto: number;
}

const entre = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v));

/** Caja con medidas enteras, de tamaño válido y entera dentro de la slide. */
export function limitarCaja(c: CajaSlide): CajaSlide {
  const ancho = entre(Math.round(c.ancho), MIN_FLOTANTE, ANCHO_SLIDE);
  const alto = entre(Math.round(c.alto), MIN_FLOTANTE, ALTO_SLIDE);
  return { x: entre(Math.round(c.x), 0, ANCHO_SLIDE - ancho), y: entre(Math.round(c.y), 0, ALTO_SLIDE - alto), ancho, alto };
}

function esFlotante(v: unknown): v is Flotante {
  if (!v || typeof v !== "object" || Array.isArray(v)) return false;
  const f = v as Record<string, unknown>;
  return (
    typeof f.id === "string" &&
    typeof f.src === "string" &&
    !!f.src &&
    [f.x, f.y, f.ancho, f.alto].every((n) => typeof n === "number" && Number.isFinite(n))
  );
}

/** Las imágenes flotantes bien formadas de un valor cualquiera (lo que no lo esté se ignora, no rompe el pintado). */
export function flotantesValidos(v: unknown): Flotante[] {
  return Array.isArray(v) ? v.filter(esFlotante) : [];
}

function conLista(slide: SlideJson, lista: Flotante[]): SlideJson {
  const s: SlideJson = { ...slide };
  if (lista.length) s.flotantes = lista;
  else delete s.flotantes;
  return s;
}

/** Cambia una flotante; tocarla la da por revisada (deja de ser «heredada»). */
function cambiar(slide: SlideJson, id: string, fn: (f: Flotante) => Flotante): SlideJson {
  const lista = flotantesValidos(slide.flotantes);
  if (!lista.some((f) => f.id === id)) throw new Error("Esa imagen ya no está en la slide.");
  return conLista(
    slide,
    lista.map((f) => {
      if (f.id !== id) return f;
      const n = fn({ ...f });
      delete n.heredada;
      return n;
    }),
  );
}

/** Pone una imagen en un área de la slide. Devuelve la slide y el id de la imagen nueva. */
export function anadirFlotante(slide: SlideJson, src: string, caja: CajaSlide): { slide: SlideJson; id: string } {
  const lista = flotantesValidos(slide.flotantes);
  let n = lista.length + 1;
  while (lista.some((f) => f.id === `f${n}`)) n++;
  const id = `f${n}`;
  return { slide: conLista(slide, [...lista, { id, src, ...limitarCaja(caja) }]), id };
}

/** Mueve o redimensiona una imagen flotante: su caja pasa a ser `caja`, ajustada a la slide. */
export function colocarFlotante(slide: SlideJson, id: string, caja: CajaSlide): SlideJson {
  return cambiar(slide, id, (f) => ({ ...f, ...limitarCaja(caja) }));
}

export function quitarFlotante(slide: SlideJson, id: string): SlideJson {
  return conLista(
    slide,
    flotantesValidos(slide.flotantes).filter((f) => f.id !== id),
  );
}

/** Cambia la foto de una imagen flotante; el encuadre vuelve al centro. */
export function cambiarFotoFlotante(slide: SlideJson, id: string, src: string): SlideJson {
  return cambiar(slide, id, (f) => {
    delete f.focalX;
    delete f.focalY;
    return { ...f, src };
  });
}

/** Punto de la foto que debe quedar a la vista (0–1 en cada eje). */
export function reencuadrarFlotante(slide: SlideJson, id: string, x: number, y: number): SlideJson {
  const limitar = (v: number) => Math.round(entre(v, 0, 1) * 100) / 100;
  return cambiar(slide, id, (f) => ({ ...f, focalX: limitar(x), focalY: limitar(y) }));
}

/** Da por buena una imagen heredada del informe anterior, sin cambiarla. */
export function confirmarFlotante(slide: SlideJson, id: string): SlideJson {
  return cambiar(slide, id, (f) => f);
}

/** La slide sin sus imágenes flotantes (lo que se le enseña a Claude). */
export function sinFlotantes(slide: SlideJson): SlideJson {
  return conLista(slide, []);
}

/**
 * `nueva` con las imágenes flotantes de `anterior`. Para cuando una slide se
 * rehace entera (Claude, o las que se montan solas): lo que el equipo colocó a
 * mano encima no se pierde.
 */
export function conFlotantesDe(anterior: SlideJson | null | undefined, nueva: SlideJson): SlideJson {
  return conLista(nueva, flotantesValidos(anterior?.flotantes));
}

/** Slides cuyo contenido no cambia de un trimestre a otro: lo colocado encima sigue teniendo sentido. */
const HEREDAN = ["portada", "disclaimer", "cierre"];

/**
 * Imágenes flotantes que pasan del informe anterior al nuevo: solo en las
 * slides cuyo contenido no cambia (las que se mantienen, portada, disclaimer y
 * cierre). En las que se reescriben taparían un contenido distinto. Llegan
 * marcadas como heredadas para que la revisión avise.
 */
export function flotantesAlHeredar(accion: string, id: string, prev: SlideJson | null | undefined): Flotante[] {
  if (!prev || !(accion === "mantener" || HEREDAN.includes(id))) return [];
  return flotantesValidos(prev.flotantes).map((f) => ({ ...f, heredada: true }));
}
