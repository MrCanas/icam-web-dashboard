"use server";

import { requireCurrentUser } from "@/lib/auth/currentUser";
import { checkWriteAccess } from "@/lib/auth/permissions";
import { getActasAuthenticatedSupabase } from "@/modules/pm/actas/data/authenticatedClient";
import { formatCategoryDisplayName } from "@/modules/pm/actas/logic/actas-category-display";
import {
  assertUniqueCategoryNameInProject,
  normalizeCategoryName,
} from "@/modules/pm/actas/logic/category-name-validation";

export type UpdateCategoryNameInput = {
  categoryId: string;
  name: string;
};

export type UpdateCategoryNameResult =
  | { ok: true; name: string; displayName: string }
  | { ok: false; error: string };

export async function updateCategoryName(
  input: UpdateCategoryNameInput,
): Promise<UpdateCategoryNameResult> {
  const name = normalizeCategoryName(input.name);
  if (!name) {
    return { ok: false, error: "El nombre es obligatorio" };
  }

  const categoryId = input.categoryId.trim();
  if (!categoryId) {
    return { ok: false, error: "categoryId requerido" };
  }

  const user = await requireCurrentUser();
  const writeDenied = checkWriteAccess(user, "pm");
  if (writeDenied) return { ok: false, error: writeDenied };

  const { client, error: clientError } = await getActasAuthenticatedSupabase();
  if (!client) {
    return { ok: false, error: clientError };
  }

  const { data: category, error: fetchError } = await client
    .from("category")
    .select("id, project_id, name, sublot_label")
    .eq("id", categoryId)
    .is("archived_at", null)
    .maybeSingle();

  if (fetchError) {
    return { ok: false, error: fetchError.message };
  }
  if (!category) {
    return {
      ok: false,
      error: "Categoría no encontrada o sin acceso al proyecto",
    };
  }

  const projectId = category.project_id as string;
  const sublotLabel = (category.sublot_label as string | null) ?? null;

  if ((category.name as string).trim() === name) {
    return {
      ok: true,
      name,
      displayName: formatCategoryDisplayName(name, sublotLabel),
    };
  }

  const unique = await assertUniqueCategoryNameInProject(client, {
    projectId,
    name,
    excludeCategoryId: categoryId,
  });
  if (!unique.ok) {
    return { ok: false, error: unique.error };
  }

  const { error: updateError } = await client
    .from("category")
    .update({ name })
    .eq("id", categoryId);

  if (updateError) {
    return { ok: false, error: updateError.message };
  }

  return {
    ok: true,
    name,
    displayName: formatCategoryDisplayName(name, sublotLabel),
  };
}
