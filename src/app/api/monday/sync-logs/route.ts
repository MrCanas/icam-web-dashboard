import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { isIcamAuthenticated } from "@/lib/api-auth";
import { computeSyncSummary, fetchMondaySyncLogs } from "@/lib/monday/sync-logs";

export async function GET(request: NextRequest) {
  if (!isIcamAuthenticated(request)) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  try {
    const limitParam = Number(request.nextUrl.searchParams.get("limit") ?? "200");
    const limit = Number.isFinite(limitParam) ? limitParam : 200;
    const logs = await fetchMondaySyncLogs(limit);
    return NextResponse.json({
      logs,
      summary: computeSyncSummary(logs),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Error interno";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

