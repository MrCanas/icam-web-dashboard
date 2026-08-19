"use server";

import { createServiceRoleClient } from "@/lib/db/admin";
import { requirePmReadContext } from "@/modules/pm/actas/actions/require-pm-read";
import { getActasAuthenticatedSupabase } from "@/modules/pm/actas/data/authenticatedClient";

import { ACTAS_ATTACHMENT_BUCKET, type ActasAttachmentItem } from "../types";

export type ListAttachmentsResult =
  | { ok: true; attachments: ActasAttachmentItem[] }
  | { ok: false; error: string };

const SIGNED_URL_TTL_SEC = 3600;

export async function listAttachments(
  elementId: string,
): Promise<ListAttachmentsResult> {
  const id = elementId.trim();
  if (!id) return { ok: false, error: "elementId requerido" };

  const access = await requirePmReadContext();
  if (!access.ok) return access;

  const { client, error: clientError } = await getActasAuthenticatedSupabase();
  if (!client) {
    return { ok: false, error: clientError };
  }

  const { data: rows, error } = await client
    .from("actas_attachment")
    .select(
      "id, element_id, storage_path, file_name, mime_type, size_bytes, uploaded_by, created_at",
    )
    .eq("element_id", id)
    .order("created_at", { ascending: false });

  if (error) {
    return { ok: false, error: error.message };
  }

  const admin = createServiceRoleClient();
  const attachments: ActasAttachmentItem[] = [];
  for (const row of rows ?? []) {
    const storagePath = row.storage_path as string;
    const { data: signed } = await admin.storage
      .from(ACTAS_ATTACHMENT_BUCKET)
      .createSignedUrl(storagePath, SIGNED_URL_TTL_SEC);
    attachments.push({
      id: row.id as string,
      elementId: row.element_id as string,
      fileName: row.file_name as string,
      mimeType: row.mime_type as string,
      sizeBytes: Number(row.size_bytes),
      storagePath,
      createdAt: row.created_at as string,
      uploadedBy: row.uploaded_by as string,
      signedUrl: signed?.signedUrl ?? null,
    });
  }

  return { ok: true, attachments };
}
