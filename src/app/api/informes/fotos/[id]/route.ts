import { NextResponse } from "next/server";

import { getCurrentUser } from "@/lib/auth/currentUser";
import { canAccessRouteKey } from "@/lib/auth/permissions";
import { descargarFoto } from "@/modules/pm/informes/data/fotosRepository";

export const runtime = "nodejs";

/**
 * Sirve una foto del informe desde el mismo origen que la herramienta: la
 * vista de impresión y las capturas de corrección no tienen problemas de CORS
 * y el bucket sigue siendo privado.
 */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await getCurrentUser();
  if (!ctx) return new NextResponse("Sesión caducada", { status: 401 });
  if (!canAccessRouteKey(ctx, "pm.informes")) return new NextResponse("Sin acceso", { status: 403 });
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return new NextResponse("No encontrada", { status: 404 });
  const r = await descargarFoto(ctx, id);
  if (r.error !== null) return new NextResponse(r.error, { status: 500 });
  if (!r.data) return new NextResponse("No encontrada", { status: 404 });
  return new NextResponse(r.data.bytes, {
    headers: {
      "Content-Type": r.data.mime,
      // Un id nunca cambia de contenido: caché larga, solo en el navegador.
      "Cache-Control": "private, max-age=31536000, immutable",
    },
  });
}
