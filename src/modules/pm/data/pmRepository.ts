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
  /**
   * Restringe la consulta a un único activo (pm_activos.id_activo): las 4
   * tablas se leen filtradas en vez de completas. OJO: con esta opción,
   * `snapshotCodes` son solo los de ese proyecto, no los del portfolio.
   */
  soloIdActivo?: string;
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
    soloIdActivo,
  } = options;
  const supabase = await getPmReadSupabase(ctx);

  // Las mismas cuatro variables salen de la rama completa o de la filtrada;
  // el pipeline en memoria de más abajo no distingue una de otra.
  let activos: unknown[] | null;
  let hitos: unknown[] | null;
  let snaps: unknown[] | null;
  let publicaciones: unknown[] | null;

  if (soloIdActivo == null) {
    const [r1, r2, r3, r4] = await Promise.all([
      supabase.from("pm_activos").select("*").order("id_activo"),
      supabase.from("pm_hitos").select("*").order("orden_hito"),
      supabase.from("pm_snapshot_fechas").select("*"),
      supabase.from("pm_activo_snapshot").select("*"),
    ]);
    const err =
      r1.error?.message ?? r2.error?.message ?? r3.error?.message ?? r4.error?.message ?? null;
    if (err) {
      return { rows: [], snapshotCodes: [], error: err };
    }
    activos = r1.data;
    hitos = r2.data;
    snaps = r3.data;
    publicaciones = r4.data;
  } else {
    // Dos fases: pm_snapshot_fechas solo tiene hito_id, así que primero hacen
    // falta el activo y sus hitos. Sigue siendo mucho más barato que descargar
    // las cuatro tablas completas para quedarse con un proyecto.
    const rActivo = await supabase
      .from("pm_activos")
      .select("*")
      .eq("id_activo", soloIdActivo);
    if (rActivo.error) {
      return { rows: [], snapshotCodes: [], error: rActivo.error.message };
    }
    activos = rActivo.data;
    const activoId = (rActivo.data?.[0] as PmActivo | undefined)?.id;
    if (!activoId) {
      return { rows: [], snapshotCodes: [], error: null };
    }

    const [rHitos, rPublicaciones] = await Promise.all([
      supabase
        .from("pm_hitos")
        .select("*")
        .eq("activo_id", activoId)
        .order("orden_hito"),
      supabase.from("pm_activo_snapshot").select("*").eq("activo_id", activoId),
    ]);
    const errFase2 =
      rHitos.error?.message ?? rPublicaciones.error?.message ?? null;
    if (errFase2) {
      return { rows: [], snapshotCodes: [], error: errFase2 };
    }
    hitos = rHitos.data;
    publicaciones = rPublicaciones.data;

    const hitoIds = (rHitos.data ?? []).map((h) => (h as PmHito).id);
    if (hitoIds.length === 0) {
      snaps = [];
    } else {
      const rSnaps = await supabase
        .from("pm_snapshot_fechas")
        .select("*")
        .in("hito_id", hitoIds);
      if (rSnaps.error) {
        return { rows: [], snapshotCodes: [], error: rSnaps.error.message };
      }
      snaps = rSnaps.data;
    }
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

export interface PmProjectNavItem {
  /** pm_activos.id_activo — segmento de /dashboard/pm/proyecto/[id]. */
  idActivo: string;
  nombre: string | null;
  /**
   * project.code del proyecto de Actas vinculado (project.pm_activo_id), o
   * null si el activo no tiene actas. Resalta el proyecto en la nav cuando se
   * entra por la URL heredada /dashboard/pm/actas/<code> (la canónica,
   * /dashboard/pm/proyecto/<id>/actas, ya cuelga del propio proyecto).
   */
  actasCode: string | null;
}

/**
 * Lista ligera de proyectos activos para la fila secundaria de la nav.
 * En error devuelve []: la nav degrada a solo las entradas estáticas.
 */
export async function fetchPmProjectNavItems(
  ctx: UserContext,
): Promise<PmProjectNavItem[]> {
  const supabase = await getPmReadSupabase(ctx);
  const { data, error } = await supabase
    .from("pm_activos")
    .select("id_activo, nombre_display, project(code, archived_at)")
    .is("archivado_at", null)
    .order("id_activo");
  if (error || !data) return [];

  return data.map((row) => {
    // El embed inverso por project.pm_activo_id llega como array (FK no única).
    const linked = (Array.isArray(row.project) ? row.project : [row.project])
      .filter(Boolean)
      .find((p) => !p.archived_at);
    return {
      idActivo: row.id_activo as string,
      nombre: (row.nombre_display as string | null) ?? null,
      actasCode: linked?.code ?? null,
    };
  });
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
  //
  // soloIdActivo va TRAS el spread para que ningún caller lo pise: es lo que
  // evita descargar el portfolio entero para pintar un proyecto.
  const { rows, error } = await fetchPmPortfolio(ctx, {
    incluirActivosArchivados: true,
    incluirHitosArchivados: false,
    ...options,
    soloIdActivo: decoded,
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
