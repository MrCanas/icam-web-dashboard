"use server";

import { revalidatePath } from "next/cache";

import { getUserRole } from "@/lib/auth/permissions";
import { withAudit } from "@/lib/audit/withAudit";
import { requirePmWriteSupabase } from "@/modules/pm/planificacion/data/writeClient";
import { validateUuid } from "@/modules/pm/planificacion/logic/planificacion-validation";
import {
  AVANCE_OBRA_HUB_PATH,
  AVANCE_OBRA_ROUTE_PATTERN,
} from "@/modules/pm/avance/logic/avance-paths";

export type OutboxActionResult = { ok: true } | { ok: false; error: string };

const SIN_PERMISO =
  "Solo un administrador de PM puede decidir qué se le comunica a Zoho.";

/**
 * Transiciones de la bandeja de salida hacia Zoho.
 *
 * Aquí NO se envía nada: no hay integración con Zoho (ni credenciales, ni el
 * nombre API del módulo, ni los de los campos). «Aprobar» solo marca el cambio
 * como listo para exportarse; el fichero lo descarga y lo sube una persona.
 *
 * Editar el avance necesita permiso de escritura en PM; decidir qué sale hacia
 * el CRM es una responsabilidad distinta y se reserva al rol admin.
 */
async function transicion(
  outboxId: string,
  accion: "aprobar" | "descartar" | "marcar-exportado",
): Promise<OutboxActionResult> {
  const id = validateUuid(outboxId, "outboxId");
  if (!id.ok) return { ok: false, error: id.error };

  const auth = await requirePmWriteSupabase();
  if (!auth.ok) return { ok: false, error: auth.error };
  const { client, user } = auth;

  if (getUserRole(user, "pm") !== "admin") return { ok: false, error: SIN_PERMISO };

  const ahora = new Date().toISOString();
  const { cambios, estadoPrevio } = {
    aprobar: {
      estadoPrevio: "pendiente",
      cambios: {
        estado: "aprobado",
        aprobado_por: user.id,
        aprobado_por_email: user.email,
        aprobado_at: ahora,
      },
    },
    descartar: {
      estadoPrevio: "pendiente",
      cambios: { estado: "descartado", motivo: `Descartado por ${user.email}` },
    },
    "marcar-exportado": {
      estadoPrevio: "aprobado",
      cambios: { estado: "exportado", exportado_at: ahora },
    },
  }[accion];

  // El filtro por estado previo hace idempotente el doble clic: la segunda
  // llamada no encuentra fila y no reescribe la fecha de aprobación.
  const { data, error } = await withAudit(
    user,
    `pm.avance_obra.${accion}`,
    { resourceType: "pm_avance_zoho_outbox", resourceId: id.value },
    async () =>
      await client
        .from("pm_avance_zoho_outbox")
        .update(cambios)
        .eq("id", id.value)
        .eq("estado", estadoPrevio)
        .select("id"),
  );

  if (error) return { ok: false, error: error.message };
  if (!data || data.length === 0) {
    return {
      ok: false,
      error: `Ese cambio ya no está en «${estadoPrevio}». Recarga la página.`,
    };
  }

  revalidatePath(AVANCE_OBRA_HUB_PATH);
  revalidatePath(AVANCE_OBRA_ROUTE_PATTERN, "page");
  return { ok: true };
}

/** Marca un cambio como listo para exportar. No lo envía a Zoho. */
export async function aprobarCambioOutbox(outboxId: string): Promise<OutboxActionResult> {
  return transicion(outboxId, "aprobar");
}

/**
 * Decide no comunicar un cambio. NO revierte la edición: el valor sigue siendo
 * el que puso la PMO en el portal, simplemente no viaja a Zoho.
 */
export async function descartarCambioOutbox(outboxId: string): Promise<OutboxActionResult> {
  return transicion(outboxId, "descartar");
}

/** Cierra el cambio una vez subido el fichero a Zoho a mano. */
export async function marcarExportadoOutbox(outboxId: string): Promise<OutboxActionResult> {
  return transicion(outboxId, "marcar-exportado");
}
