import type { SupabaseClient } from "@supabase/supabase-js";

export const MAX_ELEMENT_NAME_LEN = 200;

export function normalizeElementName(name: string): string {
  return name.trim().slice(0, MAX_ELEMENT_NAME_LEN);
}

export async function assertUniqueElementNameInCategory(
  client: SupabaseClient,
  params: {
    categoryId: string;
    parentElementId: string | null;
    name: string;
    excludeElementId?: string;
  },
): Promise<{ ok: true } | { ok: false; error: string }> {
  const nameLower = params.name.trim().toLowerCase();
  if (!nameLower) {
    return { ok: false, error: "El nombre es obligatorio" };
  }

  let siblingQuery = client
    .from("element")
    .select("id, name")
    .eq("category_id", params.categoryId)
    .is("archived_at", null);

  siblingQuery = params.parentElementId
    ? siblingQuery.eq("parent_element_id", params.parentElementId)
    : siblingQuery.is("parent_element_id", null);

  const { data: siblings, error } = await siblingQuery;
  if (error) {
    return { ok: false, error: error.message };
  }

  const duplicate = (siblings ?? []).some((row) => {
    if (
      params.excludeElementId &&
      (row.id as string) === params.excludeElementId
    ) {
      return false;
    }
    return (row.name as string).trim().toLowerCase() === nameLower;
  });

  if (duplicate) {
    return {
      ok: false,
      error: "Ya existe un elemento con ese nombre en esta categoría",
    };
  }

  return { ok: true };
}
