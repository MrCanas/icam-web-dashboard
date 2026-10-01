import type { SlideJson } from "../slides/tipos";
import type { Analisis, Fuente, Seleccion } from "../types";

/**
 * Información dirigida: una fuente (un documento) que el equipo aporta para
 * unas slides concretas —el informe financiero para las slides de finanzas—
 * en lugar de para todo el informe. Solo la ven las peticiones de esas slides,
 * que Claude monta por completo con ella.
 *
 * Qué fuente va a qué slides se guarda en `seleccion.dirigidas` (fuente → slides
 * y en cuáles ya se ha aplicado), sin tocar el esquema de la base de datos.
 */

type Dirigidas = NonNullable<Seleccion["dirigidas"]>;

function dirigidasDe(seleccion: Seleccion | null | undefined): Dirigidas {
  return seleccion?.dirigidas ?? {};
}

/** Selección sobre la que anotar, cuando el informe aún no tenía ninguna guardada. */
export function seleccionBase(seleccion: Seleccion | null | undefined, analisis: Analisis | null | undefined): Seleccion {
  return seleccion ?? { estructura: analisis?.estructura ?? [], anadir: [] };
}

/** Slides a las que va dirigida una fuente; vacío si es información general. */
export function slidesDeFuente(seleccion: Seleccion | null | undefined, fuenteId: number): string[] {
  return dirigidasDe(seleccion)[String(fuenteId)]?.slides ?? [];
}

/** Fuente → slides, para montar los prompts en el servidor. */
export function mapaDirigidas(seleccion: Seleccion | null | undefined): Record<string, string[]> {
  const out: Record<string, string[]> = {};
  for (const [id, d] of Object.entries(dirigidasDe(seleccion))) if (d.slides?.length) out[id] = d.slides;
  return out;
}

/** Fuentes incluidas, con texto, dirigidas a un slide. */
export function fuentesParaSlide(dirigidas: Record<string, string[]>, fuentes: Fuente[], slideId: string): Fuente[] {
  return fuentes.filter((f) => f.incluida && f.texto.trim() && dirigidas[String(f.id)]?.includes(slideId));
}

/** Dirige una fuente a unas slides (ninguna = vuelve a ser información general). Lo ya aplicado se conserva. */
export function dirigirFuente(seleccion: Seleccion, fuenteId: number, slides: string[]): Seleccion {
  const dirigidas = { ...dirigidasDe(seleccion) };
  const clave = String(fuenteId);
  const unicas = [...new Set(slides)];
  if (!unicas.length) delete dirigidas[clave];
  else dirigidas[clave] = { slides: unicas, aplicadas: (dirigidas[clave]?.aplicadas ?? []).filter((s) => unicas.includes(s)) };
  return { ...seleccion, dirigidas };
}

/** Anota que un slide ya se ha montado con las fuentes dirigidas a él. */
export function marcarAplicadas(seleccion: Seleccion, slideIds: string[]): Seleccion {
  const dirigidas: Dirigidas = {};
  for (const [id, d] of Object.entries(dirigidasDe(seleccion))) {
    dirigidas[id] = { slides: d.slides, aplicadas: [...new Set([...(d.aplicadas ?? []), ...slideIds.filter((s) => d.slides.includes(s))])] };
  }
  return { ...seleccion, dirigidas };
}

/** Al deshacer el montaje de un slide, su información dirigida vuelve a estar pendiente. */
export function desmarcarAplicadas(seleccion: Seleccion, slideIds: string[]): Seleccion {
  const dirigidas: Dirigidas = {};
  for (const [id, d] of Object.entries(dirigidasDe(seleccion))) {
    dirigidas[id] = { slides: d.slides, aplicadas: (d.aplicadas ?? []).filter((s) => !slideIds.includes(s)) };
  }
  return { ...seleccion, dirigidas };
}

/** Slides que tienen alguna fuente dirigida utilizable (incluida y con texto). */
export function slidesConDirigidas(seleccion: Seleccion | null | undefined, fuentes: Fuente[]): Set<string> {
  const out = new Set<string>();
  for (const [id, d] of Object.entries(dirigidasDe(seleccion))) {
    const f = fuentes.find((x) => String(x.id) === id);
    if (f?.incluida && f.texto.trim()) d.slides.forEach((s) => out.add(s));
  }
  return out;
}

/** Quita las anotaciones de fuentes que ya no existen. */
export function sinFuentesBorradas(seleccion: Seleccion, fuentes: Fuente[]): Seleccion {
  const vivas = new Set(fuentes.map((f) => String(f.id)));
  const dirigidas = Object.fromEntries(Object.entries(dirigidasDe(seleccion)).filter(([id]) => vivas.has(id)));
  return { ...seleccion, dirigidas };
}

export interface PendienteDirigida {
  slide: SlideJson;
  /** Posición entre las slides visibles (1, 2, 3…). */
  pagina: number;
  fuentes: Fuente[];
}

/**
 * Slides visibles con información dirigida que todavía no se ha aplicado, en
 * el orden del informe.
 */
export function pendientesDirigidas(seleccion: Seleccion | null | undefined, fuentes: Fuente[], slides: SlideJson[]): PendienteDirigida[] {
  const d = dirigidasDe(seleccion);
  const out: PendienteDirigida[] = [];
  slides
    .filter((s) => !s.oculto)
    .forEach((slide, i) => {
      const suyas = fuentes.filter((f) => {
        const x = d[String(f.id)];
        return f.incluida && f.texto.trim() && x?.slides.includes(slide.id) && !(x.aplicadas ?? []).includes(slide.id);
      });
      if (suyas.length) out.push({ slide, pagina: i + 1, fuentes: suyas });
    });
  return out;
}
