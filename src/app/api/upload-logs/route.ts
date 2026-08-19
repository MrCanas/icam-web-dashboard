import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/auth/currentUser";
import { readAccessResponse } from "@/lib/auth/api-guard";
import { listUploadLogs } from "@/modules/portfolio/data/uploadLogsRepository";

export async function GET(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  const denied = readAccessResponse(user, "financiero");
  if (denied) return denied;

  try {
    const { data, error } = await listUploadLogs(user, 200);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ logs: data ?? [] });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Error interno";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
