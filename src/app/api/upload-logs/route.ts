import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { isIcamAuthenticated } from "@/lib/api-auth";
import { createServiceRoleClient } from "@/lib/supabase/admin";

export async function GET(request: NextRequest) {
  if (!isIcamAuthenticated(request)) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  try {
    const supabase = createServiceRoleClient();
    const { data, error } = await supabase
      .from("upload_logs")
      .select("*")
      .order("fecha", { ascending: false })
      .limit(200);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ logs: data ?? [] });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Error interno";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
