"use server";

import { requireAdminContext } from "@/modules/admin/data/adminGuard";
import { listAdminUsers } from "@/modules/admin/data/adminUsersRepository";
import type { AdminResult, AdminUserRow } from "@/modules/admin/types";

export async function listAdminUsersAction(): Promise<
  AdminResult<AdminUserRow[]>
> {
  const guard = await requireAdminContext();
  if (!guard.ok) return { ok: false, error: guard.error };

  try {
    return { ok: true, data: await listAdminUsers() };
  } catch (err) {
    console.error("[listAdminUsersAction]", err);
    return { ok: false, error: "No se pudo cargar la lista de usuarios." };
  }
}
