import type { SupabaseClient } from "@supabase/supabase-js";
import type { PmActivo, PmHito, PmSnapshotFecha } from "@/lib/types-pm";

export interface PmHitoEnriched extends PmHito {
  snapshots: Record<string, string | null>;
}

export interface PmPortfolioRow {
  activo: PmActivo;
  hitos: PmHitoEnriched[];
}

/** Carga activos, hitos y fechas de snapshot en memoria agrupadas por hito. */
export async function fetchPmPortfolio(supabase: SupabaseClient): Promise<{
  rows: PmPortfolioRow[];
  snapshotCodes: string[];
  error: string | null;
}> {
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

  const rows: PmPortfolioRow[] = (activos ?? []).map((a) => {
    const activo = a as PmActivo;
    const list = hitosByActivo.get(activo.id) ?? [];
    list.sort((x, y) => x.orden_hito - y.orden_hito);
    return { activo, hitos: list };
  });

  return { rows, snapshotCodes: sortedCodes, error: null };
}

export async function fetchPmActivoBySlug(
  supabase: SupabaseClient,
  idActivo: string,
): Promise<{ row: PmPortfolioRow | null; error: string | null }> {
  const decoded = decodeURIComponent(idActivo);
  const { data: activo, error: e1 } = await supabase
    .from("pm_activos")
    .select("*")
    .eq("id_activo", decoded)
    .maybeSingle();

  if (e1?.message) return { row: null, error: e1.message };
  if (!activo) return { row: null, error: null };

  const { rows, error } = await fetchPmPortfolio(supabase);
  if (error) return { row: null, error };
  const row = rows.find((r) => r.activo.id_activo === decoded) ?? null;
  return { row, error: null };
}
