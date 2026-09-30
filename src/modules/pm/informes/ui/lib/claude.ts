"use client";

import type { PeticionClaude } from "../../logic/peticiones";

/**
 * Petición a /api/informes/claude desde el navegador: lee el NDJSON según
 * llega (progreso) y devuelve el JSON final, o lanza ErrorClaude con un código
 * que `mensajeErrorClaude` traduce para la PM.
 */

export class ErrorClaude extends Error {
  constructor(
    readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "ErrorClaude";
  }
}

export interface ImagenClaude {
  mediaType: "image/jpeg" | "image/png" | "image/webp";
  data: string;
}

export interface UsoRespuesta {
  inputTokens: number;
  outputTokens: number;
  cacheCreationTokens: number;
  cacheReadTokens: number;
  costeUsd: number;
  modelo: string;
}

export async function pedirClaude(
  peticion: PeticionClaude,
  opciones: { signal?: AbortSignal; imagenes?: ImagenClaude[]; onProgreso?: (caracteres: number) => void } = {},
): Promise<{ json: unknown; uso: UsoRespuesta | null }> {
  let res: Response;
  try {
    res = await fetch("/api/informes/claude", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...peticion, imagenes: opciones.imagenes ?? [] }),
      signal: opciones.signal,
    });
  } catch (e) {
    if (opciones.signal?.aborted) throw new ErrorClaude("cancelled", "Parado.");
    throw new ErrorClaude("network", e instanceof Error ? e.message : "Sin conexión");
  }
  if (!res.ok || !res.body) {
    let cuerpo: { error?: { code?: string; message?: string } | string } = {};
    try {
      cuerpo = await res.json();
    } catch {
      // Sin cuerpo JSON.
    }
    const e = typeof cuerpo.error === "object" ? cuerpo.error : { message: cuerpo.error };
    throw new ErrorClaude(e?.code ?? (res.status === 401 ? "session_expired" : "api_error"), e?.message ?? `Error ${res.status}`);
  }
  const lector = res.body.getReader();
  const dec = new TextDecoder();
  let buffer = "";
  let caracteres = 0;
  let final: { json: unknown; uso: UsoRespuesta | null } | null = null;
  try {
    for (;;) {
      const { value, done } = await lector.read();
      if (done) break;
      buffer += dec.decode(value, { stream: true });
      let i: number;
      while ((i = buffer.indexOf("\n")) >= 0) {
        const linea = buffer.slice(0, i).trim();
        buffer = buffer.slice(i + 1);
        if (!linea) continue;
        const msg = JSON.parse(linea) as {
          t?: string;
          ok?: boolean;
          json?: unknown;
          uso?: UsoRespuesta;
          error?: { code: string; message: string };
        };
        if (msg.t) {
          caracteres += msg.t.length;
          opciones.onProgreso?.(caracteres);
        } else if (msg.error) throw new ErrorClaude(msg.error.code, msg.error.message);
        else if (msg.ok) final = { json: msg.json, uso: msg.uso ?? null };
      }
    }
  } catch (e) {
    if (e instanceof ErrorClaude) throw e;
    if (opciones.signal?.aborted) throw new ErrorClaude("cancelled", "Parado.");
    throw new ErrorClaude("network", "Se ha cortado la conexión con el servidor.");
  }
  if (!final) throw new ErrorClaude(opciones.signal?.aborted ? "cancelled" : "network", "La respuesta de Claude llegó incompleta.");
  return final;
}

const MENSAJES: Record<string, string> = {
  not_granted: "Tu acceso a Proyectos es de lectura: no puedes generar ni corregir informes.",
  rate_limited: "Se ha alcanzado el límite de uso de la API de Claude. Inténtalo en unos minutos.",
  prompt_too_large: "Demasiada información para una sola petición: quita alguna fuente o recorta las notas.",
  invalid_json: "Claude no devolvió un resultado válido. Vuelve a intentarlo.",
  cancelled: "Parado.",
  session_expired: "Tu sesión ha caducado: vuelve a entrar en el portal.",
  refused: "Claude no ha podido procesar esta petición.",
  max_tokens: "La respuesta de Claude se cortó por longitud. Vuelve a intentarlo.",
  not_configured:
    "El servidor no tiene ANTHROPIC_API_KEY. En Vercel, la variable tiene que estar en el entorno de este despliegue (Production y/o Preview) y hay que volver a desplegar después de crearla.",
  invalid_key: "Anthropic rechaza la clave de la API configurada en el servidor: revisa que ANTHROPIC_API_KEY esté completa y sin comillas ni espacios.",
  not_found: "El informe ya no existe.",
  network: "Se ha cortado la conexión. Vuelve a intentarlo.",
};

export function mensajeErrorClaude(e: unknown): string {
  if (e instanceof ErrorClaude) return MENSAJES[e.code] ?? `Error de Claude (${e.message || e.code}).`;
  return `No válido: ${e instanceof Error ? e.message : String(e)}`;
}

export function esCancelado(e: unknown): boolean {
  return e instanceof ErrorClaude && e.code === "cancelled";
}
