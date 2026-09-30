import { NextResponse } from "next/server";

import { readAccessResponse, writeAccessResponse } from "@/lib/auth/api-guard";
import { getCurrentUser } from "@/lib/auth/currentUser";
import { borrarAsset, leerAsset } from "@/modules/pm/informes/data/assetsRepository";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

interface RouteContext {
  params: Promise<{ id: string }>;
}

/**
 * Sirve la foto desde el mismo origen, no con una URL firmada de Storage: el
 * PDF se genera en el navegador con html2canvas, y una imagen de otro origen
 * «ensucia» el canvas y hace fallar la exportación.
 */
export async function GET(_request: Request, context: RouteContext) {
  const ctx = await getCurrentUser();
  if (!ctx) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const denegado = readAccessResponse(ctx, "pm");
  if (denegado) return denegado;

  const { id } = await context.params;
  if (!UUID.test(id)) return NextResponse.json({ error: "Id no válido" }, { status: 400 });

  const { data, error } = await leerAsset(ctx, id);
  if (error) return NextResponse.json({ error }, { status: 500 });
  if (!data) return NextResponse.json({ error: "No existe" }, { status: 404 });

  return new NextResponse(new Uint8Array(data.cuerpo), {
    status: 200,
    headers: {
      "Content-Type": data.mime,
      // El id no cambia nunca de contenido: se puede cachear en el navegador.
      "Cache-Control": "private, max-age=86400, immutable",
    },
  });
}

export async function DELETE(_request: Request, context: RouteContext) {
  const ctx = await getCurrentUser();
  if (!ctx) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const denegado = writeAccessResponse(ctx, "pm");
  if (denegado) return denegado;

  const { id } = await context.params;
  if (!UUID.test(id)) return NextResponse.json({ error: "Id no válido" }, { status: 400 });

  const { error } = await borrarAsset(ctx, id);
  if (error) return NextResponse.json({ error }, { status: 500 });
  return NextResponse.json({ ok: true });
}
