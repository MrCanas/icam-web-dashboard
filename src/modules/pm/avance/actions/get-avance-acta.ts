"use server";

import { getCurrentUser } from "@/lib/auth/currentUser";
import { canAccessRouteKey, getUserRole } from "@/lib/auth/permissions";
import {
  fetchAvanceObraActa,
  type AvanceActaResult,
} from "@/modules/pm/avance/data/avanceRepository";

const DATE_YMD = /^\d{4}-\d{2}-\d{2}$/;

export interface GetAvanceActaInput {
  idActivo: string;
  dateFrom: string;
  dateTo: string;
}

export type GetAvanceActaResult =
  | { ok: false; error: string }
  /** El usuario tiene denegado Avance de obra: el acta no pinta la sección. */
  | { ok: true; oculto: true }
  | { ok: true; oculto: false; resultado: AvanceActaResult; hasWriteAccess: boolean };

/** Carga la sección «Avance de obra» de la vista Acta para su rango de fechas. */
export async function getAvanceActa(input: GetAvanceActaInput): Promise<GetAvanceActaResult> {
  const idActivo = input.idActivo?.trim();
  if (!idActivo) return { ok: false, error: "idActivo requerido" };
  if (!DATE_YMD.test(input.dateFrom) || !DATE_YMD.test(input.dateTo)) {
    return { ok: false, error: "Las fechas deben ser YYYY-MM-DD" };
  }

  const ctx = await getCurrentUser();
  if (!ctx) return { ok: false, error: "No autorizado" };
  if (!canAccessRouteKey(ctx, "pm.avance_obra")) return { ok: true, oculto: true };

  const resultado = await fetchAvanceObraActa(ctx, idActivo, input.dateFrom, input.dateTo);
  const rol = getUserRole(ctx, "pm");
  return {
    ok: true,
    oculto: false,
    resultado,
    hasWriteAccess: rol === "admin" || rol === "editor",
  };
}
