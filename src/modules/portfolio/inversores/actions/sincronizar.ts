"use server";

import { revalidatePath } from "next/cache";

import { withAudit } from "@/lib/audit/withAudit";
import { getCurrentUser } from "@/lib/auth/currentUser";
import { canAccessRouteKey, checkWriteAccess } from "@/lib/auth/permissions";
import { sincronizarInversores } from "@/modules/portfolio/inversores/logic/inversoresSync";
import {
  INVERSORES_PATH,
  INVERSORES_ROUTE_KEY,
} from "@/modules/portfolio/inversores/logic/paths";

export interface ResultadoAccion {
  ok: boolean;
  mensaje: string;
}

/**
 * «Sincronizar ahora»: trae de Zoho lo que el cron traería esta noche.
 *
 * Dos cortes y no uno. La zona `financiero` la tiene mucha gente, así que el
 * rol de escritura por sí solo no dice nada aquí: hay que comprobar además que
 * a esta persona no se le ha denegado la pestaña. Las Server Actions son
 * alcanzables por POST directo, no solo desde el botón.
 *
 * Nunca lanza: devuelve el resultado y la página lo pinta.
 */
export async function sincronizarInversoresAction(): Promise<ResultadoAccion> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, mensaje: "Sesión no válida." };

  if (!canAccessRouteKey(user, INVERSORES_ROUTE_KEY)) {
    return { ok: false, mensaje: "Sin acceso a Inversores." };
  }
  const sinEscritura = checkWriteAccess(user, "financiero");
  if (sinEscritura) return { ok: false, mensaje: sinEscritura };

  const resultado = await withAudit(
    user,
    "portfolio.inversores.sync",
    { resourceType: "inv_cuentas", payload: { origen: "manual" } },
    () => sincronizarInversores(user, { origen: "manual" }),
  );

  if (!resultado.ok) return { ok: false, mensaje: resultado.error };

  revalidatePath(INVERSORES_PATH);

  const leidos = resultado.modulos.reduce((acc, m) => acc + m.leidos, 0);
  const fallidos = resultado.modulos.filter((m) => m.error);

  if (resultado.estado === "parcial") {
    return {
      ok: false,
      mensaje:
        `Sincronización parcial: ${fallidos.map((m) => m.modulo).join(", ")} falló. ` +
        `El resto está al día (${leidos} registros).`,
    };
  }
  return { ok: true, mensaje: `Sincronizados ${leidos} registros de Zoho.` };
}
