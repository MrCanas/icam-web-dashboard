"use server";

import { createServiceRoleClient } from "@/lib/db/admin";
import { requireCurrentUser } from "@/lib/auth/currentUser";
import { checkWriteAccess } from "@/lib/auth/permissions";
import { getActasAuthenticatedSupabase } from "@/modules/pm/actas/data/authenticatedClient";

import { ACTAS_ATTACHMENT_BUCKET } from "../types";

export type DeleteAttachmentResult =
  | { ok: true }
  | { ok: false; error: string };

export async function deleteAttachment(
  attachmentId: string,
): Promise<DeleteAttachmentResult> {
  const id = attachmentId.trim();
  if (!id) return { ok: false, error: "id requerido" };

  const user = await requireCurrentUser();
  const writeDenied = checkWriteAccess(user, "pm");
  if (writeDenied) return { ok: false, error: writeDenied };

  const { client, error: clientError } = await getActasAuthenticatedSupabase();
  if (!client) {
    return { ok: false, error: clientError };
  }

  // Lee la fila (RLS valida acceso) para conocer la ruta del binario.
  const { data: row, error: fetchError } = await client
    .from("actas_attachment")
    .select("id, storage_path")
    .eq("id", id)
    .maybeSingle();
  if (fetchError) return { ok: false, error: fetchError.message };
  if (!row) return { ok: false, error: "Adjunto no encontrado o sin acceso" };

  const { error: deleteRowError } = await client
    .from("actas_attachment")
    .delete()
    .eq("id", id);
  if (deleteRowError) {
    return { ok: false, error: deleteRowError.message };
  }

  // Borra el binario del bucket privado (service-role).
  const admin = createServiceRoleClient();
  await admin.storage
    .from(ACTAS_ATTACHMENT_BUCKET)
    .remove([row.storage_path as string]);

  return { ok: true };
}
