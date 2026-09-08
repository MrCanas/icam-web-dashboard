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

/**
 * Solo las cargas del maestro de VEHÍCULOS.
 *
 * La columna `fuente` la añadió la migración 038, cuando el maestro corporativo
 * empezó a escribir en esta misma tabla. Las filas anteriores no la traen, y
 * todas eran de portfolio: por eso NULL cuenta como «portfolio» y no como
 * «desconocido». Sin este filtro, el banner de la pestaña Datos daría por caído
 * el portfolio cuando lo que ha fallado es el corporativo.
 */
export async function listUploadLogsPortfolio(ctx: UserContext, limit = 20) {
  const supabase = getPortfolioWriteSupabase(ctx);
  return supabase
    .from("upload_logs")
    .select("*")
    .or("fuente.is.null,fuente.eq.portfolio")
    .order("fecha", { ascending: false })
    .limit(limit);
}
