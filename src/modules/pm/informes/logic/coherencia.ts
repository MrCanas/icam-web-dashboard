import type { IncidenciaCoherencia, QaInforme } from "../types";

/**
 * Avisos de «Coherencia entre slides» como lista de trabajo: cada uno tiene id
 * y estado, el equipo le añade un comentario y lo aplica (Claude corrige las
 * slides afectadas) o lo descarta. Los avisos antiguos, sin id, se normalizan
 * al leer.
 */

let contador = 0;
function idNuevo(): string {
  contador = (contador + 1) % 1_000_000;
  return `c${Date.now().toString(36)}${contador.toString(36)}`;
}

/** Lee la respuesta de Claude (o un QA guardado) como avisos con id y estado. */
export function normalizarCoherencia(lista: unknown, origen: IncidenciaCoherencia["origen"] = "coherencia"): IncidenciaCoherencia[] {
  if (!Array.isArray(lista)) return [];
  return lista
    .filter((x): x is Record<string, unknown> => !!x && typeof x === "object" && typeof x.problema === "string")
    .map((x) => {
      const slides = Array.isArray(x.slides) ? x.slides.filter((s): s is string => typeof s === "string") : [];
      return {
        slide: typeof x.slide === "string" ? x.slide : "",
        problema: x.problema as string,
        ...(typeof x.sugerencia === "string" && x.sugerencia ? { sugerencia: x.sugerencia } : {}),
        id: typeof x.id === "string" && x.id ? x.id : idNuevo(),
        estado: x.estado === "aplicado" || x.estado === "descartado" ? x.estado : "pendiente",
        ...(typeof x.comentario === "string" && x.comentario ? { comentario: x.comentario } : {}),
        ...(slides.length ? { slides } : {}),
        origen: x.origen === "correccion" || x.origen === "cronograma" ? x.origen : origen,
      };
    });
}

/**
 * Tras una revisión de coherencia nueva: sus avisos sustituyen a los pendientes
 * de la revisión anterior; se conservan los avisos de correcciones y del
 * cronograma que sigan pendientes, y el comentario general.
 */
export function nuevaRevision(qa: QaInforme | null, nuevos: IncidenciaCoherencia[], fecha: string): QaInforme {
  const quedan = normalizarCoherencia(qa?.coherencia ?? []).filter((x) => x.estado === "pendiente" && x.origen !== "coherencia");
  return { coherencia: [...nuevos, ...quedan].slice(0, 40), fecha, ...(qa?.comentarioGeneral ? { comentarioGeneral: qa.comentarioGeneral } : {}) };
}

/** Añade avisos (de una corrección o del cronograma) a los que ya hay. */
export function anadirAvisos(qa: QaInforme | null, avisos: IncidenciaCoherencia[]): QaInforme {
  const actuales = normalizarCoherencia(qa?.coherencia ?? []);
  const vistos = new Set(actuales.filter((x) => x.estado === "pendiente").map((x) => `${x.slide}|${x.problema}`));
  const nuevos = avisos.filter((x) => !vistos.has(`${x.slide}|${x.problema}`));
  return { ...(qa ?? { fecha: new Date().toISOString() }), coherencia: [...actuales, ...nuevos].slice(-40) };
}

export function pendientes(qa: QaInforme | null): IncidenciaCoherencia[] {
  return normalizarCoherencia(qa?.coherencia ?? []).filter((x) => x.estado === "pendiente");
}

/** Cambia estado o comentario de unos avisos. */
export function marcar(qa: QaInforme | null, ids: string[], cambios: Partial<Pick<IncidenciaCoherencia, "estado" | "comentario">>): QaInforme {
  const set = new Set(ids);
  return {
    ...(qa ?? { fecha: new Date().toISOString() }),
    coherencia: normalizarCoherencia(qa?.coherencia ?? []).map((x) => (set.has(x.id!) ? { ...x, ...cambios } : x)),
  };
}

/** Slides a las que afecta un aviso. */
export function slidesDeAviso(x: IncidenciaCoherencia): string[] {
  return [...new Set([x.slide, ...(x.slides ?? [])].filter(Boolean))];
}

/**
 * Instrucción para Claude con varios avisos y el comentario general: cada aviso
 * con su problema, la sugerencia y lo que añade el equipo (que manda).
 */
export function instruccionDeAvisos(avisos: IncidenciaCoherencia[], general: string, numero: (id: string) => string): string {
  const partes = avisos.map((x, i) => {
    const donde = slidesDeAviso(x).map(numero).join(", ") || "todo el informe";
    return (
      `${i + 1}. [${donde}] ${x.problema}` +
      (x.sugerencia ? `\n   Sugerencia de la revisión: ${x.sugerencia}` : "") +
      (x.comentario?.trim() ? `\n   Indicación del equipo (prevalece sobre la sugerencia): ${x.comentario.trim()}` : "")
    );
  });
  if (general.trim()) partes.push(`Comentario general del equipo sobre la presentación: ${general.trim()}`);
  return "Corrige estos problemas de coherencia del informe:\n" + partes.join("\n");
}
