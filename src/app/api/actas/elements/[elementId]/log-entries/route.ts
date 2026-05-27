import { NextResponse } from "next/server";

import { getCurrentUser } from "@/lib/auth/currentUser";
import { fetchElementLogEntries } from "@/modules/pm/actas/data/actasRepository";

interface RouteContext {
  params: Promise<{ elementId: string }>;
}

export async function GET(request: Request, context: RouteContext) {
  const ctx = await getCurrentUser();
  if (!ctx) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const { elementId } = await context.params;
  const id = elementId?.trim();
  if (!id) {
    return NextResponse.json({ error: "elementId requerido" }, { status: 400 });
  }

  const asOfRaw = new URL(request.url).searchParams.get("asOf")?.trim();
  const { parseAsOfDateParam } = await import(
    "@/modules/pm/actas/logic/operativo-asof"
  );
  const asOfIsoDate = parseAsOfDateParam(asOfRaw ?? undefined) ?? undefined;

  const { entries, error } = await fetchElementLogEntries(ctx, id, {
    asOfIsoDate,
  });
  if (error) {
    return NextResponse.json({ error }, { status: 500 });
  }

  return NextResponse.json({ entries });
}
