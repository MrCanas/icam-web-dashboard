import type { SupabaseClient } from "@supabase/supabase-js";

export const MAX_CATEGORY_NAME_LEN = 200;

export function normalizeCategoryName(name: string): string {
  return name.trim().slice(0, MAX_CATEGORY_NAME_LEN);
}

export async function assertUniqueCategoryNameInProject(
  client: SupabaseClient,
  params: {
    projectId: string;
    name: string;
    excludeCategoryId?: string;
  },
): Promise<{ ok: true } | { ok: false; error: string }> {
  const nameLower = params.name.trim().toLowerCase();
  if (!nameLower) {
    return { ok: false, error: "El nombre es obligatorio" };
  }

  const { data: categories, error } = await client
    .from("category")
    .select("id, name")
    .eq("project_id", params.projectId)
    .is("archived_at", null);

  if (error) {
    return { ok: false, error: error.message };
  }

  const duplicate = (categories ?? []).some((row) => {
    if (
      params.excludeCategoryId &&
      (row.id as string) === params.excludeCategoryId
    ) {
      return false;
    }
    return (row.name as string).trim().toLowerCase() === nameLower;
  });

  if (duplicate) {
    return {
      ok: false,
      error: "Ya existe un grupo con ese nombre en este proyecto",
    };
  }

  return { ok: true };
}
