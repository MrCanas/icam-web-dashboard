"use server";

import { revalidatePath } from "next/cache";

import { requireAdminContext } from "@/modules/admin/data/adminGuard";
import {
  countActivePlatformAdmins,
  getUserAccountFlags,
  setUserActive,
} from "@/modules/admin/data/adminUsersRepository";
import type { AdminResult } from "@/modules/admin/types";

/**
 * Baja/alta lógica. No hay borrado: auth.users cascadea las tablas app_*, pero
 * no limpia las referencias de negocio (project.created_by, autores de
 * log_entry...), así que borrar convertiría los históricos en "?".
 */
export async function setUserActiveAction(input: {
  userId: string;
  value: boolean;
}): Promise<AdminResult> {
  const guard = await requireAdminContext();
  if (!guard.ok) return { ok: false, error: guard.error };

  if (!input.userId) {
    return { ok: false, error: "Usuario no válido." };
  }

  if (input.userId === guard.ctx.id) {
    return { ok: false, error: "No puedes desactivar tu propia cuenta." };
  }

  try {
    if (!input.value) {
      const target = await getUserAccountFlags(input.userId);
      if (target.isPlatformAdmin) {
        const remaining = await countActivePlatformAdmins();
        if (remaining <= 1) {
          return {
            ok: false,
            error: "Debe quedar al menos un administrador de plataforma activo.",
          };
        }
      }
    }

    await setUserActive(input.userId, input.value);
    revalidatePath("/dashboard/admin/usuarios");
    return { ok: true, data: undefined };
  } catch (err) {
    console.error("[setUserActiveAction]", err);
    return { ok: false, error: "No se pudo cambiar el estado del usuario." };
  }
}
