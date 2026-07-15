"use server";

import { createServiceRoleClient } from "@/lib/db/admin";
import { requireCurrentUser } from "@/lib/auth/currentUser";
import { checkWriteAccess } from "@/lib/auth/permissions";
import { getActasAuthenticatedSupabase } from "@/modules/pm/actas/data/authenticatedClient";
import { ACTAS_ATTACHMENT_BUCKET } from "@/modules/pm/actas/attachments/types";

export type DeleteElementResult = { ok: true } | { ok: false; error: string };

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
      .in("parent_element_id", frontier);
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

/**
 * Borra PERMANENTEMENTE un elemento (en cualquier estado, incluido archivado)
 * y, en cascada, sus sub-elementos, entradas, owners, notificaciones y filas de
 * adjuntos. Los binarios de Storage se borran aquí.
 */
export async function deleteElement(
  elementId: string,
): Promise<DeleteElementResult> {
  const id = elementId.trim();
  if (!id) return { ok: false, error: "elementId requerido" };

  const user = await requireCurrentUser();
  const writeDenied = checkWriteAccess(user, "pm");
  if (writeDenied) return { ok: false, error: writeDenied };

  const { client, error: clientError } = await getActasAuthenticatedSupabase();
  if (!client) return { ok: false, error: clientError };

  const { data: element, error: elError } = await client
    .from("element")
    .select("id")
    .eq("id", id)
    .maybeSingle();
  if (elError) return { ok: false, error: elError.message };
  if (!element) {
    return { ok: false, error: "Elemento no encontrado o sin acceso" };
  }

  let ids: string[];
  try {
    ids = await collectDescendantIds(client, id);
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Error recorriendo árbol",
    };
  }

  const { data: atts } = await client
    .from("actas_attachment")
    .select("storage_path")
    .in("element_id", ids);
  const storagePaths = (atts ?? []).map((r) => r.storage_path as string);

  // Borrado en cascada (el elemento arrastra a sus descendientes por FK).
  const { error: deleteError } = await client
    .from("element")
    .delete()
    .eq("id", id);
  if (deleteError) return { ok: false, error: deleteError.message };

  if (storagePaths.length > 0) {
    const admin = createServiceRoleClient();
    await admin.storage.from(ACTAS_ATTACHMENT_BUCKET).remove(storagePaths);
  }

  return { ok: true };
}
