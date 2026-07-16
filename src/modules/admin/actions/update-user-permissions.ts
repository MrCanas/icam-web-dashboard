"use server";

import { revalidatePath } from "next/cache";

import { requireAdminContext } from "@/modules/admin/data/adminGuard";
import {
  setUserRouteDenies,
  setUserZoneRoles,
} from "@/modules/admin/data/adminUsersRepository";
import {
  sanitizeRouteDenies,
  validateZoneAssignment,
} from "@/modules/admin/logic/validate-user-input";
import type { AdminResult, UserPermissionsInput } from "@/modules/admin/types";

export interface UpdateUserPermissionsInput extends UserPermissionsInput {
  userId: string;
}

export async function updateUserPermissionsAction(
  input: UpdateUserPermissionsInput,
): Promise<AdminResult> {
  const guard = await requireAdminContext();
  if (!guard.ok) return { ok: false, error: guard.error };

  if (!input.userId) {
    return { ok: false, error: "Usuario no válido." };
  }

  const zones = validateZoneAssignment(input.zones);
  if (!zones) return { ok: false, error: "Permisos de zona no válidos." };

  const deniedRouteKeys = sanitizeRouteDenies(input.deniedRouteKeys, zones);

  try {
    await setUserZoneRoles(input.userId, zones);
    await setUserRouteDenies(input.userId, deniedRouteKeys);

    revalidatePath("/dashboard/admin/usuarios");
    return { ok: true, data: undefined };
  } catch (err) {
    console.error("[updateUserPermissionsAction]", err);
    return { ok: false, error: "No se pudieron guardar los permisos." };
  }
}
