import type { UserContext } from "@/lib/auth/currentUser";
import { getPmReadSupabase } from "@/modules/pm/data/readClient";
import { fetchPmPortfolio, type PmPortfolioRow } from "@/modules/pm/data/pmRepository";
import type {
  PmActivoProyectoMap,
  PmHitoCatalogo,
  PmSnapshot,
} from "@/modules/pm/types";

export interface PlanificacionBoardData {
  rows: PmPortfolioRow[];
  catalogo: PmHitoCatalogo[];
  snapshots: PmSnapshot[];
  error: string | null;
}

/**
 * Todo lo que necesita la rejilla. Reutiliza fetchPmPortfolio a propósito: la
 * rejilla trabaja sobre las MISMAS tablas que el Overview, así que no hay
 * migración de datos ni riesgo de que las dos vistas discrepen.
 */
export async function fetchPlanificacionBoard(
  ctx: UserContext,
): Promise<PlanificacionBoardData> {
  const supabase = await getPmReadSupabase(ctx);

  const [portfolio, { data: catalogo, error: eCat }, { data: snaps, error: eSnap }] =
    await Promise.all([
      fetchPmPortfolio(ctx),
      supabase.from("pm_hito_catalogo").select("*").order("orden_default"),
      supabase.from("pm_snapshots").select("*").order("orden"),
    ]);

  const error = portfolio.error ?? eCat?.message ?? eSnap?.message ?? null;
  if (error) {
    return { rows: [], catalogo: [], snapshots: [], error };
  }

  return {
    rows: portfolio.rows,
    catalogo: (catalogo ?? []) as PmHitoCatalogo[],
    snapshots: (snaps ?? []) as PmSnapshot[],
    error: null,
  };
}

/** Solo los snapshots publicados, en el orden del registro. Lo que ve el dashboard. */
export async function fetchVisibleSnapshots(
  ctx: UserContext,
): Promise<{ snapshots: PmSnapshot[]; error: string | null }> {
  const supabase = await getPmReadSupabase(ctx);
  const { data, error } = await supabase
    .from("pm_snapshots")
    .select("*")
    .eq("visible_en_dashboard", true)
    .order("orden");

  if (error) return { snapshots: [], error: error.message };
  return { snapshots: (data ?? []) as PmSnapshot[], error: null };
}

/** Catálogo completo, para color / es_puntual / estado de mapeo. */
export async function fetchHitoCatalogo(
  ctx: UserContext,
): Promise<{ catalogo: PmHitoCatalogo[]; error: string | null }> {
  const supabase = await getPmReadSupabase(ctx);
  const { data, error } = await supabase
    .from("pm_hito_catalogo")
    .select("*")
    .order("orden_default");

  if (error) return { catalogo: [], error: error.message };
  return { catalogo: (data ?? []) as PmHitoCatalogo[], error: null };
}

export interface ProyectoFinancieroOption {
  proyecto: string;
  situacion: string | null;
  tipo_proyecto: string | null;
}

export interface ProyectosPageData {
  rows: PmPortfolioRow[];
  /** Opciones del desplegable: proyectos reales del maestro, no inventados. */
  proyectosFinancieros: ProyectoFinancieroOption[];
  /** pm_activo_id → proyecto_financiero_key. Varios activos pueden compartir valor. */
  mapeo: Record<string, string>;
  error: string | null;
}

export async function fetchProyectosPageData(
  ctx: UserContext,
): Promise<ProyectosPageData> {
  const supabase = await getPmReadSupabase(ctx);

  const [portfolio, { data: fin, error: eFin }, { data: map, error: eMap }] =
    await Promise.all([
      fetchPmPortfolio(ctx),
      supabase
        .from("proyectos")
        .select("proyecto, situacion, tipo_proyecto")
        .order("proyecto"),
      supabase.from("pm_activo_proyecto_map").select("*"),
    ]);

  const error = portfolio.error ?? eFin?.message ?? eMap?.message ?? null;
  if (error) {
    return { rows: [], proyectosFinancieros: [], mapeo: {}, error };
  }

  const mapeo: Record<string, string> = {};
  for (const m of (map ?? []) as PmActivoProyectoMap[]) {
    mapeo[m.pm_activo_id] = m.proyecto_financiero_key;
  }

  return {
    rows: portfolio.rows,
    proyectosFinancieros: (fin ?? []) as ProyectoFinancieroOption[],
    mapeo,
    error: null,
  };
}
