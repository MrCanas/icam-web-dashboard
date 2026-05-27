import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/auth/currentUser";
import { writeAccessResponse } from "@/lib/auth/api-guard";
import { createSyncLog, runMondaySyncJob } from "@/modules/monday/data/syncLogsRepository";

export async function POST(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  const denied = writeAccessResponse(user, "adquisiciones");
  if (denied) return denied;

  try {
    const syncId = await createSyncLog(user);
    // Background fire-and-forget.
    void runMondaySyncJob(user, syncId);
    return NextResponse.json({ syncId, status: "en_proceso" }, { status: 202 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Error interno";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

