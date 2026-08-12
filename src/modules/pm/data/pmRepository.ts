import type { UserContext } from "@/lib/auth/currentUser";
import { withAudit } from "@/lib/audit/withAudit";
import type {
  PmActivo,
  PmActivoSnapshot,
  PmHito,
  PmSnapshotFecha,
} from "@/modules/pm/types";
import { getPmReadSupabase, getPmWriteSupabase } from "@/modules/pm/data/readClient";
import { deviationVsLevantamientoDays } from "@/modules/pm/logic/pm-viz";

export interface PmHitoEnriched extends PmHito {
  snapshots: Record<string, string | null>;
  /**
   * Desviación vs levantamiento calculada desde las fechas, no leída de la
   * columna del Excel. Se rellena en fetchPmPortfolio; null si falta el
   * levantamiento o no hay ninguna previsión.
   */
  desviacion_lev_derivada?: number | null;
}

export interface PmPortfolioRow {
  activo: PmActivo;
  hitos: PmHitoEnriched[];
}

export interface PmPortfolioOptions {
  /**
   * Incluir proyectos archivados. Lo quieren Proyectos (donde se archivan y
   * restauran), Planificación y el detalle: un proyecto archivado sigue siendo
   * consultable por URL, solo desaparece de los listados.
   */
  incluirActivosArchivados?: boolean;
  /**
   * Incluir hitos archivados. Solo lo quiere Planificación, para el apartado
   * «Archivados».
   *
   * Va SEPARADO de los activos a propósito: son dos reglas distintas y juntarlas
   * hacía que el detalle de un proyecto pintara sus hitos archivados solo porque
   * necesitaba poder mostrar proyectos archivados.
   */
  incluirHitosArchivados?: boolean;
  /**
   * Eliminar de `h.snapshots` los trimestres que ese proyecto NO publica. Por
   * defecto sí: así el Gantt, la evolución, la tabla de desviaciones y los KPIs
   * solo ven lo publicado sin tener que saber nada de pm_activo_snapshot.
   */
  soloPublicados?: boolean;
}

/**
 * Portfolio PM. Es el ÚNICO punto de consulta de pm_activos/pm_hitos, así que
 * las reglas de archivado y publicación se aplican aquí y se propagan solas a
 * todos los consumidores.
 *
 * Por defecto devuelve lo que debe ver el dashboard: sin archivados y solo con
 * los trimestres publicados por cada proyecto.
 */
export async function fetchPmPortfolio(
  ctx: UserContext,
  options: PmPortfolioOptions = {},
): Promise<{
  rows: PmPortfolioRow[];
  snapshotCodes: string[];
  error: string | null;
}> {
  const {
    incluirActivosArchivados = false,
    incluirHitosArchivados = false,
    soloPublicados = true,
  } = options;
  const supabase = await getPmReadSupabase(ctx);

  const [
    { data: activos, error: e1 },
    { data: hitos, error: e2 },
    { data: snaps, error: e3 },
    { data: publicaciones, error: e4 },
  ] = await Promise.all([
    supabase.from("pm_activos").select("*").order("id_activo"),
    supabase.from("pm_hitos").select("*").order("orden_hito"),
    supabase.from("pm_snapshot_fechas").select("*"),
    supabase.from("pm_activo_snapshot").select("*"),
  ]);

  const err = e1?.message ?? e2?.message ?? e3?.message ?? e4?.message ?? null;
  if (err) {
    return { rows: [], snapshotCodes: [], error: err };
  }

  // Solo se guardan las excepciones: lo que no está aquí, está publicado.
  const retirados = new Set<string>();
  for (const p of (publicaciones ?? []) as PmActivoSnapshot[]) {
    if (!p.publicado) retirados.add(`${p.activo_id}|${p.snapshot_code}`);
  }

  const snapByHito = new Map<string, Record<string, string | null>>();
  for (const s of snaps ?? []) {
    const row = s as PmSnapshotFecha;
    if (!snapByHito.has(row.hito_id)) snapByHito.set(row.hito_id, {});
    snapByHito.get(row.hito_id)![row.snapshot_code] = row.fecha;
  }

  const hitosByActivo = new Map<string, PmHitoEnriched[]>();
  for (const h of hitos ?? []) {
    const hito = h as PmHito;
    if (!incluirHitosArchivados && hito.archivado_at) continue;

    let snapshots = snapByHito.get(hito.id) ?? {};
    if (soloPublicados) {
      snapshots = Object.fromEntries(
        Object.entries(snapshots).filter(
          ([code]) => !retirados.has(`${hito.activo_id}|${code}`),
        ),
      );
    }

    const list = hitosByActivo.get(hito.activo_id) ?? [];
    list.push({ ...hito, snapshots });
    hitosByActivo.set(hito.activo_id, list);
  }

  // Derivar la desviación aquí y no en cada consumidor: los KPIs del Overview
  // leían la columna del Excel mientras PmDeviationTable ya recalculaba desde
  // las fechas, y podían discrepar. Ahora ambos salen del mismo número.
  for (const list of hitosByActivo.values()) {
    for (const h of list) {
      h.desviacion_lev_derivada = deviationVsLevantamientoDays(h);
    }
  }

  const rows: PmPortfolioRow[] = (activos ?? [])
    .map((a) => a as PmActivo)
    .filter((activo) => incluirActivosArchivados || !activo.archivado_at)
    .map((activo) => {
      const list = hitosByActivo.get(activo.id) ?? [];
      list.sort((x, y) => x.orden_hito - y.orden_hito);
      return { activo, hitos: list };
    });

  // Los códigos salen de las filas YA filtradas: un trimestre que solo tenía
  // fechas en proyectos archivados o retirados no debe ofrecerse en el selector.
  const codes = new Set<string>();
  for (const r of rows) {
    for (const h of r.hitos) {
      for (const [code, fecha] of Object.entries(h.snapshots)) {
        if (fecha) codes.add(code);
      }
    }
  }

  return { rows, snapshotCodes: [...codes].sort(), error: null };
}

export async function fetchPmActivoBySlug(
  ctx: UserContext,
  idActivo: string,
  options: PmPortfolioOptions = {},
): Promise<{ row: PmPortfolioRow | null; error: string | null }> {
  const decoded = decodeURIComponent(idActivo);

  // Un proyecto archivado sigue siendo consultable por URL (si se filtrara, su
  // detalle daría 404 y desde Proyectos se enlaza a él), pero sus hitos
  // archivados NO se pintan: no aplican a ese proyecto.
  const { rows, error } = await fetchPmPortfolio(ctx, {
    incluirActivosArchivados: true,
    incluirHitosArchivados: false,
    ...options,
  });
  if (error) return { row: null, error };
  const row = rows.find((r) => r.activo.id_activo === decoded) ?? null;
  return { row, error: null };
}

export async function replacePmPortfolio(
  ctx: UserContext,
  rows: Record<string, unknown>[],
) {
  return withAudit(
    ctx,
    "pm.portfolio.replace",
    {
      resourceType: "pm_portfolio",
      payload: { rowCount: rows.length },
    },
    async () => {
      const supabase = getPmWriteSupabase(ctx);
      return supabase.rpc("replace_pm_portfolio", { p_rows: rows });
    },
  );
}

export interface PmImportLogInsert {
  archivo: string;
  estado: string;
  duracion_ms: number;
  detalle: Record<string, unknown>;
}

export async function insertPmImportLog(ctx: UserContext, payload: PmImportLogInsert) {
  return withAudit(
    ctx,
    "pm.import_log.create",
    {
      resourceType: "import_log",
      payload,
    },
    async () => {
      const supabase = getPmWriteSupabase(ctx);
      return supabase.from("pm_import_logs").insert(payload);
    },
  );
}
