"use server";

import { requireCurrentUser } from "@/lib/auth/currentUser";
import { checkWriteAccess } from "@/lib/auth/permissions";
import { getActasAuthenticatedSupabase } from "@/modules/pm/actas/data/authenticatedClient";

export type ArchiveElementInput = {
  elementId: string;
};

export type ArchiveElementResult =
  | { ok: true; archivedCount: number }
  | { ok: false; error: string };

async function collectDescendantIds(
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
      .is("archived_at", null);

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

export async function archiveElement(
  input: ArchiveElementInput,
): Promise<ArchiveElementResult> {
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
    .is("archived_at", null)
    .maybeSingle();

  if (elErr) {
    return { ok: false, error: elErr.message };
  }
  if (!element) {
    return {
      ok: false,
      error: "Elemento no encontrado o sin acceso al proyecto",
    };
  }

  let idsToArchive: string[];
  try {
    idsToArchive = await collectDescendantIds(client, elementId);
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Error recorriendo árbol",
    };
  }

  const archivedAt = new Date().toISOString();
  const { error: updateErr } = await client
    .from("element")
    .update({ archived_at: archivedAt })
    .in("id", idsToArchive);

  if (updateErr) {
    return { ok: false, error: updateErr.message };
  }

  return { ok: true, archivedCount: idsToArchive.length };
}
