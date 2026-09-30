import Anthropic from "@anthropic-ai/sdk";

import type { BloquePrompt } from "../logic/prompts";
import { esfuerzoDesdeEnv, MODELO_POR_DEFECTO, SISTEMA } from "../logic/peticion-claude";
import type { CodigoErrorClaude, UsoClaude } from "../types";

/**
 * Llamada a la API de Anthropic con la clave del portal (ANTHROPIC_API_KEY),
 * pago por uso: se factura a la organización de Anthropic Console del portal,
 * no a la suscripción de nadie.
 */

export interface ImagenPeticion {
  mediaType: "image/jpeg" | "image/png" | "image/webp";
  /** base64 sin prefijo data:. */
  data: string;
}

export interface ResultadoPeticion {
  texto: string;
  uso: UsoClaude;
  stopReason: string | null;
  /** Modelo que respondió (puede ser el de reserva si el principal declinó). */
  modelo: string;
}

export class ErrorPeticionClaude extends Error {
  constructor(
    readonly codigo: CodigoErrorClaude,
    message: string,
    readonly status = 502,
  ) {
    super(message);
    this.name = "ErrorPeticionClaude";
  }
}

let cliente: Anthropic | null = null;

function getCliente(): Anthropic {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new ErrorPeticionClaude("not_configured", "Falta ANTHROPIC_API_KEY en el entorno del portal.", 503);
  }
  // Un solo reintento del SDK: la orquestación ya reintenta a su manera (ajuste,
  // repetir GO) y reintentar aquí una petición larga duplica su coste.
  cliente ??= new Anthropic({ maxRetries: 1, timeout: 280_000 });
  return cliente;
}

export function modeloConfigurado(): string {
  return process.env.INFORMES_CLAUDE_MODEL?.trim() || MODELO_POR_DEFECTO;
}

function traducirError(err: unknown): ErrorPeticionClaude {
  if (err instanceof ErrorPeticionClaude) return err;
  if (err instanceof Anthropic.APIUserAbortError) return new ErrorPeticionClaude("cancelled", "Petición cancelada", 499);
  if (err instanceof Anthropic.RateLimitError) return new ErrorPeticionClaude("rate_limited", "Límite de uso de la API alcanzado", 429);
  if (err instanceof Anthropic.AuthenticationError || err instanceof Anthropic.PermissionDeniedError) {
    return new ErrorPeticionClaude("not_configured", "La API key de Anthropic no es válida", 503);
  }
  if (err instanceof Anthropic.BadRequestError) {
    const texto = err.message.toLowerCase();
    if (texto.includes("too long") || texto.includes("too large") || texto.includes("maximum")) {
      return new ErrorPeticionClaude("prompt_too_large", err.message, 413);
    }
    return new ErrorPeticionClaude("api_error", err.message, 400);
  }
  if (err instanceof Anthropic.APIError) return new ErrorPeticionClaude("api_error", err.message, err.status ?? 502);
  return new ErrorPeticionClaude("api_error", err instanceof Error ? err.message : "Error desconocido", 502);
}

/**
 * Petición en streaming. Los bloques marcados `cachear` llevan cache_control
 * (máximo 4 por petición). `onTexto` recibe el texto según llega.
 *
 * Lleva el fallback de servidor por defecto (`fallbacks: "default"`): si Opus
 * declina por sus clasificadores de seguridad, la API repite la petición con
 * el modelo de reserva dentro de la misma llamada.
 */
export async function pedirAClaude(opciones: {
  bloques: BloquePrompt[];
  imagenes?: ImagenPeticion[];
  signal?: AbortSignal;
  onTexto?: (trozo: string) => void;
}): Promise<ResultadoPeticion> {
  const modelo = modeloConfigurado();
  let cacheados = 0;
  const contenido: Anthropic.Beta.BetaContentBlockParam[] = [
    ...(opciones.imagenes ?? []).map(
      (img): Anthropic.Beta.BetaImageBlockParam => ({
        type: "image",
        source: { type: "base64", media_type: img.mediaType, data: img.data },
      }),
    ),
    ...opciones.bloques.map((b): Anthropic.Beta.BetaTextBlockParam => {
      const cachear = b.cachear && cacheados < 3;
      if (cachear) cacheados++;
      return { type: "text", text: b.texto, ...(cachear ? { cache_control: { type: "ephemeral" as const } } : {}) };
    }),
  ];

  try {
    const stream = getCliente().beta.messages.stream(
      {
        model: modelo,
        max_tokens: 32_000,
        // Opus 5.5: el pensamiento no se puede desactivar; se controla con effort.
        thinking: { type: "adaptive" },
        output_config: { effort: esfuerzoDesdeEnv(process.env.INFORMES_CLAUDE_EFFORT) },
        system: [{ type: "text", text: SISTEMA }],
        messages: [{ role: "user", content: contenido }],
        betas: ["server-side-fallback-2026-07-01"],
        fallbacks: "default",
      },
      { signal: opciones.signal },
    );
    if (opciones.onTexto) stream.on("text", opciones.onTexto);
    const mensaje = await stream.finalMessage();

    const texto = mensaje.content
      .filter((b): b is Anthropic.Beta.BetaTextBlock => b.type === "text")
      .map((b) => b.text)
      .join("");
    const u = mensaje.usage;
    return {
      texto,
      uso: {
        inputTokens: u.input_tokens ?? 0,
        outputTokens: u.output_tokens ?? 0,
        cacheCreationTokens: u.cache_creation_input_tokens ?? 0,
        cacheReadTokens: u.cache_read_input_tokens ?? 0,
      },
      stopReason: mensaje.stop_reason ?? null,
      modelo: mensaje.model || modelo,
    };
  } catch (err) {
    throw traducirError(err);
  }
}
