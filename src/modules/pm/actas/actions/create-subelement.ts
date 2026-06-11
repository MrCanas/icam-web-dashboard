"use server";

import { requireActasWriteSupabase } from "@/modules/pm/actas/data/writeClient";

export type CreateSubelementInput = {
  parentElementId: string;
  name: string;
};

export type CreateSubelementResult =
  | { ok: true; elementId: string }
  | { ok: false; error: string };

const MAX_NAME_LEN = 200;

export async function createSubelement(
  input: CreateSubelementInput,
): Promise<CreateSubelementResult> {
  const name = input.name.trim().slice(0, MAX_NAME_LEN);
  if (!name) {
    return { ok: false, error: "El nombre es obligatorio" };
  }

  const parentElementId = input.parentElementId.trim();
  if (!parentElementId) {
    return { ok: false, error: "parentElementId requerido" };
  }

  const write = await requireActasWriteSupabase();
  if (!write.ok) {
    return { ok: false, error: write.error };
  }
  const { client } = write;

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
  if (parent.parent_element_id != null) {
    return {
      ok: false,
      error: "Solo los elementos raíz pueden tener sub-elementos",
    };
  }

  const { data: siblings, error: sibErr } = await client
    .from("element")
    .select("order_index")
    .eq("parent_element_id", parentElementId)
    .is("archived_at", null);

  if (sibErr) {
    return { ok: false, error: sibErr.message };
  }

  const maxOrder = (siblings ?? []).reduce(
    (max, row) => Math.max(max, row.order_index as number),
    -1,
  );

  const { data: inserted, error: insertErr } = await client
    .from("element")
    .insert({
      category_id: parent.category_id as string,
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

  return { ok: true, elementId: newId };
}
