import {
  puedeMarcarPrueba,
  puedeRevisar,
  type ContextoControles,
} from "@/modules/comunicaciones/logic/controles";
import { ETIQUETA_AUDIENCIA, type ComComunicacionRow, type EstadoComunicacion } from "@/modules/comunicaciones/types";

/**
 * El asistente de envío: los cinco pasos, en qué punto está una comunicación y
 * adónde se puede ir desde ahí.
 *
 * No añade ningún control: los motivos salen de `controles.ts`, y el servidor
 * los vuelve a comprobar en cada acción. Esto solo decide qué paso enseñar y
 * qué decirle a quien está delante.
 *
 * Puro: recibe la comunicación y contesta.
 */

export const PASOS = ["audiencia", "destinatarios", "contenido", "prueba", "enviar"] as const;
export type PasoAsistente = (typeof PASOS)[number];

export const ETIQUETA_PASO: Record<PasoAsistente, string> = {
  audiencia: "Audiencia",
  destinatarios: "Destinatarios",
  contenido: "Contenido",
  prueba: "Prueba",
  enviar: "Revisar y enviar",
};

export function esPaso(valor: unknown): valor is PasoAsistente {
  return typeof valor === "string" && (PASOS as readonly string[]).includes(valor);
}

export function indiceDe(paso: PasoAsistente): number {
  return PASOS.indexOf(paso);
}

export function pasoSiguiente(paso: PasoAsistente): PasoAsistente | null {
  return PASOS[indiceDe(paso) + 1] ?? null;
}

export function pasoAnterior(paso: PasoAsistente): PasoAsistente | null {
  const i = indiceDe(paso);
  return i > 0 ? PASOS[i - 1] : null;
}

type Comunicacion = Pick<ComComunicacionRow, "estado" | "plantilla_id">;

const YA_PROBADA: readonly EstadoComunicacion[] = ["probada", "enviando", "pausada", "enviada"];

/** ¿Está hecho este paso? Lo dice el estado guardado, no lo que se haya visto. */
export function pasoCompletado(paso: PasoAsistente, c: Comunicacion): boolean {
  switch (paso) {
    case "audiencia":
      // Si la comunicación existe, la audiencia está elegida.
      return true;
    case "destinatarios":
      return c.estado !== "borrador" && c.estado !== "cancelada";
    case "contenido":
      return Boolean(c.plantilla_id) && c.estado !== "borrador" && c.estado !== "cancelada";
    case "prueba":
      return YA_PROBADA.includes(c.estado);
    case "enviar":
      return c.estado === "enviada";
  }
}

/** El primer paso que falta: adónde lleva entrar en una comunicación. */
export function pasoSugerido(c: Comunicacion): PasoAsistente {
  switch (c.estado) {
    case "borrador":
    case "cancelada":
      return "destinatarios";
    case "revisada":
      return c.plantilla_id ? "prueba" : "contenido";
    default:
      return "enviar";
  }
}

/** Hacia atrás siempre; hacia delante, solo hasta el primer paso que falta. */
export function puedeIrA(paso: PasoAsistente, c: Comunicacion): boolean {
  return indiceDe(paso) <= indiceDe(pasoSugerido(c));
}

/** El paso que se enseña: el pedido, si se puede ir a él; si no, el sugerido. */
export function pasoAMostrar(pedido: unknown, c: Comunicacion): PasoAsistente {
  return esPaso(pedido) && puedeIrA(pedido, c) ? pedido : pasoSugerido(c);
}

export type EstadoDePaso = "hecho" | "actual" | "pendiente" | "bloqueado";

/**
 * Cómo pinta el stepper cada paso: el que se está viendo, «actual»; los demás,
 * hechos o pendientes. Si el candado no dejaría salir esta comunicación, el
 * último paso sale bloqueado desde el principio.
 */
export function estadosDePasos(
  c: Comunicacion,
  viendo: PasoAsistente,
  bloqueadaPorCandado: boolean,
): Record<PasoAsistente, EstadoDePaso> {
  const estados = {} as Record<PasoAsistente, EstadoDePaso>;
  for (const paso of PASOS) {
    if (paso === viendo) estados[paso] = "actual";
    else if (paso === "enviar" && bloqueadaPorCandado) estados[paso] = "bloqueado";
    else estados[paso] = pasoCompletado(paso, c) ? "hecho" : "pendiente";
  }
  return estados;
}

/**
 * Por qué no se puede pulsar «Continuar» en un paso, o `null`. Solo los pasos
 * cuyo «Continuar» hace algo en el servidor tienen un control detrás; en los
 * demás, continuar es solo moverse.
 */
export function motivoParaContinuar(paso: PasoAsistente, ctx: ContextoControles): string | null {
  const { comunicacion, resumen } = ctx;
  switch (paso) {
    case "destinatarios":
      return comunicacion.estado === "borrador" ? puedeRevisar(ctx, resumen.aEnviar) : null;
    case "contenido":
      return comunicacion.plantilla_id ? null : "Elige una plantilla para continuar.";
    case "prueba":
      if (YA_PROBADA.includes(comunicacion.estado)) return null;
      return puedeMarcarPrueba(ctx);
    default:
      return null;
  }
}

/** Orden de los estados editables, para saber si un cambio ha hecho retroceder la comunicación. */
const RANGO: Partial<Record<EstadoComunicacion, number>> = { borrador: 0, revisada: 1, probada: 2 };

/**
 * Si la comunicación ha vuelto atrás (al excluir a alguien o cambiar la
 * plantilla, el servidor deshace la revisión o la prueba), qué decirle a quien
 * lo ha provocado. `null` si no ha retrocedido.
 */
export function avisoDeRetroceso(antes: EstadoComunicacion, ahora: EstadoComunicacion): string | null {
  const a = RANGO[antes];
  const b = RANGO[ahora];
  if (a === undefined || b === undefined || b >= a) return null;
  if (ahora === "borrador") return "Has cambiado la lista: confirma de nuevo que la has revisado.";
  return "Has cambiado la plantilla: envíate una prueba nueva antes de seguir.";
}

/** A quién va, en corto: el nombre de la promoción o la audiencia. */
export function nombreDeAudiencia(c: Pick<ComComunicacionRow, "audiencia" | "promocion_nombre">): string {
  return c.audiencia === "promocion" && c.promocion_nombre ? c.promocion_nombre : ETIQUETA_AUDIENCIA[c.audiencia];
}
