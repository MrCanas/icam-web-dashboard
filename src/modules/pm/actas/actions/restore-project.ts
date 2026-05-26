"use server";

import { revalidatePath } from "next/cache";

import { getActasAuthenticatedSupabase } from "@/modules/pm/actas/data/authenticatedClient";

export type RestoreProjectInput = {
  projectId: string;
};

export type RestoreProjectResult =
  | { ok: true; projectCode: string }
  | { ok: false; error: string };

export async function restoreProject(
  input: RestoreProjectInput,
): Promise<RestoreProjectResult> {
  const auth = await getActasAuthenticatedSupabase();
  if (!auth.client) {
    return { ok: false, error: auth.error };
  }

  const { data: row, error: readErr } = await auth.client
    .from("project")
    .select("id, code, archived_at")
    .eq("id", input.projectId)
    .maybeSingle();

  if (readErr) {
    return { ok: false, error: readErr.message };
  }
  if (!row) {
    return { ok: false, error: "Proyecto no encontrado o sin acceso" };
  }

  const projectCode = row.code as string;

  if (row.archived_at) {
    const { error: updateErr } = await auth.client
      .from("project")
      .update({ archived_at: null })
      .eq("id", input.projectId);

    if (updateErr) {
      return { ok: false, error: updateErr.message };
    }
  }

  revalidatePath("/dashboard/pm/actas", "layout");
  return { ok: true, projectCode };
}
