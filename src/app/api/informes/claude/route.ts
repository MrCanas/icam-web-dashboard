import { NextResponse } from "next/server";

import { writeAccessResponse } from "@/lib/auth/api-guard";
import { getCurrentUser } from "@/lib/auth/currentUser";
import {
  ErrorPeticionClaude,
  pedirAClaude,
  type ImagenPeticion,
} from "@/modules/pm/informes/data/anthropicClient";
import { registrarUso } from "@/modules/pm/informes/data/usoRepository";
import {
  costeUsd,
  extraerJson,
  JsonNoValidoError,
  MAX_BYTES_PROMPT,
  MAX_IMAGENES,
  tipoDePrompt,
} from "@/modules/pm/informes/logic/peticion-claude";
import { esIdValido } from "@/modules/pm/informes/logic/colecciones";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// Una petición de slide tarda 0,5–2 min; el análisis inicial algo más.
export const maxDuration = 300;

const MEDIA_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

interface Cuerpo {
  prompt: string;
  imagenes: ImagenPeticion[];
  informeId: string | null;
}

function leerCuerpo(raw: unknown): Cuerpo | { error: string; status: number } {
  if (!raw || typeof raw !== "object") return { error: "Body JSON inválido", status: 400 };
  const b = raw as Record<string, unknown>;
  const prompt = typeof b.prompt === "string" ? b.prompt : "";
  if (!prompt.trim()) return { error: "prompt requerido", status: 400 };
  if (Buffer.byteLength(prompt, "utf8") > MAX_BYTES_PROMPT) {
    return { error: "prompt_too_large", status: 413 };
  }
  const imagenes = Array.isArray(b.imagenes) ? b.imagenes : [];
  if (imagenes.length > MAX_IMAGENES) return { error: `Máximo ${MAX_IMAGENES} imágenes`, status: 400 };
  for (const img of imagenes) {
    const i = img as Record<string, unknown>;
    if (typeof i?.data !== "string" || !MEDIA_TYPES.has(String(i.mediaType))) {
      return { error: "Imagen no válida", status: 400 };
    }
  }
  const informeId =
    typeof b.informeId === "string" && esIdValido(b.informeId) ? b.informeId : null;
  return { prompt, imagenes: imagenes as ImagenPeticion[], informeId };
}

/**
 * Proxy de la app de informes hacia Claude. Responde en NDJSON:
 *   {"t":"…"}                         trozos de texto según llegan
 *   {"ok":true,"json":…,"uso":{…}}    fin, con el JSON ya leído
 *   {"error":{"code":"…","message":"…"}}
 * Los códigos de error son los mismos que devolvía `window.claude.sample`,
 * así que la app los traduce sin cambios.
 */
export async function POST(request: Request) {
  const ctx = await getCurrentUser();
  if (!ctx) {
    return NextResponse.json({ error: { code: "session_expired", message: "Sesión caducada" } }, { status: 401 });
  }
  // Generar cuesta dinero y cambia el informe: solo editores y admins de pm.
  const denegado = writeAccessResponse(ctx, "pm");
  if (denegado) {
    return NextResponse.json({ error: { code: "not_granted", message: "Sin permiso para generar informes" } }, { status: 403 });
  }

  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return NextResponse.json({ error: { code: "api_error", message: "Body JSON inválido" } }, { status: 400 });
  }
  const cuerpo = leerCuerpo(raw);
  if ("error" in cuerpo) {
    const code = cuerpo.status === 413 ? "prompt_too_large" : "api_error";
    return NextResponse.json({ error: { code, message: cuerpo.error } }, { status: cuerpo.status });
  }

  const codificador = new TextEncoder();
  const inicio = Date.now();
  const tipo = tipoDePrompt(cuerpo.prompt);

  const flujo = new ReadableStream<Uint8Array>({
    async start(controller) {
      const enviar = (obj: unknown) => {
        try {
          controller.enqueue(codificador.encode(JSON.stringify(obj) + "\n"));
        } catch {
          // El cliente cerró la conexión: no hay a quién enviar.
        }
      };
      try {
        const r = await pedirAClaude({
          prompt: cuerpo.prompt,
          imagenes: cuerpo.imagenes,
          signal: request.signal,
          onTexto: (t) => enviar({ t }),
        });
        const coste = costeUsd(r.modelo, r.uso);
        // Se registra también si la respuesta no sirve: se ha facturado igual.
        await registrarUso(ctx, {
          ...r.uso,
          informeId: cuerpo.informeId,
          tipo,
          modelo: r.modelo,
          costeUsd: coste,
          stopReason: r.stopReason,
          duracionMs: Date.now() - inicio,
        });

        if (r.stopReason === "refusal") {
          enviar({ error: { code: "refused", message: "Claude no ha podido procesar esta petición" } });
        } else if (r.stopReason === "max_tokens") {
          enviar({ error: { code: "max_tokens", message: "La respuesta de Claude se cortó por longitud" } });
        } else {
          try {
            enviar({ ok: true, json: extraerJson(r.texto), uso: { ...r.uso, costeUsd: coste } });
          } catch (err) {
            if (!(err instanceof JsonNoValidoError)) throw err;
            enviar({ error: { code: "invalid_json", message: err.message } });
          }
        }
      } catch (err) {
        const e =
          err instanceof ErrorPeticionClaude
            ? err
            : new ErrorPeticionClaude("api_error", err instanceof Error ? err.message : "Error");
        if (e.codigo !== "cancelled") console.error("[informes/claude]", e.codigo, e.message);
        enviar({ error: { code: e.codigo, message: e.message } });
      } finally {
        try {
          controller.close();
        } catch {
          // Ya cerrado.
        }
      }
    },
  });

  return new Response(flujo, {
    status: 200,
    headers: {
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "Cache-Control": "no-store, no-transform",
      "X-Accel-Buffering": "no",
    },
  });
}
