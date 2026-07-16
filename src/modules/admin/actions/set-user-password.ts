"use server";

import { requireAdminContext } from "@/modules/admin/data/adminGuard";
import { setUserPassword } from "@/modules/admin/data/adminUsersRepository";
import { validatePassword } from "@/modules/admin/logic/validate-user-input";
import type { AdminResult } from "@/modules/admin/types";

/**
 * Reset de contraseña por un admin. A diferencia de /api/account/password, no
 * pide la contraseña actual: el admin no la conoce.
 */
export async function setUserPasswordAction(input: {
  userId: string;
  newPassword: string;
}): Promise<AdminResult> {
  const guard = await requireAdminContext();
  if (!guard.ok) return { ok: false, error: guard.error };

  if (!input.userId) {
    return { ok: false, error: "Usuario no válido." };
  }

  const passwordError = validatePassword(input.newPassword ?? "");
  if (passwordError) return { ok: false, error: passwordError };

  try {
    await setUserPassword(input.userId, input.newPassword);
    return { ok: true, data: undefined };
  } catch (err) {
    console.error("[setUserPasswordAction]", err);
    return { ok: false, error: "No se pudo cambiar la contraseña." };
  }
}
