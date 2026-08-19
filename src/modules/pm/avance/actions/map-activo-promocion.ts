"use server";

import { revalidatePath } from "next/cache";

import { withAudit } from "@/lib/audit/withAudit";
import { requirePmWriteSupabase } from "@/modules/pm/planificacion/data/writeClient";
import { validateUuid } from "@/modules/pm/planificacion/logic/planificacion-validation";
import {
  AVANCE_OBRA_HUB_PATH,
  AVANCE_OBRA_ROUTE_PATTERN,
} from "@/modules/pm/avance/logic/avance-paths";

export interface MapActivoPromocionInput {
  pmActivoId: string;
  /** id de pm_promociones, o null para deshacer el emparejamiento. */
  promocionId: string | null;
}

export type MapActivoPromocionResult =
  | { ok: true; promocionId: string | null }
  | { ok: false; error: string };

/**
 * Empareja un activo de PM con su promoción de Zoho.
 *
 * Los códigos no coinciden entre sistemas (PM `DC-15` ↔ Zoho `DC15`,
 * PM `SA-33-31` ↔ Zoho `SA31`) y hay 30 promociones para 9 activos, así que el
 * emparejamiento no se puede inferir: 4 casos vienen sembrados desde una lista
 * escrita a mano y el resto los decide la PMO aquí.
 *
 * Varios activos pueden apuntar a la misma promoción, igual que en
 * pm_activo_proyecto_map: PM separa PC25 por uso.
 */
export async function mapActivoPromocion(
  input: MapActivoPromocionInput,
): Promise<MapActivoPromocionResult> {
  const activo = validateUuid(input.pmActivoId, "pmActivoId");
  if (!activo.ok) return { ok: false, error: activo.error };

  const auth = await requirePmWriteSupabase();
  if (!auth.ok) return { ok: false, error: auth.error };
  const { client, user } = auth;

  const revalida = () => {
    revalidatePath("/dashboard/pm/proyectos");
    revalidatePath(AVANCE_OBRA_ROUTE_PATTERN, "page");
    revalidatePath(AVANCE_OBRA_HUB_PATH);
  };

  if (!input.promocionId) {
    const { error } = await withAudit(
      user,
      "pm.avance_obra.desmapear",
      { resourceType: "pm_activo_promocion_map", resourceId: activo.value },
      async () =>
        await client.from("pm_activo_promocion_map").delete().eq("pm_activo_id", activo.value),
    );
    if (error) return { ok: false, error: error.message };
    revalida();
    return { ok: true, promocionId: null };
  }

  const promocion = validateUuid(input.promocionId, "promocionId");
  if (!promocion.ok) return { ok: false, error: promocion.error };

  // El desplegable se alimenta de pm_promociones, pero se revalida aquí: la FK
  // protege de un id inventado y este mensaje explica el caso real (se ha
  // reimportado el export y la promoción ya no está).
  const { data: existe, error: eSel } = await client
    .from("pm_promociones")
    .select("codigo_promocion")
    .eq("id", promocion.value)
    .maybeSingle();

  if (eSel) return { ok: false, error: eSel.message };
  if (!existe) {
    return {
      ok: false,
      error: "Esa promoción ya no existe. Recarga la página si acabas de reimportar el export de Zoho.",
    };
  }

  const { error } = await withAudit(
    user,
    "pm.avance_obra.mapear",
    {
      resourceType: "pm_activo_promocion_map",
      resourceId: activo.value,
      payload: { promocionId: promocion.value },
    },
    async () =>
      await client.from("pm_activo_promocion_map").upsert({
        pm_activo_id: activo.value,
        promocion_id: promocion.value,
        origen: "manual",
        mapeado_por: user.email,
        mapeado_at: new Date().toISOString(),
      }),
  );

  if (error) return { ok: false, error: error.message };
  revalida();
  return { ok: true, promocionId: promocion.value };
}
