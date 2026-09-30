import type { UsoClaude } from "../types";

/**
 * Lógica pura de las peticiones a Claude: esfuerzo, sistema, lectura del JSON
 * de la respuesta y coste. La llamada en sí está en data/anthropicClient.ts.
 */

export const MODELO_POR_DEFECTO = "claude-opus-5-5";
export const ESFUERZOS = ["low", "medium", "high", "xhigh", "max"] as const;
export type Esfuerzo = (typeof ESFUERZOS)[number];
/**
 * Opus 5.5 trae `medium` por defecto. Los informes priorizan la calidad de la
 * redacción sobre el coste (decisión de negocio): `high`.
 */
export const ESFUERZO_POR_DEFECTO: Esfuerzo = "high";

export function esfuerzoDesdeEnv(valor: string | undefined): Esfuerzo {
  return (ESFUERZOS as readonly string[]).includes(valor ?? "") ? (valor as Esfuerzo) : ESFUERZO_POR_DEFECTO;
}

export const MAX_IMAGENES = 4;
/** Tope de un prompt montado (bytes). Por encima, algo se ha colado: se rechaza antes de pagarlo. */
export const MAX_BYTES_PROMPT = 200_000;

export const SISTEMA =
  "Trabajas para Impar Capital preparando informes trimestrales para inversores. " +
  "Responde únicamente con el JSON que se pide: sin texto antes ni después y sin bloques de código.";

export class JsonNoValidoError extends Error {
  constructor(message = "La respuesta no es un JSON válido") {
    super(message);
    this.name = "JsonNoValidoError";
  }
}

/**
 * Extrae el JSON de la respuesta. El sistema pide JSON sin adornos, pero se
 * toleran un bloque ```json y texto suelto alrededor.
 */
export function extraerJson(texto: string): unknown {
  const limpio = texto.trim();
  try {
    return JSON.parse(limpio);
  } catch {
    // Sigue con las alternativas.
  }
  const bloque = /```(?:json)?\s*([\s\S]*?)```/i.exec(limpio);
  if (bloque) {
    try {
      return JSON.parse(bloque[1]!.trim());
    } catch {
      // Sigue.
    }
  }
  const inicios = [limpio.indexOf("{"), limpio.indexOf("[")].filter((i) => i >= 0);
  if (inicios.length) {
    const desde = Math.min(...inicios);
    const cierre = limpio[desde] === "{" ? "}" : "]";
    const hasta = limpio.lastIndexOf(cierre);
    if (hasta > desde) {
      try {
        return JSON.parse(limpio.slice(desde, hasta + 1));
      } catch {
        // Cae al error.
      }
    }
  }
  throw new JsonNoValidoError();
}

/** Precio por millón de tokens (USD). La escritura de caché (5 min) cuesta 1,25× la entrada. */
interface Tarifa {
  entrada: number;
  salida: number;
  escrituraCache: number;
  lecturaCache: number;
}

const TARIFAS: Record<string, Tarifa> = {
  "claude-opus-5-5": { entrada: 4, salida: 20, escrituraCache: 5, lecturaCache: 0.2 },
  "claude-opus-5": { entrada: 5, salida: 25, escrituraCache: 6.25, lecturaCache: 0.5 },
  "claude-opus-4-8": { entrada: 5, salida: 25, escrituraCache: 6.25, lecturaCache: 0.5 },
  "claude-fable-5-1": { entrada: 10, salida: 50, escrituraCache: 12.5, lecturaCache: 0.25 },
  "claude-sonnet-5-5": { entrada: 2, salida: 10, escrituraCache: 2.5, lecturaCache: 0.2 },
};

/** Coste de una petición. Modelo desconocido → tarifa de Opus 5.5. */
export function costeUsd(modelo: string, uso: UsoClaude): number {
  const t = TARIFAS[modelo] ?? TARIFAS[MODELO_POR_DEFECTO]!;
  const coste =
    (uso.inputTokens * t.entrada +
      uso.outputTokens * t.salida +
      uso.cacheCreationTokens * t.escrituraCache +
      uso.cacheReadTokens * t.lecturaCache) /
    1_000_000;
  return Math.round(coste * 10_000) / 10_000;
}
