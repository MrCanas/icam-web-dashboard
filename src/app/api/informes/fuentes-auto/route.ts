import { NextResponse } from "next/server";

import { readAccessResponse } from "@/lib/auth/api-guard";
import { getCurrentUser } from "@/lib/auth/currentUser";
import { cargarFuentesAutomaticas } from "@/modules/pm/informes/data/fuentesAutoRepository";
import { parseTrimestre } from "@/modules/pm/informes/logic/trimestre";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/informes/fuentes-auto?activo=<id_activo>&trimestre=Q3%202026
 * → { documentos: [{ clave, nombre, texto, auto }], avisos: [] }
 *
 * Las actas del trimestre y la planificación del activo, ya en texto, para el
 * paso 2 de la app de informes.
 */
export async function GET(request: Request) {
  const ctx = await getCurrentUser();
  if (!ctx) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const denegado = readAccessResponse(ctx, "pm");
  if (denegado) return denegado;

  const url = new URL(request.url);
  const idActivo = url.searchParams.get("activo")?.trim() ?? "";
  const etiqueta = url.searchParams.get("trimestre")?.trim() ?? "";
  const trimestre = parseTrimestre(etiqueta);
  if (!idActivo || idActivo.length > 80) {
    return NextResponse.json({ error: "activo requerido" }, { status: 400 });
  }
  if (!trimestre) {
    return NextResponse.json({ error: "trimestre debe tener la forma «Qn AAAA»" }, { status: 400 });
  }

  const resultado = await cargarFuentesAutomaticas(ctx, idActivo, trimestre, etiqueta);
  return NextResponse.json(resultado, { headers: { "Cache-Control": "no-store" } });
}
