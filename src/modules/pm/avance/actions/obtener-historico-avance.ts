"use server";

import { requireCurrentUser } from "@/lib/auth/currentUser";
import { canAccessRouteKey } from "@/lib/auth/permissions";
import {
  fetchAvanceHistorico,
  type AvanceHistoricoResult,
} from "@/modules/pm/avance/data/avanceRepository";
import { validateUuid } from "@/modules/pm/planificacion/logic/planificacion-validation";

/**
 * Histórico de cambios de avance de una promoción, bajo demanda: el Operativo
 * de actas no lo trae en la carga porque su panel empieza plegado.
 *
 * Lee con service role, así que exige el mismo permiso que la página de avance.
 */
export async function obtenerHistoricoAvance(
  promocionId: string,
): Promise<AvanceHistoricoResult> {
  const ctx = await requireCurrentUser();
  if (!canAccessRouteKey(ctx, "pm.avance_obra")) {
    return { filas: [], error: "Sin acceso a Avance de obra" };
  }
  const id = validateUuid(promocionId, "promocionId");
  if (!id.ok) return { filas: [], error: id.error };
  return fetchAvanceHistorico(ctx, id.value);
}
