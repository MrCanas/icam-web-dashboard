import { NextResponse } from "next/server";

import { writeAccessResponse } from "@/lib/auth/api-guard";
import { getCurrentUser } from "@/lib/auth/currentUser";
import {
  MAX_BYTES_FOTO,
  MIME_ADMITIDOS,
  subirAsset,
} from "@/modules/pm/informes/data/assetsRepository";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Sube una foto (cuerpo binario, Content-Type = tipo de imagen). Devuelve { id }. */
export async function POST(request: Request) {
  const ctx = await getCurrentUser();
  if (!ctx) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const denegado = writeAccessResponse(ctx, "pm");
  if (denegado) return denegado;

  const mime = (request.headers.get("content-type") ?? "").split(";")[0]!.trim();
  if (!(MIME_ADMITIDOS as readonly string[]).includes(mime)) {
    return NextResponse.json({ error: "Solo JPEG, PNG o WebP" }, { status: 415 });
  }
  const cuerpo = await request.arrayBuffer();
  if (!cuerpo.byteLength) return NextResponse.json({ error: "Fichero vacío" }, { status: 400 });
  if (cuerpo.byteLength > MAX_BYTES_FOTO) {
    return NextResponse.json({ error: "La foto supera 10 MB" }, { status: 413 });
  }

  const { id, error } = await subirAsset(ctx, cuerpo, mime);
  if (error || !id) return NextResponse.json({ error: error ?? "No se pudo subir" }, { status: 500 });
  return NextResponse.json({ id });
}
