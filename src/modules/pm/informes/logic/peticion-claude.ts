import type { TipoPeticionClaude, UsoClaude } from "../types";

/**
 * Lógica pura de las peticiones a Claude: cómo se trocea el prompt para la
 * caché, cómo se lee el JSON de la respuesta y cuánto cuesta. La llamada en sí
 * está en data/anthropicClient.ts.
 */

export const MODELO_POR_DEFECTO = "claude-opus-5-5";
export const ESFUERZOS = ["low", "medium", "high", "xhigh", "max"] as const;
export type Esfuerzo = (typeof ESFUERZOS)[number];
/**
 * Opus 5.5 trae `medium` por defecto. Los informes priorizan calidad de
 * redacción sobre coste (decisión de negocio): se sube a `high`.
 */
export const ESFUERZO_POR_DEFECTO: Esfuerzo = "high";

export function esfuerzoDesdeEnv(valor: string | undefined): Esfuerzo {
  return (ESFUERZOS as readonly string[]).includes(valor ?? "")
    ? (valor as Esfuerzo)
    : ESFUERZO_POR_DEFECTO;
}

/** Tamaño máximo del prompt que se acepta (la app se limita a 62 000 bytes). */
export const MAX_BYTES_PROMPT = 70_000;
export const MAX_IMAGENES = 4;

export const SISTEMA =
  "Trabajas para Impar Capital preparando informes trimestrales para inversores. " +
  "Responde únicamente con el JSON que se pide: sin texto antes ni después y sin bloques de código.";

/**
 * Marca que separa, en los prompts de slide de la app, la parte estable
 * (rol + contexto del proyecto + catálogo de layouts + API + reglas, ≈21 KB)
 * de la tarea concreta. Todo lo anterior es idéntico en las 20–30 peticiones
 * de un informe, así que se cachea.
 */
const MARCA_TAREA = "\n\n== TAREA ==";

export interface TrozoPrompt {
  texto: string;
  cachear: boolean;
}

export function trocearPrompt(prompt: string): TrozoPrompt[] {
  const i = prompt.indexOf(MARCA_TAREA);
  if (i <= 0) return [{ texto: prompt, cachear: false }];
  return [
    { texto: prompt.slice(0, i), cachear: true },
    { texto: prompt.slice(i + 2), cachear: false },
  ];
}

/** Deduce el tipo de petición del propio prompt de la app, para el desglose de costes. */
export function tipoDePrompt(prompt: string): TipoPeticionClaude {
  const inicio = prompt.slice(0, 400);
  if (inicio.startsWith("Eres el asistente de reporting")) return "analisis";
  if (inicio.startsWith("Revisa la coherencia")) return "coherencia";
  const tarea = prompt.slice(prompt.indexOf(MARCA_TAREA) + 1, prompt.indexOf(MARCA_TAREA) + 400);
  if (prompt.includes(MARCA_TAREA)) {
    if (tarea.includes("Aplica esta corrección")) return "correccion";
    if (tarea.includes('Redacta el slide "resumen-ejecutivo"')) return "resumen";
    if (tarea.includes("DESBORDA") || tarea.includes("tras repartir huecos")) return "ajuste";
    return "slide";
  }
  return "otra";
}

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

/** Precio por millón de tokens (USD). */
interface Tarifa {
  entrada: number;
  salida: number;
  escrituraCache: number;
  lecturaCache: number;
}

const TARIFAS: Record<string, Tarifa> = {
  "claude-opus-5-5": { entrada: 4, salida: 20, escrituraCache: 5, lecturaCache: 0.2 },
  "claude-opus-5": { entrada: 5, salida: 25, escrituraCache: 6.25, lecturaCache: 0.5 },
  "claude-sonnet-5": { entrada: 2, salida: 10, escrituraCache: 2.5, lecturaCache: 0.2 },
};

/** Coste de una petición. Modelo desconocido → tarifa de Opus 5.5 (la de la app). */
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
