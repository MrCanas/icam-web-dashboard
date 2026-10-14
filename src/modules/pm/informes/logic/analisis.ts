import type { Analisis, Fuente, HitoCronograma, PrevioEstructurado } from "../types";
import { normalizarEstructura } from "./informe";

/**
 * El análisis del trimestre como algo vivo: lo que devuelve Claude se sanea
 * aquí, el equipo lo edita y lo comenta en el paso 3, y cada «Revisar con lo
 * nuevo» es una ronda más que respeta lo editado a mano.
 *
 * Los elementos se nombran con una clave estable para colgarles comentarios:
 * «resumen.3», «objetivos.0», «hechos.7», «faltan.1», «contradicciones.0»,
 * «omitidos.2», «hitos.4», «estructura.<id de slide>» y «general».
 */

export const LISTAS_TEXTO = ["resumen", "faltan", "contradicciones", "omitidos"] as const;
export type ListaTexto = (typeof LISTAS_TEXTO)[number];

const ARRAYS = ["resumen", "objetivosPrevios", "hechos", "estructura", "sugeridas", "faltan", "contradicciones"] as const;

const texto = (v: unknown): string => (typeof v === "string" ? v : v == null ? "" : String(v));

/** Hitos tal como vienen de Claude o de un Timeline: titulo y fecha en texto, hecho en booleano. */
export function normalizarHitos(v: unknown): HitoCronograma[] {
  if (!Array.isArray(v)) return [];
  return v
    .filter((h): h is Record<string, unknown> => !!h && typeof h === "object")
    .map((h) => ({
      titulo: texto(h.titulo).trim(),
      fecha: texto(h.fecha).trim(),
      hecho: h.hecho === true || h.hecho === "true",
      ...(typeof h.slide === "string" && h.slide ? { slide: h.slide } : {}),
    }))
    .filter((h) => h.titulo);
}

/**
 * Sanea el JSON del análisis: listas que falten pasan a [], la estructura se
 * normaliza contra el informe anterior y «omitidos» solo existe si hay
 * indicaciones de «No reportar» (así el paso 3 distingue «nada afectado» de
 * «no se aplicaron»).
 */
export function normalizarAnalisis(json: unknown, o: { previo: PrevioEstructurado | null; hayNoReportar: boolean }): Analisis {
  const a = (json && typeof json === "object" && !Array.isArray(json) ? { ...(json as Record<string, unknown>) } : {}) as Record<string, unknown>;
  for (const k of ARRAYS) if (!Array.isArray(a[k])) a[k] = [];
  for (const k of ["resumen", "faltan", "contradicciones"] as const) a[k] = (a[k] as unknown[]).map(texto).filter((x) => x.trim());
  a.objetivosPrevios = (a.objetivosPrevios as unknown[])
    .filter((x): x is Record<string, unknown> => !!x && typeof x === "object")
    .map((x) => ({ objetivo: texto(x.objetivo), estado: texto(x.estado), ...(x.evidencia ? { evidencia: texto(x.evidencia) } : {}) }));
  a.hechos = (a.hechos as unknown[])
    .filter((x): x is Record<string, unknown> => !!x && typeof x === "object" && !!(x as { texto?: unknown }).texto)
    .map((x) => ({
      tipo: texto(x.tipo),
      texto: texto(x.texto),
      ...(x.fecha ? { fecha: texto(x.fecha) } : {}),
      ...(x.modulo ? { modulo: texto(x.modulo) } : {}),
      ...(x.fuente ? { fuente: texto(x.fuente) } : {}),
    }));
  a.sugeridas = (a.sugeridas as unknown[]).map(Number).filter((n) => Number.isInteger(n) && n > 0);
  a.omitidos = o.hayNoReportar ? (Array.isArray(a.omitidos) ? a.omitidos.map(texto).filter((x) => x.trim()) : []) : undefined;
  if (a.hitosPrevios !== undefined) a.hitosPrevios = normalizarHitos(a.hitosPrevios);
  const analisis = a as unknown as Analisis;
  analisis.estructura = normalizarEstructura(a.estructura, o.previo);
  // Lo que es del equipo, no de Claude: no se acepta de la respuesta.
  delete analisis.comentarios;
  delete analisis.editados;
  delete (a as { respuestas?: unknown }).respuestas;
  return analisis;
}

/** Respuestas de Claude a los comentarios: [{clave, respuesta}] → {clave: respuesta}. */
export function leerRespuestas(json: unknown): Record<string, string> {
  const r = json && typeof json === "object" ? (json as { respuestas?: unknown }).respuestas : null;
  const out: Record<string, string> = {};
  if (Array.isArray(r)) {
    for (const x of r) {
      if (x && typeof x === "object" && typeof (x as { clave?: unknown }).clave === "string") {
        out[(x as { clave: string }).clave] = texto((x as { respuesta?: unknown }).respuesta);
      }
    }
  }
  return out;
}

/** Comentarios con texto (los vacíos no cuentan). */
export function comentariosActivos(a: Analisis | null): [string, string][] {
  return Object.entries(a?.comentarios ?? {}).filter(([, v]) => v.trim());
}

/** Marca una clave como editada a mano (sin repetir). */
export function marcarEditado(a: Analisis, clave: string): Analisis {
  const editados = new Set(a.editados ?? []);
  editados.add(clave);
  return { ...a, editados: [...editados] };
}

/** Pone (o quita, con texto vacío) el comentario de una clave. */
export function comentar(a: Analisis, clave: string, comentario: string): Analisis {
  const comentarios = { ...(a.comentarios ?? {}) };
  if (comentario.trim()) comentarios[clave] = comentario;
  else delete comentarios[clave];
  return { ...a, comentarios };
}

/**
 * Quita el elemento `i` de una lista del análisis y corrige las claves de lo
 * editado, los comentarios y las respuestas de los elementos que van detrás
 * (sus posiciones bajan una).
 */
export function quitarDeLista(a: Analisis, prefijo: string, i: number): Record<string, unknown> {
  const mover = (k: string): string | null => {
    const m = new RegExp(`^${prefijo}\\.(\\d+)$`).exec(k);
    if (!m) return k;
    const n = Number(m[1]);
    return n === i ? null : n > i ? `${prefijo}.${n - 1}` : k;
  };
  const claves = <T>(o: Record<string, T> | undefined) =>
    Object.fromEntries(Object.entries(o ?? {}).flatMap(([k, v]) => (mover(k) === null ? [] : [[mover(k)!, v]])));
  return {
    editados: (a.editados ?? []).map(mover).filter((k): k is string => k !== null),
    comentarios: claves(a.comentarios),
    respuestas: claves(a.respuestas),
  };
}

/** Fuentes aportadas (o cambiadas) después de la última ronda del análisis. */
export function fuentesNuevas(fuentes: Fuente[], a: Analisis | null): Fuente[] {
  const desde = a?.fecha ? Date.parse(a.fecha) : NaN;
  if (!Number.isFinite(desde)) return [];
  return fuentes.filter((f) => f.incluida && f.tipo !== "previo" && f.texto.trim() && Date.parse(f.actualizado) > desde);
}

/**
 * Resultado de una ronda de revisión: el análisis nuevo de Claude, con las
 * respuestas a los comentarios, sin comentarios pendientes (ya atendidos) y con
 * la ronda y la fecha al día. Lo editado a mano sigue marcado: en la siguiente
 * ronda se vuelve a respetar.
 */
export function cerrarRonda(anterior: Analisis, nuevo: Analisis, respuestas: Record<string, string>, fecha: string): Analisis {
  return {
    ...nuevo,
    // Si Claude no devuelve hitos, se quedan los que había (son del equipo una vez editados).
    hitosPrevios: nuevo.hitosPrevios ?? anterior.hitosPrevios,
    editados: anterior.editados,
    comentarios: {},
    respuestas,
    ronda: (anterior.ronda ?? 1) + 1,
    fecha,
  };
}
