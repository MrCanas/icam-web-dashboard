"use server";

import { revalidatePath } from "next/cache";

import { withAudit } from "@/lib/audit/withAudit";
import { requirePmWriteSupabase } from "@/modules/pm/planificacion/data/writeClient";
import { validateUuid } from "@/modules/pm/planificacion/logic/planificacion-validation";
import { validatePorcentaje } from "@/modules/pm/avance/logic/avance-obra";
import {
  AVANCE_OBRA_HUB_PATH,
  AVANCE_OBRA_ROUTE_PATTERN,
} from "@/modules/pm/avance/logic/avance-paths";

export interface UpdateAvanceFaseInput {
  promocionId: string;
  faseId: string;
  /** Número, o null/"" para dejar la fase sin dato (que no es lo mismo que 0). */
  porcentaje: number | string | null;
}

export type UpdateAvanceFaseResult =
  | { ok: true; porcentaje: number | null; pendiente: boolean; cambiado: boolean }
  | { ok: false; error: string };

/**
 * Edita el porcentaje de una fase de obra.
 *
 * Las tres escrituras (valor vigente, histórico y bandeja de salida hacia Zoho)
 * van dentro de `pm_avance_registrar_cambio`: PostgREST no da transacciones y
 * hacerlas por separado dejaría un histórico sin su cambio, o un cambio sin su
 * entrada en la bandeja. Además ahorra dos viajes de red desde Vercel.
 *
 * NADA SE ENVÍA A ZOHO aquí: el cambio queda pendiente de aprobación.
 */
export async function updateAvanceFase(
  input: UpdateAvanceFaseInput,
): Promise<UpdateAvanceFaseResult> {
  const promocion = validateUuid(input.promocionId, "promocionId");
  if (!promocion.ok) return { ok: false, error: promocion.error };

  const fase = validateUuid(input.faseId, "faseId");
  if (!fase.ok) return { ok: false, error: fase.error };

  const porcentaje = validatePorcentaje(input.porcentaje);
  if (!porcentaje.ok) return { ok: false, error: porcentaje.error };

  const auth = await requirePmWriteSupabase();
  if (!auth.ok) return { ok: false, error: auth.error };
  const { client, user } = auth;

  const { data, error } = await withAudit(
    user,
    "pm.avance_obra.update",
    {
      resourceType: "pm_avance_obra",
      resourceId: `${promocion.value}:${fase.value}`,
      payload: { porcentaje: porcentaje.value },
    },
    async () =>
      await client.rpc("pm_avance_registrar_cambio", {
        p_promocion_id: promocion.value,
        p_fase_id: fase.value,
        p_porcentaje: porcentaje.value,
        p_usuario_id: user.id,
        p_usuario_email: user.email,
      }),
  );

  if (error) return { ok: false, error: error.message };

  const res = (data ?? {}) as {
    cambiado?: boolean;
    porcentaje?: number | string | null;
    pendiente?: boolean;
  };

  revalidatePath(AVANCE_OBRA_ROUTE_PATTERN, "page");
  revalidatePath(AVANCE_OBRA_HUB_PATH);

  return {
    ok: true,
    porcentaje: porcentaje.value,
    pendiente: res.pendiente ?? false,
    cambiado: res.cambiado ?? false,
  };
}
