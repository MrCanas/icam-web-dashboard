import Anthropic from "@anthropic-ai/sdk";

import {
  esfuerzoDesdeEnv,
  MODELO_POR_DEFECTO,
  SISTEMA,
  trocearPrompt,
} from "../logic/peticion-claude";
import type { CodigoErrorClaude, UsoClaude } from "../types";

/**
 * Llamada a la API de Anthropic con la key del portal (ANTHROPIC_API_KEY).
 *
 * Sustituye a `window.claude.sample` del artifact: allí cada petición salía de
 * la suscripción de quien usaba la herramienta, que no puede servir de backend
 * a una web multiusuario. Aquí se factura a la organización de Anthropic
 * Console del portal.
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
    throw new ErrorPeticionClaude(
      "not_configured",
      "Falta ANTHROPIC_API_KEY en el entorno del portal.",
      503,
    );
  }
  // Sin reintentos del SDK: la app ya reintenta a su manera (ajuste, repetir GO)
  // y un reintento aquí puede duplicar el coste de una petición larga.
  cliente ??= new Anthropic({ maxRetries: 1, timeout: 280_000 });
  return cliente;
}

export function modeloConfigurado(): string {
  return process.env.INFORMES_CLAUDE_MODEL?.trim() || MODELO_POR_DEFECTO;
}

function traducirError(err: unknown): ErrorPeticionClaude {
  if (err instanceof ErrorPeticionClaude) return err;
  if (err instanceof Anthropic.APIUserAbortError) {
    return new ErrorPeticionClaude("cancelled", "Petición cancelada", 499);
  }
  if (err instanceof Anthropic.RateLimitError) {
    return new ErrorPeticionClaude("rate_limited", "Límite de uso de la API alcanzado", 429);
  }
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
  if (err instanceof Anthropic.APIError) {
    return new ErrorPeticionClaude("api_error", err.message, err.status ?? 502);
  }
  return new ErrorPeticionClaude(
    "api_error",
    err instanceof Error ? err.message : "Error desconocido",
    502,
  );
}

/**
 * Hace la petición en streaming. `onTexto` recibe los trozos de texto según
 * llegan (la app los usa para el indicador de progreso).
 */
export async function pedirAClaude(opciones: {
  prompt: string;
  imagenes?: ImagenPeticion[];
  signal?: AbortSignal;
  onTexto?: (trozo: string) => void;
}): Promise<ResultadoPeticion> {
  const modelo = modeloConfigurado();
  const contenido: Anthropic.ContentBlockParam[] = [
    ...(opciones.imagenes ?? []).map(
      (img): Anthropic.ImageBlockParam => ({
        type: "image",
        source: { type: "base64", media_type: img.mediaType, data: img.data },
      }),
    ),
    ...trocearPrompt(opciones.prompt).map(
      (t): Anthropic.TextBlockParam => ({
        type: "text",
        text: t.texto,
        ...(t.cachear ? { cache_control: { type: "ephemeral" as const } } : {}),
      }),
    ),
  ];

  try {
    const stream = getCliente().messages.stream(
      {
        model: modelo,
        max_tokens: 32_000,
        // Opus 5.5: el pensamiento no se puede desactivar; se controla con effort.
        thinking: { type: "adaptive" },
        output_config: { effort: esfuerzoDesdeEnv(process.env.INFORMES_CLAUDE_EFFORT) },
        system: SISTEMA,
        messages: [{ role: "user", content: contenido }],
      },
      { signal: opciones.signal },
    );
    if (opciones.onTexto) stream.on("text", opciones.onTexto);
    const mensaje = await stream.finalMessage();

    const texto = mensaje.content
      .filter((b): b is Anthropic.TextBlock => b.type === "text")
      .map((b) => b.text)
      .join("");
    const u = mensaje.usage;
    const uso: UsoClaude = {
      inputTokens: u.input_tokens ?? 0,
      outputTokens: u.output_tokens ?? 0,
      cacheCreationTokens: u.cache_creation_input_tokens ?? 0,
      cacheReadTokens: u.cache_read_input_tokens ?? 0,
    };
    return { texto, uso, stopReason: mensaje.stop_reason ?? null, modelo };
  } catch (err) {
    throw traducirError(err);
  }
}
