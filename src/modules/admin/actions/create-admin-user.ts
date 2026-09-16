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
import { RUTAS_DENEGADAS_POR_DEFECTO } from "@/registry/routes";

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

  // Las rutas marcadas `deniedByDefault` se deniegan siempre al crear, aunque el
  // formulario no las traiga. Sin esto, el modelo de denylist las abriría solas:
  // la migración que introduce una página sensible siembra las denegaciones de
  // los usuarios que existían ese día, y el siguiente que se dé de alta entraría
  // viendo lo que a todos los demás se les ha negado.
  //
  // Se añaden DESPUÉS de `sanitizeRouteDenies` y sin filtrar por zona concedida
  // a propósito: una denegación de una zona que el usuario no tiene es
  // inofensiva, pero es justo la que hace falta el día que se le conceda.
  const deniedRouteKeys = [
    ...new Set([
      ...sanitizeRouteDenies(input.deniedRouteKeys, zones),
      ...RUTAS_DENEGADAS_POR_DEFECTO,
    ]),
  ];

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
