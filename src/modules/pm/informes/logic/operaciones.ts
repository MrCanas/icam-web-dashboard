import type { SlideJson } from "../slides/tipos";
import { ESTRUCTURALES } from "./biblioteca";
import { conFlotantesDe } from "./flotantes";
import { clon, renumerar, textos, tituloDe } from "./informe";

/**
 * Operaciones de estructura sobre las slides del informe: referirse a ellas por
 * su número visible, desdoblar una en varias, fusionar varias en una, crear,
 * duplicar y cerrar. Lógica pura: Claude propone el resultado (petición
 * «revision») y aquí se aplica con las garantías de siempre (ids únicos, las
 * cerradas no se tocan, las imágenes puestas a mano se quedan, índice al día).
 */

/** Número visible de cada slide (1, 2, 3… sin contar ocultas), como lo pinta el editor. */
export function mapaNumeros(slides: SlideJson[]): { porId: Map<string, number>; porNumero: Map<number, string> } {
  const porId = new Map<string, number>();
  const porNumero = new Map<number, string>();
  slides
    .filter((s) => !s.oculto)
    .forEach((s, i) => {
      porId.set(s.id, i + 1);
      porNumero.set(i + 1, s.id);
    });
  return { porId, porNumero };
}

/** «Slide 5 · Calendario» para una slide visible; el id si está oculta o no existe. */
export function etiquetaSlide(slides: SlideJson[], id: string): string {
  const s = slides.find((x) => x.id === id);
  const n = mapaNumeros(slides).porId.get(id);
  if (!s) return id;
  return n ? `Slide ${n} · ${tituloDe(s)}` : `${tituloDe(s)} (oculta)`;
}

function numerosDeLista(lista: string): number[] {
  const out: number[] = [];
  // Rangos «5-7», «5 a 7», «de la 5 a la 7».
  const sinRangos = lista.replace(/(\d+)\s*(?:-|–|a(?:l)?(?:\s+la)?)\s*(\d+)/gi, (_, a: string, b: string) => {
    const x = Number(a);
    const y = Number(b);
    if (y >= x && y - x <= 40) for (let n = x; n <= y; n++) out.push(n);
    return " ";
  });
  for (const m of sinRangos.matchAll(/\d+/g)) out.push(Number(m[0]));
  return out;
}

/**
 * Slides que cita una instrucción por su número: «slide 5», «slides 3, 4 y 6»,
 * «diapositiva 2», «de la 5 a la 7», «junta la 7 y la 8». Devuelve ids, en el
 * orden en que aparecen y sin repetir; ignora números que no son slides.
 */
export function slidesCitadas(instruccion: string, slides: SlideJson[]): string[] {
  const { porNumero } = mapaNumeros(slides);
  const nums: number[] = [];
  const lista = String.raw`(\d+(?:\s*(?:,|y|e|-|–|a|al|o)\s*(?:la\s+|las\s+)?\d+)*)`;
  const conPalabra = new RegExp(String.raw`\b(?:slides?|diapositivas?|l[aá]minas?|p[aá]ginas?)\s+(?:n[ºo.]*\s*)?(?:de\s+)?(?:la\s+|las\s+)?` + lista, "gi");
  for (const m of instruccion.matchAll(conPalabra)) nums.push(...numerosDeLista(m[1]!));
  // «la 7 y la 8», «las 3 y 4»: solo con dos o más números (un «la 2» suelto puede ser cualquier cosa).
  const sueltas = new RegExp(String.raw`\b(?:la|las)\s+(\d+)((?:\s*(?:,|y|e)\s*(?:la\s+)?\d+)+)`, "gi");
  for (const m of instruccion.matchAll(sueltas)) nums.push(...numerosDeLista(`${m[1]} ${m[2]}`));
  const ids: string[] = [];
  for (const n of nums) {
    const id = porNumero.get(n);
    if (id && !ids.includes(id)) ids.push(id);
  }
  return ids;
}

/** Id libre derivado de otro: «obra-2» → «obra-2-b», «obra-2-c»… (mismo prefijo: misma sección). */
export function idDerivado(base: string, slides: { id: string }[], usados: Set<string> = new Set()): string {
  const raiz = base.replace(/-[b-z]$/, "");
  for (const letra of "bcdefghijklmnopqrstuvwxyz") {
    const id = `${raiz}-${letra}`;
    if (!slides.some((s) => s.id === id) && !usados.has(id)) return id;
  }
  let k = 2;
  while (slides.some((s) => s.id === `${raiz}-${k}`) || usados.has(`${raiz}-${k}`)) k++;
  return `${raiz}-${k}`;
}

/** Lo que propone Claude en una revisión del informe (petición «revision»). */
export interface ResultadoRevision {
  /** Slides que se sustituyen: una (modificar) o varias (desdoblar). La primera conserva el id. */
  reemplazos: { id: string; slides: unknown[] }[];
  /** Slides que desaparecen (la segunda de una fusión). */
  eliminar: string[];
  /** Slides nuevas, tras la indicada (o al final del cuerpo si no existe). */
  nuevas: { despuesDe: string; slide: unknown }[];
  /** Hitos del cronograma que se quitan porque el equipo lo ha pedido. */
  hitosQuitados: string[];
  /** Qué se ha cambiado, en una o dos frases. */
  resumen: string;
}

/** Lee la respuesta de Claude (tolerante: listas que falten quedan vacías). */
export function leerResultado(json: unknown): ResultadoRevision {
  const o = (json && typeof json === "object" && !Array.isArray(json) ? json : {}) as Record<string, unknown>;
  const arr = (k: string) => (Array.isArray(o[k]) ? (o[k] as unknown[]) : []);
  return {
    reemplazos: arr("reemplazos")
      .filter((x): x is Record<string, unknown> => !!x && typeof x === "object" && typeof (x as { id?: unknown }).id === "string")
      .map((x) => ({ id: x.id as string, slides: Array.isArray(x.slides) ? x.slides : x.slide ? [x.slide] : [] }))
      .filter((x) => x.slides.length),
    eliminar: arr("eliminar").filter((x): x is string => typeof x === "string"),
    nuevas: arr("nuevas")
      .filter((x): x is Record<string, unknown> => !!x && typeof x === "object" && !!(x as { slide?: unknown }).slide)
      .map((x) => ({ despuesDe: typeof x.despuesDe === "string" ? x.despuesDe : "", slide: x.slide })),
    hitosQuitados: arr("hitosQuitados").filter((x): x is string => typeof x === "string"),
    resumen: typeof o.resumen === "string" ? o.resumen : "",
  };
}

/** Slides que no se pueden quitar ni sustituir por varias. */
const FIJAS = ESTRUCTURALES;

export interface AplicacionRevision {
  slides: SlideJson[];
  /** Ids de las slides tocadas antes y después (para el historial y para medirlas). */
  antes: SlideJson[];
  despues: string[];
  /** Lo que no se ha podido aplicar, explicado. */
  rechazos: string[];
}

/**
 * Aplica el resultado de una revisión. `validar` convierte lo que devuelve
 * Claude en una slide válida con el id dado (validarSlide + periodo) o lanza.
 * No muta `slides`. Las slides cerradas nunca se tocan.
 */
export function aplicarResultado(
  slides: SlideJson[],
  r: ResultadoRevision,
  validar: (o: unknown, id: string) => SlideJson,
): AplicacionRevision {
  let out = clon(slides);
  const antes: SlideJson[] = [];
  const despues: string[] = [];
  const rechazos: string[] = [];
  const usados = new Set<string>();
  const tocar = (id: string, que: string): SlideJson | null => {
    const s = out.find((x) => x.id === id);
    if (!s) {
      rechazos.push(`${que}: la slide «${id}» no existe.`);
      return null;
    }
    if (s.cerrada) {
      rechazos.push(`${que}: «${tituloDe(s)}» está cerrada y no se toca.`);
      return null;
    }
    return s;
  };

  for (const rep of r.reemplazos) {
    const actual = tocar(rep.id, "Cambio");
    if (!actual) continue;
    if (rep.slides.length > 1 && FIJAS.includes(rep.id)) {
      rechazos.push(`«${tituloDe(actual)}» no se puede desdoblar.`);
      continue;
    }
    let nuevas: SlideJson[];
    try {
      nuevas = rep.slides.slice(0, 4).map((o, i) => {
        const id = i === 0 ? rep.id : idDerivado(rep.id, out, usados);
        usados.add(id);
        const s = validar(o, id);
        if (i > 0) s.origen = "nueva";
        return s;
      });
    } catch (e) {
      rechazos.push(`«${tituloDe(actual)}»: ${e instanceof Error ? e.message : "respuesta no válida"}.`);
      continue;
    }
    // Lo que el equipo colocó a mano encima se queda en la primera.
    nuevas[0] = conFlotantesDe(actual, nuevas[0]!);
    if (actual.oculto) nuevas.forEach((s) => (s.oculto = true));
    if (!antes.some((x) => x.id === actual.id)) antes.push(clon(actual));
    const i = out.findIndex((x) => x.id === rep.id);
    out.splice(i, 1, ...nuevas);
    despues.push(...nuevas.map((s) => s.id));
  }

  for (const id of r.eliminar) {
    const s = tocar(id, "Quitar");
    if (!s) continue;
    if (FIJAS.includes(id) || id === "resumen-ejecutivo") {
      rechazos.push(`«${tituloDe(s)}» no se puede quitar.`);
      continue;
    }
    if (!antes.some((x) => x.id === id)) antes.push(clon(s));
    out = out.filter((x) => x.id !== id);
  }

  for (const n of r.nuevas) {
    const propuesto = n.slide && typeof n.slide === "object" ? (n.slide as { id?: unknown }).id : null;
    const base = typeof propuesto === "string" && propuesto ? propuesto : n.despuesDe || "situacion-nueva";
    const id = !out.some((x) => x.id === base) && !usados.has(base) ? base : idDerivado(base, out, usados);
    usados.add(id);
    let s: SlideJson;
    try {
      s = validar(n.slide, id);
    } catch (e) {
      rechazos.push(`Slide nueva: ${e instanceof Error ? e.message : "respuesta no válida"}.`);
      continue;
    }
    s.origen = "nueva";
    const tras = out.findIndex((x) => x.id === n.despuesDe);
    const fin = out.findIndex((x) => x.id === "disclaimer" || x.id === "cierre");
    out.splice(tras >= 0 ? tras + 1 : fin >= 0 ? fin : out.length, 0, s);
    despues.push(id);
  }

  renumerar(out);
  return { slides: out, antes, despues, rechazos };
}

/** Textos que entran y salen de una slide respecto a otra (para «Comparar con el trimestre anterior»). */
export function diferenciasTexto(antes: SlideJson, despues: SlideJson): { quitados: string[]; anadidos: string[]; iguales: number } {
  const trozos = (s: SlideJson) =>
    textos(s)
      .split(" · ")
      .map((t) => t.trim())
      .filter((t) => t.length > 1 && !/^\d+$/.test(t));
  const a = trozos(antes);
  const b = trozos(despues);
  const enB = new Set(b);
  const enA = new Set(a);
  return {
    quitados: [...new Set(a.filter((t) => !enB.has(t)))],
    anadidos: [...new Set(b.filter((t) => !enA.has(t)))],
    iguales: new Set(a.filter((t) => enB.has(t))).size,
  };
}

/** Copia una slide justo detrás de ella, con id nuevo (no muta). */
export function duplicarSlide(slides: SlideJson[], id: string): { slides: SlideJson[]; nueva: string } | null {
  const i = slides.findIndex((s) => s.id === id);
  if (i < 0 || FIJAS.includes(id)) return null;
  const out = clon(slides);
  const copia = clon(out[i]!);
  copia.id = idDerivado(id, out);
  copia.origen = "nueva";
  delete copia.cerrada;
  out.splice(i + 1, 0, copia);
  renumerar(out);
  return { slides: out, nueva: copia.id };
}

/**
 * Deshace una revisión: vuelve a poner las slides de antes y quita las que
 * creó. Solo si las que creó siguen como las dejó; si no, devuelve el motivo.
 */
export function deshacerRevision(
  slides: SlideJson[],
  rev: { antes: SlideJson[]; despues: SlideJson[]; ordenAntes: string[] },
): { slides: SlideJson[] } | { error: string } {
  const actualPorId = new Map(slides.map((s) => [s.id, s]));
  for (const d of rev.despues) {
    const a = actualPorId.get(d.id);
    if (a && JSON.stringify(a) !== JSON.stringify(d)) {
      return { error: `«${tituloDe(a)}» ha cambiado después de esta revisión: deshaz antes los cambios posteriores.` };
    }
  }
  const quitar = new Set(rev.despues.map((s) => s.id));
  const reponer = new Map(rev.antes.map((s) => [s.id, s]));
  let out = slides.filter((s) => !quitar.has(s.id) || reponer.has(s.id)).map((s) => clon(reponer.get(s.id) ?? s));
  // Las que se quitaron en la revisión vuelven a su sitio según el orden de entonces.
  for (const s of rev.antes) {
    if (out.some((x) => x.id === s.id)) continue;
    const pos = rev.ordenAntes.indexOf(s.id);
    const siguiente = rev.ordenAntes.slice(pos + 1).find((id) => out.some((x) => x.id === id));
    const i = siguiente ? out.findIndex((x) => x.id === siguiente) : out.length;
    out.splice(i, 0, clon(s));
  }
  out = renumerar(out);
  return { slides: out };
}
