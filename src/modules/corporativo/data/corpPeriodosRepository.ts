import type { UserContext } from "@/lib/auth/currentUser";
import { withAudit } from "@/lib/audit/withAudit";
import {
  getCorporativoReadSupabase,
  getCorporativoWriteSupabase,
} from "@/modules/corporativo/data/readClient";
import type {
  CorpDiccionarioEntrada,
  CorpNota,
  CorpPeriodo,
} from "@/modules/corporativo/types";

/**
 * Acceso a las tres tablas del maestro corporativo. Convención del portal: `ctx`
 * como primer parámetro en todas las funciones, y toda mutación envuelta en
 * `withAudit`.
 */

/**
 * Todas las filas del maestro, ordenadas cronológicamente.
 *
 * No filtra por `tipo_periodo`: son 83 filas en total, así que traerlas de una vez
 * sale más barato que tres consultas, y la lógica de la página necesita los tres
 * niveles a la vez (los KPI van por trimestre, la comparativa por año).
 */
export async function listCorpPeriodos(ctx: UserContext) {
  const supabase = getCorporativoReadSupabase(ctx);
  return supabase
    .from("corp_periodos")
    .select("*")
    .order("anio", { ascending: true, nullsFirst: false })
    .order("trimestre", { ascending: true, nullsFirst: true })
    .returns<CorpPeriodo[]>();
}

export async function countCorpPeriodos(ctx: UserContext) {
  const supabase = getCorporativoReadSupabase(ctx);
  return supabase.from("corp_periodos").select("id", { count: "exact", head: true });
}

export async function listCorpDiccionario(ctx: UserContext) {
  const supabase = getCorporativoReadSupabase(ctx);
  return supabase
    .from("corp_diccionario")
    .select("*")
    .order("orden", { ascending: true })
    .returns<CorpDiccionarioEntrada[]>();
}

export async function listCorpNotas(ctx: UserContext) {
  const supabase = getCorporativoReadSupabase(ctx);
  return supabase
    .from("corp_notas")
    .select("*")
    .order("orden", { ascending: true })
    .returns<CorpNota[]>();
}

/** Reemplazo atómico del snapshot de periodos (RPC de la migración 038). */
export async function replaceCorpPeriodos(ctx: UserContext, rows: Record<string, unknown>[]) {
  return withAudit(
    ctx,
    "corporativo.periodo.replace",
    { resourceType: "corp_periodos", payload: { filas: rows.length } },
    async () => {
      const supabase = getCorporativoWriteSupabase(ctx);
      return supabase.rpc("replace_corp_periodos", { p_rows: rows });
    },
  );
}

export async function replaceCorpDiccionario(ctx: UserContext, rows: Record<string, unknown>[]) {
  return withAudit(
    ctx,
    "corporativo.diccionario.replace",
    { resourceType: "corp_diccionario", payload: { filas: rows.length } },
    async () => {
      const supabase = getCorporativoWriteSupabase(ctx);
      return supabase.rpc("replace_corp_diccionario", { p_rows: rows });
    },
  );
}

export async function replaceCorpNotas(ctx: UserContext, rows: Record<string, unknown>[]) {
  return withAudit(
    ctx,
    "corporativo.nota.replace",
    { resourceType: "corp_notas", payload: { filas: rows.length } },
    async () => {
      const supabase = getCorporativoWriteSupabase(ctx);
      return supabase.rpc("replace_corp_notas", { p_rows: rows });
    },
  );
}

export interface CorporativoUploadLogInsert {
  archivo: string;
  num_proyectos?: number;
  estado: string;
  duracion_ms: number;
  detalle: Record<string, unknown>;
}

/**
 * Traza de carga en `upload_logs`, la misma tabla que usa el portfolio.
 *
 * `fuente: "corporativo"` (columna de la 038) es lo que permite al banner de la
 * pestaña Datos no confundir un fallo de una sincronización con el de la otra.
 */
/** Solo las cargas del maestro CORPORATIVO (columna `fuente` de la 038). */
export async function listCorporativoUploadLogs(ctx: UserContext, limit = 20) {
  const supabase = getCorporativoWriteSupabase(ctx);
  return supabase
    .from("upload_logs")
    .select("*")
    .eq("fuente", "corporativo")
    .order("fecha", { ascending: false })
    .limit(limit);
}

export async function insertCorporativoUploadLog(
  ctx: UserContext,
  payload: CorporativoUploadLogInsert,
) {
  return withAudit(
    ctx,
    "corporativo.upload_log.create",
    { resourceType: "upload_log", payload },
    async () => {
      const supabase = getCorporativoWriteSupabase(ctx);
      return supabase.from("upload_logs").insert({ ...payload, fuente: "corporativo" });
    },
  );
}
