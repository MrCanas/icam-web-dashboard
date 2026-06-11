"use server";

import { requireCurrentUser } from "@/lib/auth/currentUser";
import { checkWriteAccess } from "@/lib/auth/permissions";
import { getActasAuthenticatedSupabase } from "@/modules/pm/actas/data/authenticatedClient";
import {
  assertUniqueElementNameInCategory,
  normalizeElementName,
} from "@/modules/pm/actas/logic/element-name-validation";

export type UpdateElementNameInput = {
  elementId: string;
  name: string;
};

export type UpdateElementNameResult =
  | { ok: true; name: string }
  | { ok: false; error: string };

export async function updateElementName(
  input: UpdateElementNameInput,
): Promise<UpdateElementNameResult> {
  const name = normalizeElementName(input.name);
  if (!name) {
    return { ok: false, error: "El nombre es obligatorio" };
  }

  const elementId = input.elementId.trim();
  if (!elementId) {
    return { ok: false, error: "elementId requerido" };
  }

  const user = await requireCurrentUser();
  const writeDenied = checkWriteAccess(user, "pm");
  if (writeDenied) return { ok: false, error: writeDenied };

  const { client, error: clientError } = await getActasAuthenticatedSupabase();
  if (!client) {
    return { ok: false, error: clientError };
  }

  const { data: element, error: fetchError } = await client
    .from("element")
    .select("id, category_id, parent_element_id, name")
    .eq("id", elementId)
    .is("archived_at", null)
    .maybeSingle();

  if (fetchError) {
    return { ok: false, error: fetchError.message };
  }
  if (!element) {
    return {
      ok: false,
      error: "Elemento no encontrado o sin acceso al proyecto",
    };
  }

  const categoryId = element.category_id as string;
  const parentElementId =
    (element.parent_element_id as string | null) ?? null;

  if ((element.name as string).trim() === name) {
    return { ok: true, name };
  }

  const unique = await assertUniqueElementNameInCategory(client, {
    categoryId,
    parentElementId,
    name,
    excludeElementId: elementId,
  });
  if (!unique.ok) {
    return { ok: false, error: unique.error };
  }

  const { error: updateError } = await client
    .from("element")
    .update({ name })
    .eq("id", elementId);

  if (updateError) {
    return { ok: false, error: updateError.message };
  }

  return { ok: true, name };
}
