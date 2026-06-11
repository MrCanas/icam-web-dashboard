"use server";

import { revalidatePath } from "next/cache";

import { requireActasWriteSupabase } from "@/modules/pm/actas/data/writeClient";
import {
  assertUniqueCategoryNameInProject,
  normalizeCategoryName,
} from "@/modules/pm/actas/logic/category-name-validation";

export type CreateCategoryInput = {
  projectId: string;
  name: string;
};

export type CreateCategoryResult =
  | { ok: true; categoryId: string }
  | { ok: false; error: string };

export async function createCategory(
  input: CreateCategoryInput,
): Promise<CreateCategoryResult> {
  const name = normalizeCategoryName(input.name);
  if (!name) {
    return { ok: false, error: "El nombre es obligatorio" };
  }

  const projectId = input.projectId.trim();
  if (!projectId) {
    return { ok: false, error: "projectId requerido" };
  }

  const write = await requireActasWriteSupabase();
  if (!write.ok) {
    return { ok: false, error: write.error };
  }
  const { client } = write;

  const { data: project, error: projectError } = await client
    .from("project")
    .select("id")
    .eq("id", projectId)
    .is("archived_at", null)
    .maybeSingle();

  if (projectError) {
    return { ok: false, error: projectError.message };
  }
  if (!project) {
    return {
      ok: false,
      error: "Proyecto no encontrado o sin acceso",
    };
  }

  const unique = await assertUniqueCategoryNameInProject(client, {
    projectId,
    name,
  });
  if (!unique.ok) {
    return { ok: false, error: unique.error };
  }

  const { data: orderRows, error: orderErr } = await client
    .from("category")
    .select("order_index")
    .eq("project_id", projectId)
    .is("archived_at", null);

  if (orderErr) {
    return { ok: false, error: orderErr.message };
  }

  const maxOrder = (orderRows ?? []).reduce(
    (max, row) => Math.max(max, row.order_index as number),
    -1,
  );

  const { data: inserted, error: insertErr } = await client
    .from("category")
    .insert({
      project_id: projectId,
      master_group_id: null,
      name,
      order_index: maxOrder + 1,
      sublot_label: null,
    })
    .select("id")
    .single();

  if (insertErr) {
    return { ok: false, error: insertErr.message };
  }

  const { data: projectRow, error: projectCodeErr } = await client
    .from("project")
    .select("code")
    .eq("id", projectId)
    .maybeSingle();

  if (!projectCodeErr && projectRow?.code) {
    revalidatePath(`/dashboard/pm/actas/${projectRow.code as string}`);
  }

  return { ok: true, categoryId: inserted.id as string };
}
