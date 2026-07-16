"use server";

import { revalidatePath } from "next/cache";

import { requireAdminContext } from "@/modules/admin/data/adminGuard";
import {
  countActivePlatformAdmins,
  countUserReferences,
  deleteAdminUser,
  getUserAccountFlags,
} from "@/modules/admin/data/adminUsersRepository";
import type { AdminResult } from "@/modules/admin/types";

// Sin `export`: en un módulo "use server" todo lo exportado debe ser una
// función async, y exportar una constante invalida el módulo entero.
const USER_HAS_HISTORY_MESSAGE =
  "Este usuario tiene actividad registrada (entradas de acta, elementos asignados o adjuntos). No se puede eliminar sin romper el histórico: desactívalo en su lugar.";

/**
 * Borrado duro e irreversible de un usuario.
 *
 * Solo funciona con usuarios sin rastro: las FK de log_entry, element_owner,
 * actas_attachment y element_notification son ON DELETE RESTRICT, así que la
 * base de datos protege el histórico aunque este chequeo se quedara corto.
 * Para usuarios con actividad, la vía es desactivar (setUserActiveAction).
 */
export async function deleteAdminUserAction(input: {
  userId: string;
}): Promise<AdminResult> {
  const guard = await requireAdminContext();
  if (!guard.ok) return { ok: false, error: guard.error };

  if (!input.userId) {
    return { ok: false, error: "Usuario no válido." };
  }

  if (input.userId === guard.ctx.id) {
    return { ok: false, error: "No puedes eliminar tu propia cuenta." };
  }

  try {
    const target = await getUserAccountFlags(input.userId);
    if (target.isPlatformAdmin) {
      const remaining = await countActivePlatformAdmins();
      if (remaining <= 1) {
        return {
          ok: false,
          error: "Debe quedar al menos un administrador de plataforma.",
        };
      }
    }

    const references = await countUserReferences(input.userId);
    if (references > 0) {
      return { ok: false, error: USER_HAS_HISTORY_MESSAGE };
    }

    await deleteAdminUser(input.userId);
    revalidatePath("/dashboard/admin/usuarios");
    return { ok: true, data: undefined };
  } catch (err) {
    console.error("[deleteAdminUserAction]", err);
    // Red de seguridad: si el precheck no vio una referencia, la FK RESTRICT
    // aborta el DELETE y el mensaje crudo no le dice nada al admin.
    const raw = err instanceof Error ? err.message.toLowerCase() : "";
    if (raw.includes("foreign key") || raw.includes("violates")) {
      return { ok: false, error: USER_HAS_HISTORY_MESSAGE };
    }
    return { ok: false, error: "No se pudo eliminar el usuario." };
  }
}
