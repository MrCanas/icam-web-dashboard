"use server";

import { revalidatePath } from "next/cache";

import { requireActasWriteSupabase } from "@/modules/pm/actas/data/writeClient";
import { assertUniqueElementNameInCategory } from "@/modules/pm/actas/logic/element-name-validation";

export type CreateElementInput = {
  categoryId: string;
  name: string;
  parentElementId?: string | null;
};

export type CreateElementResult =
  | { ok: true; elementId: string }
  | { ok: false; error: string };

const MAX_NAME_LEN = 200;

function normalizeName(name: string): string {
  return name.trim().slice(0, MAX_NAME_LEN);
}

export async function createElement(
  input: CreateElementInput,
): Promise<CreateElementResult> {
  const name = normalizeName(input.name);
  if (!name) {
    return { ok: false, error: "El nombre es obligatorio" };
  }

  const categoryId = input.categoryId.trim();
  if (!categoryId) {
    return { ok: false, error: "categoryId requerido" };
  }

  const write = await requireActasWriteSupabase();
  if (!write.ok) {
    return { ok: false, error: write.error };
  }
  const { client } = write;

  const parentElementId = input.parentElementId?.trim() || null;

  if (parentElementId) {
    const { data: parent, error: parentError } = await client
      .from("element")
      .select("id, category_id, parent_element_id")
      .eq("id", parentElementId)
      .is("archived_at", null)
      .maybeSingle();

    if (parentError) {
      return { ok: false, error: parentError.message };
    }
    if (!parent) {
      return {
        ok: false,
        error: "Elemento padre no encontrado o sin acceso al proyecto",
      };
    }
    if ((parent.category_id as string) !== categoryId) {
      return {
        ok: false,
        error: "El elemento padre no pertenece a esta categoría",
      };
    }
    if (parent.parent_element_id != null) {
      return {
        ok: false,
        error: "Solo los elementos raíz pueden tener sub-elementos",
      };
    }
  }

  const unique = await assertUniqueElementNameInCategory(client, {
    categoryId,
    parentElementId,
    name,
  });
  if (!unique.ok) {
    return { ok: false, error: unique.error };
  }

  let orderQuery = client
    .from("element")
    .select("order_index")
    .eq("category_id", categoryId)
    .is("archived_at", null);
  orderQuery = parentElementId
    ? orderQuery.eq("parent_element_id", parentElementId)
    : orderQuery.is("parent_element_id", null);
  const { data: orderRows, error: orderErr } = await orderQuery;

  if (orderErr) {
    return { ok: false, error: orderErr.message };
  }

  const maxOrder = (orderRows ?? []).reduce(
    (max, row) => Math.max(max, row.order_index as number),
    -1,
  );

  const { data: inserted, error: insertErr } = await client
    .from("element")
    .insert({
      category_id: categoryId,
      parent_element_id: parentElementId,
      master_element_id: null,
      name,
      status: "not_started",
      order_index: maxOrder + 1,
    })
    .select("id")
    .single();

  if (insertErr) {
    return { ok: false, error: insertErr.message };
  }

  const newId = inserted.id as string;

  if (parentElementId) {
    const { data: parentOwners, error: ownerErr } = await client
      .from("element_owner")
      .select("user_id")
      .eq("element_id", parentElementId);

    if (ownerErr) {
      return { ok: false, error: ownerErr.message };
    }

    if (parentOwners && parentOwners.length > 0) {
      const { error: copyErr } = await client.from("element_owner").insert(
        parentOwners.map((row) => ({
          element_id: newId,
          user_id: row.user_id as string,
        })),
      );
      if (copyErr) {
        return { ok: false, error: copyErr.message };
      }
    }
  }

  const { data: projectRow, error: projectErr } = await client
    .from("category")
    .select("project_id")
    .eq("id", categoryId)
    .maybeSingle();

  if (!projectErr && projectRow?.project_id) {
    const { data: project, error: codeErr } = await client
      .from("project")
      .select("code")
      .eq("id", projectRow.project_id as string)
      .maybeSingle();
    if (!codeErr && project?.code) {
      revalidatePath(`/dashboard/pm/actas/${project.code as string}`);
    }
  }

  return { ok: true, elementId: newId };
}
