import type { SlideJson } from "../slides/tipos";
import type { Analisis, HitoCronograma, PrevioEstructurado } from "../types";
import { normalizarHitos } from "./analisis";
import { clon, nodosDe } from "./informe";

/**
 * El cronograma del informe anterior se conserva: mismos hitos, salvo que el
 * equipo diga otra cosa. Claude lo sabe por el prompt, pero aquí se comprueba:
 * tras redactar, los hitos que falten se reponen en su Timeline y queda aviso.
 *
 * La lista que manda es `analisis.hitosPrevios` si existe (el equipo la ha
 * podido editar en el paso 3); si no, la de los Timeline del previo.
 */

/** Clave de comparación de un hito: el título sin tildes, mayúsculas ni signos. */
export function claveHito(titulo: string): string {
  return titulo
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/** Todos los hitos de los Timeline de unas slides (sin ocultas), con la slide en la que están. */
export function hitosDeSlides(slides: SlideJson[]): HitoCronograma[] {
  const out: HitoCronograma[] = [];
  for (const s of slides) {
    if (s.oculto) continue;
    for (const t of nodosDe(s, "Timeline")) {
      const props = (t.props ?? {}) as { hitos?: unknown };
      for (const h of normalizarHitos(props.hitos)) out.push({ ...h, slide: s.id });
    }
  }
  return out;
}

/** Hitos que el informe tiene que conservar. Vacío si no hay cronograma previo. */
export function hitosObligatorios(analisis: Analisis | null, previo: PrevioEstructurado | null): HitoCronograma[] {
  if (analisis?.hitosPrevios) return analisis.hitosPrevios;
  return previo ? hitosDeSlides(previo.slides) : [];
}

/** ¿Lleva esta slide cronograma (o le toca llevarlo)? */
export function esSlideDeCronograma(slideId: string, obligatorios: HitoCronograma[], slide?: SlideJson | null): boolean {
  if (obligatorios.some((h) => h.slide === slideId)) return true;
  if (slide && nodosDe(slide, "Timeline").length) return true;
  return /^calendario/.test(slideId);
}

/** Texto para el prompt: la lista de hitos que hay que conservar. */
export function bloqueCronograma(obligatorios: HitoCronograma[]): string | null {
  if (!obligatorios.length) return null;
  return (
    "== CRONOGRAMA QUE SE CONSERVA ==\n" +
    "El informe anterior tenía estos hitos. Consérvalos TODOS, con el mismo título y en el mismo orden: solo puedes cambiar «hecho» o la fecha si las fuentes lo justifican (y dilo en «fuentes»). " +
    "No quites ni fusiones hitos, salvo que el equipo lo pida expresamente en su instrucción.\n" +
    obligatorios.map((h) => `- ${h.titulo} · ${h.fecha || "sin fecha"} · ${h.hecho ? "hecho" : "pendiente"}`).join("\n")
  );
}

export interface CambioHito {
  tipo: "repuesto" | "fecha";
  titulo: string;
  slide: string;
  antes?: string;
  despues?: string;
}

/**
 * Repone en las slides los hitos obligatorios que falten (salvo los que el
 * equipo ha pedido quitar) y lista los cambios de fecha. Cada hito vuelve al
 * Timeline de su slide de origen o, si esa ya no tiene, al primero que haya.
 * No muta: devuelve las slides nuevas.
 */
export function reponerHitos(
  slides: SlideJson[],
  obligatorios: HitoCronograma[],
  o: { quitados?: string[]; soloSlides?: string[] } = {},
): { slides: SlideJson[]; cambios: CambioHito[] } {
  if (!obligatorios.length) return { slides, cambios: [] };
  const quitados = new Set((o.quitados ?? []).map(claveHito));
  const out = clon(slides);
  const cambios: CambioHito[] = [];
  const presentes = new Map(hitosDeSlides(out).map((h) => [claveHito(h.titulo), h]));
  const timelines = (s: SlideJson) => nodosDe(s, "Timeline");
  // Solo se repone en slides que se pueden tocar en esta operación (y nunca en cerradas).
  const editable = (s: SlideJson) => !s.oculto && !s.cerrada && (!o.soloSlides || o.soloSlides.includes(s.id));
  const conTimeline = out.filter((s) => editable(s) && timelines(s).length);
  if (!conTimeline.length) return { slides, cambios: [] };

  obligatorios.forEach((h, idx) => {
    const k = claveHito(h.titulo);
    const actual = presentes.get(k);
    if (actual) {
      if (h.fecha && actual.fecha && h.fecha !== actual.fecha) {
        cambios.push({ tipo: "fecha", titulo: h.titulo, slide: actual.slide ?? "", antes: h.fecha, despues: actual.fecha });
      }
      return;
    }
    if (quitados.has(k)) return;
    const destino = conTimeline.find((s) => s.id === h.slide) ?? conTimeline[0]!;
    const t = timelines(destino)[0]!;
    const props = (t.props ?? (t.props = {})) as { hitos?: unknown[] };
    const lista = Array.isArray(props.hitos) ? props.hitos : (props.hitos = []);
    // En su sitio relativo: tras el hito obligatorio anterior que sí esté en este Timeline.
    let pos = lista.length;
    for (let j = idx - 1; j >= 0; j--) {
      const prev = claveHito(obligatorios[j]!.titulo);
      const i = lista.findIndex((x) => x && typeof x === "object" && claveHito(String((x as { titulo?: unknown }).titulo ?? "")) === prev);
      if (i >= 0) {
        pos = i + 1;
        break;
      }
      if (j === 0) pos = 0;
    }
    if (idx === 0) pos = 0;
    lista.splice(pos, 0, { titulo: h.titulo, fecha: h.fecha, hecho: h.hecho });
    presentes.set(k, { ...h, slide: destino.id });
    cambios.push({ tipo: "repuesto", titulo: h.titulo, slide: destino.id });
  });
  return { slides: out, cambios };
}

/** Los cambios del cronograma como texto para el aviso. */
export function textoCambioHito(c: CambioHito): string {
  return c.tipo === "repuesto"
    ? `El hito «${c.titulo}» del informe anterior faltaba en el cronograma: se ha repuesto tal como estaba.`
    : `El hito «${c.titulo}» cambia de fecha: ${c.antes} → ${c.despues}. Comprueba que las fuentes lo justifican.`;
}
