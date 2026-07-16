"use server";

import { revalidatePath } from "next/cache";

import { requireAdminContext } from "@/modules/admin/data/adminGuard";
import {
  countActivePlatformAdmins,
  setUserPlatformAdmin,
} from "@/modules/admin/data/adminUsersRepository";
import type { AdminResult } from "@/modules/admin/types";

export async function togglePlatformAdminAction(input: {
  userId: string;
  value: boolean;
}): Promise<AdminResult> {
  const guard = await requireAdminContext();
  if (!guard.ok) return { ok: false, error: guard.error };

  if (!input.userId) {
    return { ok: false, error: "Usuario no válido." };
  }

  if (input.userId === guard.ctx.id) {
    return {
      ok: false,
      error: "No puedes cambiar tu propio rol de administrador.",
    };
  }

  try {
    if (!input.value) {
      // No es atómico, pero la ventana es de milisegundos y el script
      // `npm run auth:platform-admin` es la salida si alguien queda fuera.
      const remaining = await countActivePlatformAdmins();
      if (remaining <= 1) {
        return {
          ok: false,
          error: "Debe quedar al menos un administrador de plataforma.",
        };
      }
    }

    await setUserPlatformAdmin(input.userId, input.value);
    revalidatePath("/dashboard/admin/usuarios");
    return { ok: true, data: undefined };
  } catch (err) {
    console.error("[togglePlatformAdminAction]", err);
    return { ok: false, error: "No se pudo cambiar el rol de administrador." };
  }
}
