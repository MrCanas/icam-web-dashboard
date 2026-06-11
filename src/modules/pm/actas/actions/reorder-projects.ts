"use server";

import { revalidatePath } from "next/cache";

import { requireCurrentUser } from "@/lib/auth/currentUser";
import { checkWriteAccess } from "@/lib/auth/permissions";
import { getActasAuthenticatedSupabase } from "@/modules/pm/actas/data/authenticatedClient";

export type ReorderProjectsInput = {
  /** IDs de proyectos activos en el nuevo orden (índice 0 = primero). */
  orderedProjectIds: string[];
};

export type ReorderProjectsResult = { ok: true } | { ok: false; error: string };

export async function reorderProjects(
  input: ReorderProjectsInput,
): Promise<ReorderProjectsResult> {
  const orderedProjectIds = input.orderedProjectIds
    .map((id) => id.trim())
    .filter(Boolean);

  if (orderedProjectIds.length === 0) {
    return { ok: false, error: "Lista de proyectos vacía" };
  }

  const unique = new Set(orderedProjectIds);
  if (unique.size !== orderedProjectIds.length) {
    return { ok: false, error: "IDs de proyecto duplicados" };
  }

  const user = await requireCurrentUser();
  const writeDenied = checkWriteAccess(user, "pm");
  if (writeDenied) return { ok: false, error: writeDenied };

  const { client, error: clientError } = await getActasAuthenticatedSupabase();
  if (!client) {
    return { ok: false, error: clientError };
  }

  const { data: activeRows, error: fetchError } = await client
    .from("project")
    .select("id")
    .is("archived_at", null);

  if (fetchError) {
    return { ok: false, error: fetchError.message };
  }

  const activeIds = new Set((activeRows ?? []).map((r) => r.id as string));

  if (orderedProjectIds.length !== activeIds.size) {
    return {
      ok: false,
      error: "El orden debe incluir todos los proyectos activos",
    };
  }

  for (const id of orderedProjectIds) {
    if (!activeIds.has(id)) {
      return { ok: false, error: "Proyecto no encontrado o archivado" };
    }
  }

  const updates = orderedProjectIds.map((id, index) =>
    client.from("project").update({ sort_order: index }).eq("id", id),
  );

  const results = await Promise.all(updates);
  const failed = results.find((r) => r.error);
  if (failed?.error) {
    return { ok: false, error: failed.error.message };
  }

  revalidatePath("/dashboard/pm/actas", "layout");
  return { ok: true };
}
