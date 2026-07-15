"use server";

import { createServiceRoleClient } from "@/lib/db/admin";
import { requireCurrentUser } from "@/lib/auth/currentUser";
import { checkWriteAccess } from "@/lib/auth/permissions";
import { getActasAuthenticatedSupabase } from "@/modules/pm/actas/data/authenticatedClient";
import { ACTAS_ATTACHMENT_BUCKET } from "@/modules/pm/actas/attachments/types";

export type DeleteCategoryResult = { ok: true } | { ok: false; error: string };

/**
 * Borra PERMANENTEMENTE un grupo (categoría) y, en cascada (FK ON DELETE
 * CASCADE, migración 015), sus elementos, sub-elementos, entradas, owners,
 * notificaciones y filas de adjuntos. Los binarios de Storage se borran aquí.
 */
export async function deleteCategory(
  categoryId: string,
): Promise<DeleteCategoryResult> {
  const id = categoryId.trim();
  if (!id) return { ok: false, error: "categoryId requerido" };

  const user = await requireCurrentUser();
  const writeDenied = checkWriteAccess(user, "pm");
  if (writeDenied) return { ok: false, error: writeDenied };

  const { client, error: clientError } = await getActasAuthenticatedSupabase();
  if (!client) return { ok: false, error: clientError };

  const { data: category, error: catError } = await client
    .from("category")
    .select("id")
    .eq("id", id)
    .maybeSingle();
  if (catError) return { ok: false, error: catError.message };
  if (!category) return { ok: false, error: "Grupo no encontrado o sin acceso" };

  // Elementos del grupo (cualquier estado) para localizar sus adjuntos.
  const { data: els, error: elError } = await client
    .from("element")
    .select("id")
    .eq("category_id", id);
  if (elError) return { ok: false, error: elError.message };
  const elementIds = (els ?? []).map((r) => r.id as string);

  let storagePaths: string[] = [];
  if (elementIds.length > 0) {
    const { data: atts } = await client
      .from("actas_attachment")
      .select("storage_path")
      .in("element_id", elementIds);
    storagePaths = (atts ?? []).map((r) => r.storage_path as string);
  }

  // Borrado en cascada en BD.
  const { error: deleteError } = await client
    .from("category")
    .delete()
    .eq("id", id);
  if (deleteError) return { ok: false, error: deleteError.message };

  // Limpieza de binarios en Storage (best-effort tras el commit en BD).
  if (storagePaths.length > 0) {
    const admin = createServiceRoleClient();
    await admin.storage.from(ACTAS_ATTACHMENT_BUCKET).remove(storagePaths);
  }

  return { ok: true };
}
