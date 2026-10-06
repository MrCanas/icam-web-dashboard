import { NextResponse } from "next/server";

import { registrarEvento } from "@/modules/comunicaciones/data/seguimientoRepository";
import { esEnlaceRastreable, esLecturaAutomatica, TOKEN_RE } from "@/modules/comunicaciones/logic/seguimiento";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Un enlace de un correo. PÚBLICA: la abre quien pulsa el enlace, que no tiene
 * sesión en el portal.
 *
 * Anota el clic y redirige al destino. El destino NO viaja en la URL: sale de
 * lo que se guardó para ese correo al enviarlo, por posición. Con una URL de
 * estas nadie puede hacer que el dominio de Impar redirija a otro sitio.
 *
 * Lo desconocido —identificador mal formado o inexistente, posición fuera de
 * rango— contesta 404 sin escribir nada. No guarda la IP.
 */

const SIN_CACHE = {
  "Cache-Control": "no-store, no-cache, must-revalidate, private, max-age=0",
  "X-Robots-Tag": "noindex, nofollow",
  "Referrer-Policy": "no-referrer",
};

function noEncontrado(): NextResponse {
  return new NextResponse("Este enlace no existe o ha caducado.", {
    status: 404,
    headers: { ...SIN_CACHE, "Content-Type": "text/plain; charset=utf-8" },
  });
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ token: string; n: string }> },
) {
  const { token, n } = await params;
  if (!TOKEN_RE.test(token) || !/^\d{1,3}$/.test(n)) return noEncontrado();

  const agente = request.headers.get("user-agent");
  let destino: string | null;
  try {
    const r = await registrarEvento(token, "clic", Number(n), agente, esLecturaAutomatica(request.method, agente));
    if (!r.encontrado) return noEncontrado();
    destino = r.destino;
  } catch (err) {
    console.error("[seguimiento] clic", err);
    return new NextResponse("No se ha podido abrir el enlace. Inténtalo de nuevo en unos minutos.", {
      status: 503,
      headers: { ...SIN_CACHE, "Content-Type": "text/plain; charset=utf-8" },
    });
  }

  // Lo guardado ya se validó al enviar. Se vuelve a mirar: de aquí solo se sale a http(s).
  if (!destino || !esEnlaceRastreable(destino)) return noEncontrado();
  return new NextResponse(null, { status: 302, headers: { ...SIN_CACHE, Location: destino } });
}

/** Un `HEAD` es un filtro comprobando el enlace: no se anota ni se le dice adónde lleva. */
export function HEAD() {
  return new NextResponse(null, { status: 200, headers: SIN_CACHE });
}
