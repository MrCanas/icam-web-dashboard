"use server";

import { requireCurrentUser } from "@/lib/auth/currentUser";
import { checkWriteAccess } from "@/lib/auth/permissions";
import { getActasAuthenticatedSupabase } from "@/modules/pm/actas/data/authenticatedClient";

export type RestoreElementInput = {
  elementId: string;
};

export type RestoreElementResult =
  | { ok: true; restoredCount: number }
  | { ok: false; error: string };

/**
 * Des-archiva un elemento previamente archivado (soft-delete) junto con sus
 * descendientes también archivados. Espejo de `archiveElement`: nunca borra
 * filas, solo pone `archived_at = null`.
 */
async function collectArchivedDescendantIds(
  client: NonNullable<
    Awaited<ReturnType<typeof getActasAuthenticatedSupabase>>["client"]
  >,
  rootId: string,
): Promise<string[]> {
  const ids = new Set<string>([rootId]);
  let frontier = [rootId];

  while (frontier.length > 0) {
    const { data, error } = await client
      .from("element")
      .select("id")
      .in("parent_element_id", frontier)
      .not("archived_at", "is", null);

    if (error) throw new Error(error.message);

    const next: string[] = [];
    for (const row of data ?? []) {
      const id = row.id as string;
      if (!ids.has(id)) {
        ids.add(id);
        next.push(id);
      }
    }
    frontier = next;
  }

  return [...ids];
}

export async function restoreElement(
  input: RestoreElementInput,
): Promise<RestoreElementResult> {
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

  const { data: element, error: elErr } = await client
    .from("element")
    .select("id")
    .eq("id", elementId)
    .not("archived_at", "is", null)
    .maybeSingle();

  if (elErr) {
    return { ok: false, error: elErr.message };
  }
  if (!element) {
    return {
      ok: false,
      error: "Elemento archivado no encontrado o sin acceso al proyecto",
    };
  }

  let idsToRestore: string[];
  try {
    idsToRestore = await collectArchivedDescendantIds(client, elementId);
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Error recorriendo árbol",
    };
  }

  const { error: updateErr } = await client
    .from("element")
    .update({ archived_at: null })
    .in("id", idsToRestore);

  if (updateErr) {
    return { ok: false, error: updateErr.message };
  }

  return { ok: true, restoredCount: idsToRestore.length };
}
