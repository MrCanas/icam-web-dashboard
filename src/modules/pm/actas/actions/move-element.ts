"use server";

import { revalidatePath } from "next/cache";

import { requireCurrentUser } from "@/lib/auth/currentUser";
import { checkWriteAccess } from "@/lib/auth/permissions";
import { getActasAuthenticatedSupabase } from "@/modules/pm/actas/data/authenticatedClient";
import {
  countDirectChildren,
  wouldCreateParentCycle,
} from "@/modules/pm/actas/logic/element-move-validation";

export type MoveElementInput = {
  projectId: string;
  projectCode: string;
  elementId: string;
  targetCategoryId: string;
  targetParentElementId: string | null;
  /** IDs de hermanos en el destino (incluye elementId), en orden visual. */
  orderedSiblingIds: string[];
};

export type MoveElementResult = { ok: true } | { ok: false; error: string };

type ElementRow = {
  id: string;
  category_id: string;
  parent_element_id: string | null;
  order_index: number;
};

export async function moveElement(
  input: MoveElementInput,
): Promise<MoveElementResult> {
  const elementId = input.elementId.trim();
  const projectId = input.projectId.trim();
  const targetCategoryId = input.targetCategoryId.trim();
  const targetParentElementId = input.targetParentElementId?.trim() || null;
  const orderedSiblingIds = input.orderedSiblingIds.map((id) => id.trim()).filter(Boolean);
  const projectCode = input.projectCode.trim();

  if (!elementId || !projectId || !targetCategoryId || !projectCode) {
    return { ok: false, error: "Parámetros incompletos" };
  }

  if (!orderedSiblingIds.includes(elementId)) {
    return {
      ok: false,
      error: "orderedSiblingIds debe incluir el elemento movido",
    };
  }

  const unique = new Set(orderedSiblingIds);
  if (unique.size !== orderedSiblingIds.length) {
    return { ok: false, error: "IDs de hermanos duplicados" };
  }

  const user = await requireCurrentUser();
  const writeDenied = checkWriteAccess(user, "pm");
  if (writeDenied) return { ok: false, error: writeDenied };

  const { client, error: clientError } = await getActasAuthenticatedSupabase();
  if (!client) {
    return { ok: false, error: clientError };
  }

  const { data: categories, error: catErr } = await client
    .from("category")
    .select("id")
    .eq("project_id", projectId)
    .is("archived_at", null);

  if (catErr) {
    return { ok: false, error: catErr.message };
  }

  const categoryIds = new Set((categories ?? []).map((c) => c.id as string));
  if (!categoryIds.has(targetCategoryId)) {
    return { ok: false, error: "Categoría destino no pertenece al proyecto" };
  }

  const { data: elements, error: elErr } = await client
    .from("element")
    .select("id, category_id, parent_element_id, order_index")
    .in("category_id", [...categoryIds])
    .is("archived_at", null);

  if (elErr) {
    return { ok: false, error: elErr.message };
  }

  const rows = (elements ?? []) as ElementRow[];
  const byId = new Map(rows.map((r) => [r.id, r]));
  const parentById = new Map(
    rows.map((r) => [r.id, r.parent_element_id as string | null]),
  );

  const moving = byId.get(elementId);
  if (!moving) {
    return { ok: false, error: "Elemento no encontrado o sin acceso" };
  }

  for (const siblingId of orderedSiblingIds) {
    if (!byId.has(siblingId)) {
      return { ok: false, error: "Hermano no encontrado en el proyecto" };
    }
  }

  if (targetParentElementId) {
    const parent = byId.get(targetParentElementId);
    if (!parent) {
      return { ok: false, error: "Elemento padre no encontrado" };
    }
    if ((parent.category_id as string) !== targetCategoryId) {
      return {
        ok: false,
        error: "El padre debe pertenecer a la misma categoría",
      };
    }
    if (parent.parent_element_id != null) {
      return {
        ok: false,
        error: "Solo los elementos raíz pueden tener sub-elementos",
      };
    }
    if (wouldCreateParentCycle(elementId, targetParentElementId, parentById)) {
      return {
        ok: false,
        error: "No se puede mover un elemento dentro de su propio descendiente",
      };
    }
  }

  if (
    targetParentElementId &&
    countDirectChildren(elementId, parentById) > 0
  ) {
    return {
      ok: false,
      error:
        "Un elemento con sub-elementos no puede convertirse en sub-elemento",
    };
  }

  const oldCategoryId = moving.category_id as string;
  const oldParentId = moving.parent_element_id as string | null;
  const categoryChanged = oldCategoryId !== targetCategoryId;

  const { error: updateErr } = await client
    .from("element")
    .update({
      category_id: targetCategoryId,
      parent_element_id: targetParentElementId,
    })
    .eq("id", elementId);

  if (updateErr) {
    return { ok: false, error: updateErr.message };
  }

  if (categoryChanged) {
    const childIds = rows
      .filter((r) => r.parent_element_id === elementId)
      .map((r) => r.id);

    if (childIds.length > 0) {
      const { error: childCatErr } = await client
        .from("element")
        .update({ category_id: targetCategoryId })
        .in("id", childIds);

      if (childCatErr) {
        return { ok: false, error: childCatErr.message };
      }
    }
  }

  const destUpdates = orderedSiblingIds.map((id, index) =>
    client.from("element").update({ order_index: index }).eq("id", id),
  );
  const destResults = await Promise.all(destUpdates);
  const destFailed = destResults.find((r) => r.error);
  if (destFailed?.error) {
    return { ok: false, error: destFailed.error.message };
  }

  const sourceSiblingIds = rows
    .filter(
      (r) =>
        r.id !== elementId &&
        (r.category_id as string) === oldCategoryId &&
        (r.parent_element_id as string | null) === oldParentId,
    )
    .sort((a, b) => a.order_index - b.order_index)
    .map((r) => r.id);

  const sameContainer =
    oldCategoryId === targetCategoryId &&
    oldParentId === targetParentElementId;

  if (!sameContainer && sourceSiblingIds.length > 0) {
    const sourceUpdates = sourceSiblingIds.map((id, index) =>
      client.from("element").update({ order_index: index }).eq("id", id),
    );
    const sourceResults = await Promise.all(sourceUpdates);
    const sourceFailed = sourceResults.find((r) => r.error);
    if (sourceFailed?.error) {
      return { ok: false, error: sourceFailed.error.message };
    }
  }

  revalidatePath(`/dashboard/pm/actas/${projectCode}`);
  return { ok: true };
}
