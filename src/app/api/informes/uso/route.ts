import { NextResponse } from "next/server";

import { readAccessResponse } from "@/lib/auth/api-guard";
import { getCurrentUser } from "@/lib/auth/currentUser";
import { resumenUsoInforme } from "@/modules/pm/informes/data/usoRepository";
import { esIdValido } from "@/modules/pm/informes/logic/colecciones";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/informes/uso?informe=<id> → coste acumulado de Claude para ese informe. */
export async function GET(request: Request) {
  const ctx = await getCurrentUser();
  if (!ctx) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const denegado = readAccessResponse(ctx, "pm");
  if (denegado) return denegado;

  const id = new URL(request.url).searchParams.get("informe") ?? "";
  if (!esIdValido(id)) return NextResponse.json({ error: "informe no válido" }, { status: 400 });

  const { data, error } = await resumenUsoInforme(ctx, id);
  if (error) return NextResponse.json({ error }, { status: 500 });
  return NextResponse.json(data, { headers: { "Cache-Control": "no-store" } });
}
