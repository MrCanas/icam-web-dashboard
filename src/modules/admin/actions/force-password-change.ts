"use server";

import { revalidatePath } from "next/cache";

import { requireAdminContext } from "@/modules/admin/data/adminGuard";
import { markAllUsersMustChangePassword } from "@/modules/admin/data/adminUsersRepository";
import type { AdminResult } from "@/modules/admin/types";

/**
 * Obliga a todos los usuarios (el admin que lo lanza incluido) a cambiar la
 * contraseña en su siguiente acceso. No cierra sesiones: el layout de
 * /dashboard redirige a /cambiar-contrasena en la próxima página que abran.
 */
export async function forcePasswordChangeAllAction(): Promise<
  AdminResult<{ count: number }>
> {
  const guard = await requireAdminContext();
  if (!guard.ok) return { ok: false, error: guard.error };

  try {
    const count = await markAllUsersMustChangePassword();
    revalidatePath("/dashboard/admin/usuarios");
    return { ok: true, data: { count } };
  } catch (err) {
    console.error("[forcePasswordChangeAllAction]", err);
    return { ok: false, error: "No se pudo forzar el cambio de contraseña." };
  }
}
