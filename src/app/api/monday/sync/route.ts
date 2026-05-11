import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { isIcamAuthenticated } from "@/lib/api-auth";
import { createSyncLog, runMondaySyncJob } from "@/lib/monday/sync-logs";

export async function POST(request: NextRequest) {
  if (!isIcamAuthenticated(request)) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  try {
    const syncId = await createSyncLog();
    // Background fire-and-forget.
    void runMondaySyncJob(syncId);
    return NextResponse.json({ syncId, status: "en_proceso" }, { status: 202 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Error interno";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

