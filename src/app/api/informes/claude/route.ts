import { NextResponse } from "next/server";

import { getCurrentUser } from "@/lib/auth/currentUser";
import { canAccessRouteKey, checkWriteAccess } from "@/lib/auth/permissions";
import { ErrorPeticionClaude, pedirAClaude, type ImagenPeticion } from "@/modules/pm/informes/data/anthropicClient";
import { cargarMaterial } from "@/modules/pm/informes/data/materialRepository";
import { registrarUso } from "@/modules/pm/informes/data/usoRepository";
import { costeUsd, extraerJson, JsonNoValidoError, MAX_BYTES_PROMPT, MAX_IMAGENES } from "@/modules/pm/informes/logic/peticion-claude";
import { leerPeticion, montarPrompt } from "@/modules/pm/informes/logic/peticiones";
import { tamano } from "@/modules/pm/informes/logic/prompts";
import { esIdInforme } from "@/modules/pm/informes/logic/trimestre";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// Una petición de slide tarda 0,5–2 min; el análisis, algo más.
export const maxDuration = 300;

const MEDIA_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

function error(code: string, message: string, status: number) {
  return NextResponse.json({ error: { code, message } }, { status });
}

/**
 * Redacción con Claude. El navegador pide «redacta la slide X del informe Y»
 * (logic/peticiones.ts) y aquí se monta el prompt con el informe, sus fuentes
 * y las referencias. Responde en NDJSON:
 *   {"t":"…"}                          trozos de texto según llegan
 *   {"p":1}                            latido mientras Claude piensa
 *   {"ok":true,"json":…,"uso":{…}}     fin, con el JSON ya leído
 *   {"error":{"code":"…","message":"…"}}
 * Cada petición deja una fila en informe_uso, también si acaba en refusal o
 * max_tokens (se factura igual).
 */
export async function POST(request: Request) {
  const ctx = await getCurrentUser();
  if (!ctx) return error("session_expired", "Tu sesión ha caducado: vuelve a entrar.", 401);
  // Generar cuesta dinero y cambia el informe: solo editores y admins de pm.
  if (!canAccessRouteKey(ctx, "pm.informes") || checkWriteAccess(ctx, "pm")) {
    return error("not_granted", "Tu acceso a Proyectos es de lectura: no puedes generar ni corregir informes.", 403);
  }

  let raw: Record<string, unknown>;
  try {
    raw = (await request.json()) as Record<string, unknown>;
  } catch {
    return error("api_error", "Cuerpo JSON no válido", 400);
  }
  const peticion = leerPeticion(raw);
  if (typeof peticion === "string") return error("api_error", peticion, 400);
  if (!esIdInforme(peticion.informeId)) return error("api_error", "Informe no válido", 400);

  const imagenes = Array.isArray(raw.imagenes) ? (raw.imagenes as ImagenPeticion[]) : [];
  if (imagenes.length > MAX_IMAGENES) return error("api_error", `Máximo ${MAX_IMAGENES} imágenes`, 400);
  if (imagenes.some((i) => typeof i?.data !== "string" || !MEDIA_TYPES.has(String(i.mediaType)))) {
    return error("api_error", "Imagen no válida", 400);
  }

  const m = await cargarMaterial(ctx, peticion.informeId);
  if (m.error !== null) return error("api_error", m.error, 500);
  if (!m.data) return error("not_found", "El informe ya no existe.", 404);
  const bloques = montarPrompt(peticion, m.data.material);
  if (typeof bloques === "string") return error("api_error", bloques, 400);
  if (tamano(bloques) > MAX_BYTES_PROMPT) {
    return error("prompt_too_large", "Demasiada información para una sola petición: quita alguna fuente.", 413);
  }

  const codificador = new TextEncoder();
  const inicio = Date.now();
  const informeId = peticion.informeId;

  const flujo = new ReadableStream<Uint8Array>({
    async start(controller) {
      const enviar = (obj: unknown) => {
        try {
          controller.enqueue(codificador.encode(JSON.stringify(obj) + "\n"));
        } catch {
          // El navegador cerró la conexión: no hay a quién enviar.
        }
      };
      const latido = setInterval(() => enviar({ p: 1 }), 15_000);
      try {
        const r = await pedirAClaude({ bloques, imagenes, signal: request.signal, onTexto: (t) => enviar({ t }) });
        const coste = costeUsd(r.modelo, r.uso);
        // Se registra también si la respuesta no sirve: se ha facturado igual.
        await registrarUso(ctx, {
          ...r.uso,
          informeId,
          tipo: peticion.tipo,
          modelo: r.modelo,
          costeUsd: coste,
          stopReason: r.stopReason,
          duracionMs: Date.now() - inicio,
        });
        if (r.stopReason === "refusal") {
          enviar({ error: { code: "refused", message: "Claude no ha podido procesar esta petición." } });
        } else if (r.stopReason === "max_tokens") {
          enviar({ error: { code: "max_tokens", message: "La respuesta de Claude se cortó por longitud." } });
        } else {
          try {
            enviar({ ok: true, json: extraerJson(r.texto), uso: { ...r.uso, costeUsd: coste, modelo: r.modelo } });
          } catch (err) {
            if (!(err instanceof JsonNoValidoError)) throw err;
            enviar({ error: { code: "invalid_json", message: "Claude no devolvió un resultado válido." } });
          }
        }
      } catch (err) {
        const e =
          err instanceof ErrorPeticionClaude ? err : new ErrorPeticionClaude("api_error", err instanceof Error ? err.message : "Error");
        if (e.codigo !== "cancelled") console.error("[informes/claude]", e.codigo, e.message);
        enviar({ error: { code: e.codigo, message: e.message } });
      } finally {
        clearInterval(latido);
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
