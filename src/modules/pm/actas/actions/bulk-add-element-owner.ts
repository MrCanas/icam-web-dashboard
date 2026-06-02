"use server";

import { requireCurrentUser } from "@/lib/auth/currentUser";
import { checkWriteAccess } from "@/lib/auth/permissions";
import { getActasAuthenticatedSupabase } from "@/modules/pm/actas/data/authenticatedClient";

export type BulkAddElementOwnerInput = {
  elementIds: string[];
  userId: string;
};

export type BulkAddElementOwnerResult =
  | { ok: true; assigned: number }
  | { ok: false; error: string };

export async function bulkAddElementOwner(
  input: BulkAddElementOwnerInput,
): Promise<BulkAddElementOwnerResult> {
  const elementIds = [...new Set(input.elementIds.map((id) => id.trim()).filter(Boolean))];
  const userId = input.userId.trim();

  if (elementIds.length === 0) {
    return { ok: false, error: "No hay elementos seleccionados" };
  }
  if (!userId) {
    return { ok: false, error: "userId requerido" };
  }

  const user = await requireCurrentUser();
  const writeDenied = checkWriteAccess(user, "pm");
  if (writeDenied) return { ok: false, error: writeDenied };

  const { client, error: clientError } = await getActasAuthenticatedSupabase();
  if (!client) {
    return { ok: false, error: clientError };
  }

  const { data: elements, error: elErr } = await client
    .from("element")
    .select("id")
    .in("id", elementIds)
    .is("archived_at", null);

  if (elErr) {
    return { ok: false, error: elErr.message };
  }

  const found = new Set((elements ?? []).map((r) => r.id as string));
  if (found.size !== elementIds.length) {
    return {
      ok: false,
      error: "Uno o más elementos no encontrados o sin acceso",
    };
  }

  const rows = elementIds.map((elementId) => ({
    element_id: elementId,
    user_id: userId,
  }));

  const { error: upsertErr } = await client
    .from("element_owner")
    .upsert(rows, { onConflict: "element_id,user_id", ignoreDuplicates: true });

  if (upsertErr) {
    return { ok: false, error: upsertErr.message };
  }

  return { ok: true, assigned: elementIds.length };
}
