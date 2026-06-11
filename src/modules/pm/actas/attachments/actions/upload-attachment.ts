"use server";

import { createServiceRoleClient } from "@/lib/db/admin";
import { requireCurrentUser } from "@/lib/auth/currentUser";
import { checkWriteAccess } from "@/lib/auth/permissions";
import { resolveAuthUserIdByEmail } from "@/lib/auth/resolve-auth-user";
import { getActasAuthenticatedSupabase } from "@/modules/pm/actas/data/authenticatedClient";

import {
  ACTAS_ATTACHMENT_BUCKET,
  extForMime,
  validateAttachmentFile,
  type ActasAttachmentItem,
} from "../types";

export type UploadAttachmentResult =
  | { ok: true; attachment: ActasAttachmentItem }
  | { ok: false; error: string };

const SIGNED_URL_TTL_SEC = 3600;

export async function uploadAttachment(
  formData: FormData,
): Promise<UploadAttachmentResult> {
  const elementId = String(formData.get("elementId") ?? "").trim();
  const file = formData.get("file");

  if (!elementId) {
    return { ok: false, error: "elementId requerido" };
  }
  if (!(file instanceof File)) {
    return { ok: false, error: "Archivo no recibido" };
  }

  const validationError = validateAttachmentFile({
    type: file.type,
    size: file.size,
  });
  if (validationError) {
    return { ok: false, error: validationError };
  }

  const user = await requireCurrentUser();
  const writeDenied = checkWriteAccess(user, "pm");
  if (writeDenied) return { ok: false, error: writeDenied };

  const uploadedBy = await resolveAuthUserIdByEmail(user.email);
  if (!uploadedBy) {
    return {
      ok: false,
      error: `Usuario ${user.email} no provisionado en Supabase Auth.`,
    };
  }

  const { client, error: clientError } = await getActasAuthenticatedSupabase();
  if (!client) {
    return { ok: false, error: clientError };
  }

  // Verifica acceso al elemento y resuelve el proyecto (para la ruta).
  const { data: element, error: elementError } = await client
    .from("element")
    .select("id, category_id")
    .eq("id", elementId)
    .is("archived_at", null)
    .maybeSingle();
  if (elementError) return { ok: false, error: elementError.message };
  if (!element) {
    return { ok: false, error: "Elemento no encontrado o sin acceso" };
  }

  const { data: category, error: categoryError } = await client
    .from("category")
    .select("project_id")
    .eq("id", element.category_id as string)
    .maybeSingle();
  if (categoryError) return { ok: false, error: categoryError.message };
  const projectId = category?.project_id as string | undefined;
  if (!projectId) {
    return { ok: false, error: "No se pudo resolver el proyecto" };
  }

  const ext = extForMime(file.type);
  const storagePath = `${projectId}/${elementId}/${crypto.randomUUID()}.${ext}`;

  // Storage en bucket privado vía service-role (el acceso lo controla la action).
  const admin = createServiceRoleClient();
  const { error: uploadError } = await admin.storage
    .from(ACTAS_ATTACHMENT_BUCKET)
    .upload(storagePath, file, {
      contentType: file.type,
      upsert: false,
    });
  if (uploadError) {
    return { ok: false, error: uploadError.message };
  }

  const { data: inserted, error: insertError } = await client
    .from("actas_attachment")
    .insert({
      element_id: elementId,
      storage_path: storagePath,
      file_name: file.name,
      mime_type: file.type,
      size_bytes: file.size,
      uploaded_by: uploadedBy,
    })
    .select("id, element_id, storage_path, file_name, mime_type, size_bytes, uploaded_by, created_at")
    .single();

  if (insertError || !inserted) {
    // Rollback del binario si falla la fila.
    await admin.storage.from(ACTAS_ATTACHMENT_BUCKET).remove([storagePath]);
    return { ok: false, error: insertError?.message ?? "Error al guardar adjunto" };
  }

  const { data: signed } = await admin.storage
    .from(ACTAS_ATTACHMENT_BUCKET)
    .createSignedUrl(storagePath, SIGNED_URL_TTL_SEC);

  return {
    ok: true,
    attachment: {
      id: inserted.id as string,
      elementId: inserted.element_id as string,
      fileName: inserted.file_name as string,
      mimeType: inserted.mime_type as string,
      sizeBytes: Number(inserted.size_bytes),
      storagePath: inserted.storage_path as string,
      createdAt: inserted.created_at as string,
      uploadedBy: inserted.uploaded_by as string,
      signedUrl: signed?.signedUrl ?? null,
    },
  };
}
