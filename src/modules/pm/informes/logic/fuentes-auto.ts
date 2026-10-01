import type { BaseInforme, Fuente, PrevioCandidato, TipoFuenteAuto } from "../types";

/**
 * Decisiones de la PM en el asistente: qué informe anterior se usa y si se
 * incorporan las actas y la planificación del portal.
 */

/** Las fuentes del portal van primero: si hay que recortar, se recorta lo aportado a mano. */
export const ORDEN_AUTO: Record<TipoFuenteAuto, number> = { planificacion: 0, actas: 1 };

/**
 * Respuesta a «¿quieres incorporar…?» según lo guardado: la fuente del portal
 * incluida es un sí, quitada es un no y, si no existe, la pregunta sigue abierta.
 */
export function respuestaAuto(fuentes: Fuente[], tipo: TipoFuenteAuto): boolean | null {
  const f = fuentes.find((x) => x.auto && x.tipo === tipo);
  return f ? f.incluida : null;
}

/**
 * Informe anterior que sale marcado: el ya elegido, el del trimestre anterior
 * o, si no está en el portal, el más reciente (los candidatos llegan del más
 * reciente al más antiguo).
 */
export function previoPorDefecto(candidatos: PrevioCandidato[], base: BaseInforme | null, trimestreAnterior: string): string | null {
  if (base?.tipo === "estructurado" && candidatos.some((c) => c.id === base.id)) return base.id;
  return candidatos.find((c) => c.trimestre === trimestreAnterior)?.id ?? candidatos[0]?.id ?? null;
}
