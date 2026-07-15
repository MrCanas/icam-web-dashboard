import type { UserContext } from "@/lib/auth/currentUser";
import {
  countProyectosUltimaFila,
  listProyectos,
  type ProyectosFilters,
} from "@/modules/portfolio/data/proyectosRepository";
import type { Proyecto } from "@/modules/portfolio/types";

const TENDENCIAS_SELECT =
  "id,proyecto,situacion,tipo_proyecto,inversion_total,total_ingresos_venta,beneficios,unidades_totales,tir_desp_is,roe_desp_is,multiplo,project_irr,bcr,ubicacion,equity,holding_period,superficie_edificable,es_ultima_fila,fecha_inicio,created_at";

export async function loadPortfolioCountAndList(
  ctx: UserContext,
  filters?: ProyectosFilters,
) {
  const [{ count: portfolioCount, error: countError }, filteredResult] = await Promise.all([
    countProyectosUltimaFila(ctx),
    listProyectos(ctx, {
      filters,
      order: { column: "proyecto", ascending: true },
    }),
  ]);
  const { data, error } = filteredResult;
  return { portfolioCount, countError, data, error };
}

export async function loadTendenciasPageData(ctx: UserContext) {
  const [{ count: portfolioCount, error: countError }, rowsResult] = await Promise.all([
    countProyectosUltimaFila(ctx),
    listProyectos(ctx, {
      select: TENDENCIAS_SELECT,
      order: { column: "proyecto", ascending: true },
    }),
  ]);
  const { data, error } = rowsResult;
  return { portfolioCount, countError, data, error };
}

export async function loadProyectosPageData(
  ctx: UserContext,
  situacion?: string,
) {
  const [{ count: portfolioCount, error: countError }, filteredResult] = await Promise.all([
    countProyectosUltimaFila(ctx),
    listProyectos(ctx, {
      situacionEquals: situacion,
      order: { column: "inversion_total", ascending: false, nullsFirst: false },
    }),
  ]);
  const { data, error } = filteredResult;
  return { portfolioCount, countError, data, error };
}

export function filterUltimaFilaRows(data: Proyecto[] | null): Proyecto[] {
  return (data ?? []).filter((row) => row.es_ultima_fila === 1);
}
