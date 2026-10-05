import { NextResponse, type NextRequest } from "next/server";

import { getCurrentUser } from "@/lib/auth/currentUser";
import { SESSION_COOKIE_NAME } from "@/lib/auth/jwt";
import { canAccessRouteKey } from "@/lib/auth/permissions";
import { registrarExportacion } from "@/modules/pm/informes/data/exportacionesRepository";
import { obtenerInforme } from "@/modules/pm/informes/data/informesRepository";
import { abrirNavegadorPdf, contextoPdf, ErrorPdf, imprimirInforme } from "@/modules/pm/informes/data/pdfInforme";
import { nombrePdf, rutaImprimirPdf } from "@/modules/pm/informes/logic/paths";
import { esIdInforme } from "@/modules/pm/informes/logic/trimestre";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// Arrancar Chromium y pintar un informe entero lleva de 10 a 30 s.
export const maxDuration = 120;

/** Cookie con la que Vercel deja pasar a quien ya se ha identificado en un despliegue protegido (previews). */
const COOKIE_VERCEL = "_vercel_jwt";

/**
 * Origen del portal al que se conecta el navegador del servidor: el mismo por
 * el que ha llegado la petición (ahí vale la sesión). Solo se aceptan los
 * dominios del propio despliegue, para no llevar la sesión a otro sitio.
 */
function origenPortal(request: NextRequest): string | null {
  const { protocol, host, hostname } = request.nextUrl;
  const permitidos = (process.env.INFORMES_PDF_ORIGENES ?? "")
    .split(",")
    .concat(process.env.VERCEL_URL ?? "", process.env.VERCEL_BRANCH_URL ?? "", process.env.VERCEL_PROJECT_PRODUCTION_URL ?? "")
    .map((h) => h.trim().toLowerCase())
    .filter(Boolean);
  const local = !process.env.VERCEL && (hostname === "localhost" || hostname === "127.0.0.1");
  return local || permitidos.includes(host.toLowerCase()) ? `${protocol}//${host}` : null;
}

/**
 * PDF del informe, hecho en el servidor a partir de la vista de impresión: lo
 * mismo que se ve en el editor, una slide por página de 960 × 540 pt. El
 * navegador del servidor entra con la sesión de quien lo pide (ve lo que esa
 * persona puede ver) y se cierra al terminar.
 *
 * Cuerpo: `{ confirmado }`. El validador se pasa aquí, con lo que calcula la
 * propia vista: si hay incidencias y no se ha confirmado, no hay PDF (409 con
 * la lista). Cada PDF que sale queda anotado en el registro de exportaciones.
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await getCurrentUser();
  if (!ctx) return NextResponse.json({ error: "Tu sesión ha caducado: vuelve a entrar." }, { status: 401 });
  if (!canAccessRouteKey(ctx, "pm.informes")) return NextResponse.json({ error: "Sin acceso a los informes." }, { status: 403 });
  const id = decodeURIComponent((await params).id);
  if (!esIdInforme(id)) return NextResponse.json({ error: "Informe no válido." }, { status: 404 });
  const r = await obtenerInforme(ctx, id);
  if (r.error !== null) return NextResponse.json({ error: r.error }, { status: 500 });
  if (!r.data) return NextResponse.json({ error: "Ese informe ya no existe." }, { status: 404 });
  if (!r.data.contenido?.slides?.some((s) => !s.oculto)) {
    return NextResponse.json({ error: "Este informe todavía no tiene slides." }, { status: 409 });
  }
  const cuerpo = (await request.json().catch(() => ({}))) as { confirmado?: unknown };
  const confirmado = cuerpo.confirmado === true;
  const origen = origenPortal(request);
  const sesion = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  if (!origen || !sesion) {
    return NextResponse.json(
      { error: `No se puede generar el PDF desde ${request.nextUrl.host}: no es un dominio del portal (INFORMES_PDF_ORIGENES).` },
      { status: 400 },
    );
  }

  let navegador;
  try {
    navegador = await abrirNavegadorPdf();
    const bypass = process.env.VERCEL_AUTOMATION_BYPASS_SECRET;
    const contexto = await contextoPdf(navegador, origen, bypass ? { "x-vercel-protection-bypass": bypass } : {});
    const seguras = origen.startsWith("https:");
    const vercel = request.cookies.get(COOKIE_VERCEL)?.value;
    await contexto.addCookies([
      { name: SESSION_COOKIE_NAME, value: sesion, url: origen, httpOnly: true, secure: seguras },
      ...(vercel ? [{ name: COOKIE_VERCEL, value: vercel, url: origen, httpOnly: true, secure: seguras }] : []),
    ]);
    const { pdf, incidencias } = await imprimirInforme(contexto, origen + rutaImprimirPdf(id));
    if (incidencias.length && !confirmado) {
      return NextResponse.json(
        { error: "El validador ha encontrado incidencias: hay que marcar «Estoy seguro» para exportar así.", incidencias },
        { status: 409 },
      );
    }
    const registro = await registrarExportacion(ctx, r.data, { medio: "pdf", incidencias, confirmado: incidencias.length > 0 && confirmado });
    if (registro.error !== null) return NextResponse.json({ error: `No se ha podido anotar la exportación: ${registro.error}` }, { status: 500 });
    const nombre = `${nombrePdf(r.data)}.pdf`;
    return new NextResponse(new Uint8Array(pdf), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Length": String(pdf.length),
        "Content-Disposition": `attachment; filename="${nombre.replace(/[^\x20-\x7e]|["\\]/g, "_")}"; filename*=UTF-8''${encodeURIComponent(nombre)}`,
        "Cache-Control": "private, no-store",
      },
    });
  } catch (e) {
    console.error("[informes/pdf]", id, e);
    if (e instanceof ErrorPdf) return NextResponse.json({ error: e.message }, { status: e.status });
    return NextResponse.json({ error: "No se ha podido generar el PDF. Vuelve a intentarlo o usa la vista de impresión." }, { status: 500 });
  } finally {
    await navegador?.close().catch(() => undefined);
  }
}
