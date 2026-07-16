import type { UserContext } from "@/lib/auth/currentUser";
import { withAudit } from "@/lib/audit/withAudit";
import type { PmActivo, PmHito, PmSnapshotFecha } from "@/modules/pm/types";
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

export async function fetchPmPortfolio(ctx: UserContext): Promise<{
  rows: PmPortfolioRow[];
  snapshotCodes: string[];
  error: string | null;
}> {
  const supabase = await getPmReadSupabase(ctx);
  const [{ data: activos, error: e1 }, { data: hitos, error: e2 }, { data: snaps, error: e3 }] =
    await Promise.all([
      supabase.from("pm_activos").select("*").order("id_activo"),
      supabase.from("pm_hitos").select("*").order("orden_hito"),
      supabase.from("pm_snapshot_fechas").select("*"),
    ]);

  const err = e1?.message ?? e2?.message ?? e3?.message ?? null;
  if (err) {
    return { rows: [], snapshotCodes: [], error: err };
  }

  const snapByHito = new Map<string, Record<string, string | null>>();
  const codes = new Set<string>();
  for (const s of snaps ?? []) {
    const row = s as PmSnapshotFecha;
    codes.add(row.snapshot_code);
    if (!snapByHito.has(row.hito_id)) snapByHito.set(row.hito_id, {});
    snapByHito.get(row.hito_id)![row.snapshot_code] = row.fecha;
  }

  const sortedCodes = [...codes].sort();

  const hitosByActivo = new Map<string, PmHitoEnriched[]>();
  for (const h of hitos ?? []) {
    const hito = h as PmHito;
    const enriched: PmHitoEnriched = {
      ...hito,
      snapshots: snapByHito.get(hito.id) ?? {},
    };
    const list = hitosByActivo.get(hito.activo_id) ?? [];
    list.push(enriched);
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

  const rows: PmPortfolioRow[] = (activos ?? []).map((a) => {
    const activo = a as PmActivo;
    const list = hitosByActivo.get(activo.id) ?? [];
    list.sort((x, y) => x.orden_hito - y.orden_hito);
    return { activo, hitos: list };
  });

  return { rows, snapshotCodes: sortedCodes, error: null };
}

export async function fetchPmActivoBySlug(
  ctx: UserContext,
  idActivo: string,
): Promise<{ row: PmPortfolioRow | null; error: string | null }> {
  const supabase = await getPmReadSupabase(ctx);
  const decoded = decodeURIComponent(idActivo);
  const { data: activo, error: e1 } = await supabase
    .from("pm_activos")
    .select("*")
    .eq("id_activo", decoded)
    .maybeSingle();

  if (e1?.message) return { row: null, error: e1.message };
  if (!activo) return { row: null, error: null };

  const { rows, error } = await fetchPmPortfolio(ctx);
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
