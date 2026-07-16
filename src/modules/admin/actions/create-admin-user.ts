"use server";

import { revalidatePath } from "next/cache";

import { resolveAuthUserIdByEmail } from "@/lib/auth/resolve-auth-user";
import { requireAdminContext } from "@/modules/admin/data/adminGuard";
import { createAdminUser } from "@/modules/admin/data/adminUsersRepository";
import {
  normalizeEmail,
  sanitizeRouteDenies,
  validateEmail,
  validateName,
  validatePassword,
  validateZoneAssignment,
} from "@/modules/admin/logic/validate-user-input";
import type { AdminResult, UserPermissionsInput } from "@/modules/admin/types";

export interface CreateAdminUserInput extends UserPermissionsInput {
  email: string;
  name: string;
  password: string;
}

export async function createAdminUserAction(
  input: CreateAdminUserInput,
): Promise<AdminResult<{ userId: string }>> {
  const guard = await requireAdminContext();
  if (!guard.ok) return { ok: false, error: guard.error };

  const email = normalizeEmail(input.email ?? "");
  const name = (input.name ?? "").trim();
  const password = input.password ?? "";

  const emailError = validateEmail(email);
  if (emailError) return { ok: false, error: emailError };

  const nameError = validateName(name);
  if (nameError) return { ok: false, error: nameError };

  const passwordError = validatePassword(password);
  if (passwordError) return { ok: false, error: passwordError };

  const zones = validateZoneAssignment(input.zones);
  if (!zones) return { ok: false, error: "Permisos de zona no válidos." };

  const deniedRouteKeys = sanitizeRouteDenies(input.deniedRouteKeys, zones);

  try {
    const existing = await resolveAuthUserIdByEmail(email);
    if (existing) {
      return { ok: false, error: "Ya existe un usuario con este email." };
    }

    const { userId } = await createAdminUser({
      email,
      name,
      password,
      zones,
      deniedRouteKeys,
      createdBy: guard.ctx.id,
    });

    revalidatePath("/dashboard/admin/usuarios");
    return { ok: true, data: { userId } };
  } catch (err) {
    console.error("[createAdminUserAction]", err);
    const message =
      err instanceof Error ? err.message : "No se pudo crear el usuario.";
    return { ok: false, error: message };
  }
}
