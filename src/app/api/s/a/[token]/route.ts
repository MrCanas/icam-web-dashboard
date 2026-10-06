import { NextResponse } from "next/server";

import { LOGO_CORREO_PNG_BASE64 } from "@/modules/comunicaciones/data/logoCorreo";
import { registrarEvento } from "@/modules/comunicaciones/data/seguimientoRepository";
import { esLecturaAutomatica, TOKEN_RE } from "@/modules/comunicaciones/logic/seguimiento";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * La imagen de apertura de un correo. PÚBLICA: la carga el programa de correo
 * de quien lo recibe, que no tiene sesión en el portal.
 *
 * Solo hace dos cosas: anotar que ese identificador ha cargado la imagen y
 * devolver la imagen. No lee ni devuelve ningún dato de nadie. Un identificador
 * mal formado contesta 404 sin tocar la base, y uno que no existe, también.
 *
 * No guarda la IP.
 */

/** GIF transparente de 1×1. */
const PIXEL = Buffer.from("R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7", "base64");
const LOGO = Buffer.from(LOGO_CORREO_PNG_BASE64, "base64");

const SIN_CACHE = {
  // Cada carga tiene que llegar aquí: si se cachea, las aperturas siguientes no constan.
  "Cache-Control": "no-store, no-cache, must-revalidate, private, max-age=0",
  Pragma: "no-cache",
  Expires: "0",
  "X-Robots-Tag": "noindex, nofollow",
};

function imagen(logo: boolean): NextResponse {
  return new NextResponse(new Uint8Array(logo ? LOGO : PIXEL), {
    headers: { ...SIN_CACHE, "Content-Type": logo ? "image/png" : "image/gif" },
  });
}

export async function GET(request: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  if (!TOKEN_RE.test(token)) return new NextResponse(null, { status: 404 });

  const agente = request.headers.get("user-agent");
  // El correo dice qué imagen espera: el logotipo ocupa sitio y el píxel no.
  const pideLogo = new URL(request.url).searchParams.get("v") === "logo";
  try {
    const r = await registrarEvento(token, "apertura", null, agente, esLecturaAutomatica(request.method, agente));
    if (!r.encontrado) return new NextResponse(null, { status: 404 });
    return imagen(pideLogo);
  } catch (err) {
    // Si no se puede anotar, el correo no tiene por qué verse roto: la imagen
    // que pidió sale igual.
    console.error("[seguimiento] apertura", err);
    return imagen(pideLogo);
  }
}

/** Una comprobación `HEAD` no es una persona abriendo el correo: no se anota. */
export function HEAD() {
  return new NextResponse(null, { status: 200, headers: SIN_CACHE });
}
