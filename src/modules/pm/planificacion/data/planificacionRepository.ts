import type { UserContext } from "@/lib/auth/currentUser";
import { isMissingTableError } from "@/lib/db/pgErrors";
import { getPmReadSupabase } from "@/modules/pm/data/readClient";
import {
  fetchPmPortfolio,
  type PmPortfolioRow,
} from "@/modules/pm/data/pmRepository";
import type {
  MaestroHitoFechaRow,
  PmActivoProyectoMap,
  PmActivoSnapshot,
  PmHitoCatalogo,
  PmSnapshot,
  PmSnapshotValidacion,
} from "@/modules/pm/types";

export interface PlanificacionBoardData {
  rows: PmPortfolioRow[];
  catalogo: PmHitoCatalogo[];
  snapshots: PmSnapshot[];
  /** Excepciones de publicación: `${activoId}|${code}` que la PMO ha retirado. */
  retirados: string[];
  /** pm_activo_id → proyecto_financiero_key (para el gate de publicación). */
  mapeo: Record<string, string>;
  /** Líneas reportadas en el maestro: `${proyecto}|${trimestre_code}`. */
  lineasMaestro: string[];
  /** Fechas de hito de las líneas del maestro (columna «Maestro» y validación). */
  fechasMaestro: MaestroHitoFechaRow[];
  /** Resoluciones de discrepancias (migración 026). */
  resoluciones: PmSnapshotValidacion[];
  /**
   * false = las tablas del maestro (migraciones 024-026) aún no existen. La
   * rejilla funciona como antes de la validación: gate inactivo, sin columnas
   * «Maestro». Nunca es motivo de error: el flujo aplica a futuros trimestres.
   */
  maestroDisponible: boolean;
  error: string | null;
}

/**
 * Todo lo que necesita la rejilla. Reutiliza fetchPmPortfolio a propósito: la
 * rejilla trabaja sobre las MISMAS tablas que el Overview, así que no hay
 * migración de datos ni riesgo de que las dos vistas discrepen.
 *
 * Pide TODO (archivados incluidos, sin filtrar por publicado) porque es la
 * pantalla donde se decide qué se archiva y qué se publica: necesita ver lo que
 * el resto de la app no ve.
 */
export async function fetchPlanificacionBoard(
  ctx: UserContext,
): Promise<PlanificacionBoardData> {
  const supabase = await getPmReadSupabase(ctx);

  const [
    portfolio,
    { data: catalogo, error: eCat },
    { data: snaps, error: eSnap },
    { data: pubs, error: ePub },
    { data: map, error: eMap },
    { data: lineas, error: eLineas },
    { data: fechasMaestro, error: eFechasM },
    { data: resoluciones, error: eRes },
  ] = await Promise.all([
    fetchPmPortfolio(ctx, {
      incluirActivosArchivados: true,
      incluirHitosArchivados: true,
      soloPublicados: false,
    }),
    supabase.from("pm_hito_catalogo").select("*").order("orden_default"),
    supabase.from("pm_snapshots").select("*").order("orden"),
    supabase.from("pm_activo_snapshot").select("*").eq("publicado", false),
    supabase.from("pm_activo_proyecto_map").select("*"),
    supabase.from("maestro_lineas_trimestre").select("proyecto, trimestre_code"),
    supabase
      .from("maestro_hito_fechas")
      .select("proyecto, trimestre_code, columna, fecha, flag"),
    supabase.from("pm_snapshot_validacion").select("*"),
  ]);

  // Las tablas del maestro y de validación son OPCIONALES: si sus migraciones
  // (024-026) no están aplicadas, la rejilla carga igual y el gate queda
  // inactivo. Cualquier otro error suyo sí es fatal.
  const maestroDisponible =
    !isMissingTableError(eLineas) &&
    !isMissingTableError(eFechasM) &&
    !isMissingTableError(eRes);

  const error =
    portfolio.error ??
    eCat?.message ??
    eSnap?.message ??
    ePub?.message ??
    eMap?.message ??
    [eLineas, eFechasM, eRes].find((e) => e && !isMissingTableError(e))?.message ??
    null;
  if (error) {
    return {
      rows: [],
      catalogo: [],
      snapshots: [],
      retirados: [],
      mapeo: {},
      lineasMaestro: [],
      fechasMaestro: [],
      resoluciones: [],
      maestroDisponible: false,
      error,
    };
  }

  const mapeo: Record<string, string> = {};
  for (const m of (map ?? []) as PmActivoProyectoMap[]) {
    mapeo[m.pm_activo_id] = m.proyecto_financiero_key;
  }

  return {
    rows: portfolio.rows,
    catalogo: (catalogo ?? []) as PmHitoCatalogo[],
    snapshots: (snaps ?? []) as PmSnapshot[],
    retirados: ((pubs ?? []) as PmActivoSnapshot[]).map(
      (p) => `${p.activo_id}|${p.snapshot_code}`,
    ),
    mapeo,
    lineasMaestro: maestroDisponible
      ? ((lineas ?? []) as { proyecto: string; trimestre_code: string }[]).map(
          (l) => `${l.proyecto}|${l.trimestre_code}`,
        )
      : [],
    fechasMaestro: maestroDisponible ? ((fechasMaestro ?? []) as MaestroHitoFechaRow[]) : [],
    resoluciones: maestroDisponible ? ((resoluciones ?? []) as PmSnapshotValidacion[]) : [],
    maestroDisponible,
    error: null,
  };
}

/**
 * Metadatos de los snapshots registrados (etiqueta, orden).
 *
 * Ya NO filtra por visible_en_dashboard: publicar es por proyecto desde la 022 y
 * lo resuelve fetchPmPortfolio recortando `h.snapshots`. Aquí solo se necesita
 * el orden y la etiqueta.
 */
export async function fetchSnapshotsRegistrados(
  ctx: UserContext,
): Promise<{ snapshots: PmSnapshot[]; error: string | null }> {
  const supabase = await getPmReadSupabase(ctx);
  const { data, error } = await supabase
    .from("pm_snapshots")
    .select("*")
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
      // Incluye archivados: es la pantalla donde se archivan y se restauran.
      fetchPmPortfolio(ctx, {
        incluirActivosArchivados: true,
        incluirHitosArchivados: true,
        soloPublicados: false,
      }),
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
