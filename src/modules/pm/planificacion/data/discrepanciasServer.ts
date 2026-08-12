import type { SupabaseClient } from "@supabase/supabase-js";

import { isMissingTableError } from "@/lib/db/pgErrors";
import {
  contarPendientes,
  type ResolucionFoto,
} from "@/modules/pm/planificacion/logic/discrepancias";

/**
 * Cuenta en servidor las discrepancias pendientes de un activo × trimestre,
 * con los mismos criterios que la rejilla (lógica pura compartida). La usan
 * toggleSnapshotPublicado (gate) y resolverDiscrepancia (autopublicación):
 * ninguna de las dos confía en cuentas del cliente.
 */
export async function contarDiscrepanciasPendientes(
  client: SupabaseClient,
  activoId: string,
  snapshotCode: string,
  proyectoFinanciero: string,
): Promise<{ pendientes: number; error: string | null }> {
  const { data: hitos, error: eHitos } = await client
    .from("pm_hitos")
    .select("id, catalogo_id")
    .eq("activo_id", activoId)
    .is("archivado_at", null);
  if (eHitos) return { pendientes: 0, error: eHitos.message };
  const ids = (hitos ?? []).map((h) => h.id as string);
  if (ids.length === 0) return { pendientes: 0, error: null };

  const [cat, fechasSnap, linea, res] = await Promise.all([
    client.from("pm_hito_catalogo").select("id, tabla_madre_columna"),
    client
      .from("pm_snapshot_fechas")
      .select("hito_id, fecha")
      .eq("snapshot_code", snapshotCode)
      .in("hito_id", ids),
    client
      .from("maestro_hito_fechas")
      .select("columna, fecha")
      .eq("proyecto", proyectoFinanciero)
      .eq("trimestre_code", snapshotCode),
    client
      .from("pm_snapshot_validacion")
      .select("hito_id, fecha_elegida, fecha_maestro")
      .eq("snapshot_code", snapshotCode)
      .in("hito_id", ids),
  ]);
  // La 026 puede no estar aplicada aunque la 024 sí: sin tabla de resoluciones
  // se cuenta como si no hubiera ninguna. Cualquier otro error sí es fatal.
  const resolucionesRows = res.error && isMissingTableError(res.error) ? [] : (res.data ?? []);
  const err =
    cat.error ??
    fechasSnap.error ??
    linea.error ??
    (res.error && !isMissingTableError(res.error) ? res.error : null);
  if (err) return { pendientes: 0, error: err.message };

  const colPorCatalogo = new Map(
    (cat.data ?? []).map((c) => [c.id as string, c.tabla_madre_columna as string | null]),
  );
  const fechaPorHito = new Map(
    (fechasSnap.data ?? []).map((f) => [f.hito_id as string, f.fecha as string | null]),
  );
  const resoluciones = new Map<string, ResolucionFoto>(
    resolucionesRows.map((r) => [
      r.hito_id as string,
      {
        fecha_elegida: r.fecha_elegida as string | null,
        fecha_maestro: r.fecha_maestro as string | null,
      },
    ]),
  );

  const pendientes = contarPendientes(
    (hitos ?? []).map((h) => ({
      id: h.id as string,
      catalogoColumna: h.catalogo_id
        ? (colPorCatalogo.get(h.catalogo_id as string) ?? null)
        : null,
      fechaOficial: fechaPorHito.get(h.id as string) ?? null,
    })),
    (linea.data ?? []) as { columna: string; fecha: string | null }[],
    resoluciones,
  );

  return { pendientes, error: null };
}
