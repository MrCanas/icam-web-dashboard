import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/auth/currentUser";
import { readAccessResponse } from "@/lib/auth/api-guard";
import { fetchMondaySyncLogs } from "@/modules/monday/data/syncLogsRepository";
import { computeSyncSummary } from "@/modules/monday/logic/syncSummary";

export async function GET(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  const denied = readAccessResponse(user, "adquisiciones");
  if (denied) return denied;

  try {
    const limitParam = Number(request.nextUrl.searchParams.get("limit") ?? "200");
    const limit = Number.isFinite(limitParam) ? limitParam : 200;
    const logs = await fetchMondaySyncLogs(user, limit);
    return NextResponse.json({
      logs,
      summary: computeSyncSummary(logs),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Error interno";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

