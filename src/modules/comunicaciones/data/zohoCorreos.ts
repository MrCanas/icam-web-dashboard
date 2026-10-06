import { getZohoConfig, zohoApi, type ZohoConfig } from "@/lib/zoho/client";
import { normalizarEmail } from "@/modules/comunicaciones/logic/candado";

/**
 * Lo que Zoho dice de un correo ya enviado. Solo LECTURA, con el token de
 * lectura del portal.
 *
 * Se usa para dos cosas: comprobar, justo después de enviar, que Zoho dice
 * haberlo mandado a quien tenía que ir; y saber si ha rebotado.
 *
 * Zoho NO lo ofrece para todos los registros: en 102 de las 164 cuentas de
 * inversión contesta `NOT_SUPPORTED` (comprobado el 2026-10-06). Ahí no hay
 * dato, y se dice; no es un error.
 */

export interface CorreoEnZoho {
  /** false = Zoho no expone los correos de este registro. */
  soportado: boolean;
  para: string[];
  copia: string[];
  entrega: "entregado" | "rebotado" | "sin_dato";
  motivo: string | null;
}

const SIN_DATO: CorreoEnZoho = { soportado: false, para: [], copia: [], entrega: "sin_dato", motivo: null };

function direcciones(lista: unknown): string[] {
  if (!Array.isArray(lista)) return [];
  return lista
    .map((d) => (typeof d === "object" && d !== null ? (d as { email?: unknown }).email : null))
    .filter((e): e is string => typeof e === "string" && e.trim() !== "")
    .map(normalizarEmail);
}

export async function leerCorreoEnviado(
  modulo: string,
  registroId: string,
  messageId: string,
  cfg: ZohoConfig = getZohoConfig({ conModulo: false }),
): Promise<CorreoEnZoho> {
  let respuesta: { Emails?: Record<string, unknown>[] };
  try {
    respuesta = await zohoApi<{ Emails?: Record<string, unknown>[] }>(
      `/${encodeURIComponent(modulo)}/${encodeURIComponent(registroId)}/Emails/${encodeURIComponent(messageId)}`,
      undefined,
      cfg,
    );
  } catch (err) {
    const mensaje = err instanceof Error ? err.message : String(err);
    // Ni «no soportado» ni «todavía no está» son un fallo: no hay dato.
    if (/NOT_SUPPORTED|INVALID_DATA|Zoho 404|Zoho 204/.test(mensaje)) return SIN_DATO;
    throw err;
  }
  const correo = respuesta.Emails?.[0];
  if (!correo) return SIN_DATO;

  const estados = Array.isArray(correo.status) ? (correo.status as Record<string, unknown>[]) : [];
  const tipos = estados.map((s) => String(s.type ?? "").toLowerCase());
  const rebote = estados.find((s) => String(s.type ?? "").toLowerCase() === "bounced");
  const motivo = rebote
    ? [rebote.category, rebote.sub_category, rebote.bounced_reason]
        .filter((v): v is string => typeof v === "string" && v.trim() !== "")
        .join(" · ") || "Rebotado"
    : null;

  return {
    soportado: true,
    para: direcciones(correo.to),
    copia: direcciones(correo.cc),
    entrega: rebote
      ? "rebotado"
      : tipos.some((t) => t === "delivered" || t === "opened" || t === "clicked")
        ? "entregado"
        : "sin_dato",
    motivo,
  };
}
