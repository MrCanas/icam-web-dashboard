import type { UserContext } from "@/lib/auth/currentUser";
import { withAudit } from "@/lib/audit/withAudit";
import { getPortfolioWriteSupabase } from "@/modules/portfolio/data/readClient";

export interface UploadLogInsert {
  archivo: string;
  num_proyectos?: number;
  estado: string;
  duracion_ms: number;
  detalle: Record<string, unknown>;
}

export async function insertUploadLog(ctx: UserContext, payload: UploadLogInsert) {
  return withAudit(
    ctx,
    "portfolio.upload_log.create",
    {
      resourceType: "upload_log",
      payload,
    },
    async () => {
      const supabase = getPortfolioWriteSupabase(ctx);
      return supabase.from("upload_logs").insert(payload);
    },
  );
}

export async function listUploadLogs(ctx: UserContext, limit = 200) {
  const supabase = getPortfolioWriteSupabase(ctx);
  return supabase
    .from("upload_logs")
    .select("*")
    .order("fecha", { ascending: false })
    .limit(limit);
}
