import type { UserContext } from "@/lib/auth/currentUser";
import { withAudit } from "@/lib/audit/withAudit";
import type { Proyecto } from "@/modules/portfolio/types";
import { getPortfolioReadSupabase, getPortfolioWriteSupabase } from "@/modules/portfolio/data/readClient";

export interface ProyectosFilters {
  situacion?: string;
  tipoProyecto?: string;
}

export interface ListProyectosOptions {
  filters?: ProyectosFilters;
  /** Exact match on situacion (e.g. Proyectos page). */
  situacionEquals?: string;
  order?: { column: string; ascending: boolean; nullsFirst?: boolean };
  select?: string;
}

export async function countProyectosUltimaFila(ctx: UserContext) {
  const supabase = await getPortfolioReadSupabase(ctx);
  return supabase
    .from("proyectos")
    .select("*", { count: "exact", head: true })
    .eq("es_ultima_fila", 1);
}

export async function listProyectos(ctx: UserContext, options: ListProyectosOptions = {}) {
  const supabase = await getPortfolioReadSupabase(ctx);
  const select = options.select ?? "*";
  let q = supabase.from("proyectos").select(select).eq("es_ultima_fila", 1);

  if (options.situacionEquals) {
    q = q.eq("situacion", options.situacionEquals);
  }
  if (options.filters?.situacion) {
    q = q.eq("situacion", options.filters.situacion);
  }
  if (options.filters?.tipoProyecto) {
    q = q.eq("tipo_proyecto", options.filters.tipoProyecto);
  }
  if (options.order) {
    q = q.order(options.order.column, {
      ascending: options.order.ascending,
      nullsFirst: options.order.nullsFirst ?? false,
    });
  } else {
    q = q.order("proyecto", { ascending: true });
  }

  return q;
}

export async function listProyectosWithServiceRole(
  ctx: UserContext,
): Promise<{ rows: Proyecto[]; error: string | null }> {
  try {
    const supabase = getPortfolioWriteSupabase(ctx);
    const { data, error } = await supabase
      .from("proyectos")
      .select("*")
      .eq("es_ultima_fila", 1)
      .order("proyecto", { ascending: true });
    if (error) {
      return { rows: [], error: error.message };
    }
    return { rows: (data ?? []) as Proyecto[], error: null };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "No se pudo conectar a Supabase";
    return { rows: [], error: msg };
  }
}

export async function replaceProyectos(
  ctx: UserContext,
  rows: Record<string, unknown>[],
) {
  return withAudit(
    ctx,
    "portfolio.proyecto.replace",
    {
      resourceType: "proyecto",
      payload: { rowCount: rows.length },
    },
    async () => {
      const supabase = getPortfolioWriteSupabase(ctx);
      return supabase.rpc("replace_proyectos", { p_rows: rows });
    },
  );
}

export async function countProyectosUltimaFilaForDev(ctx: UserContext) {
  const supabase = getPortfolioWriteSupabase(ctx);
  return supabase
    .from("proyectos")
    .select("*", { count: "exact", head: true })
    .eq("es_ultima_fila", 1);
}
