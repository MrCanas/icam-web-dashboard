import type { UserContext } from "@/lib/auth/currentUser";
import { withAudit } from "@/lib/audit/withAudit";

import { getInformesSupabase, INFORMES_FOTOS_BUCKET } from "./client";

/**
 * Fotos del informe. El binario va a Storage; la fila de informe_asset da el
 * id estable que la app escribe dentro del JSON de los slides.
 */

export const MIME_ADMITIDOS = ["image/jpeg", "image/png", "image/webp"] as const;
export const MAX_BYTES_FOTO = 10 * 1024 * 1024;

const EXTENSION: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

export async function subirAsset(
  ctx: UserContext,
  contenido: ArrayBuffer,
  mime: string,
): Promise<{ id: string | null; error: string | null }> {
  const id = crypto.randomUUID();
  const ruta = `${id.slice(0, 2)}/${id}.${EXTENSION[mime] ?? "bin"}`;
  const supabase = getInformesSupabase(ctx);

  const { error: errSubida } = await supabase.storage
    .from(INFORMES_FOTOS_BUCKET)
    .upload(ruta, contenido, { contentType: mime, upsert: false });
  if (errSubida) return { id: null, error: errSubida.message };

  const { error } = await withAudit(
    ctx,
    "pm.informe.asset.create",
    { resourceType: "informe_asset", resourceId: id, payload: { mime, bytes: contenido.byteLength } },
    async () =>
      supabase.from("informe_asset").insert({
        id,
        storage_path: ruta,
        mime_type: mime,
        size_bytes: contenido.byteLength,
        created_by: ctx.id,
      }),
  );
  if (error) {
    await supabase.storage.from(INFORMES_FOTOS_BUCKET).remove([ruta]);
    return { id: null, error: error.message };
  }
  return { id, error: null };
}

export async function leerAsset(
  ctx: UserContext,
  id: string,
): Promise<{ data: { cuerpo: ArrayBuffer; mime: string } | null; error: string | null }> {
  const supabase = getInformesSupabase(ctx);
  const { data: fila, error } = await supabase
    .from("informe_asset")
    .select("storage_path, mime_type")
    .eq("id", id)
    .maybeSingle();
  if (error) return { data: null, error: error.message };
  if (!fila) return { data: null, error: null };

  const { data: blob, error: errDescarga } = await supabase.storage
    .from(INFORMES_FOTOS_BUCKET)
    .download(fila.storage_path as string);
  if (errDescarga || !blob) return { data: null, error: errDescarga?.message ?? "No se pudo leer la foto" };
  return { data: { cuerpo: await blob.arrayBuffer(), mime: fila.mime_type as string }, error: null };
}

export async function borrarAsset(
  ctx: UserContext,
  id: string,
): Promise<{ error: string | null }> {
  const supabase = getInformesSupabase(ctx);
  const { data: fila, error } = await supabase
    .from("informe_asset")
    .select("storage_path")
    .eq("id", id)
    .maybeSingle();
  if (error) return { error: error.message };
  if (!fila) return { error: null };

  return withAudit(
    ctx,
    "pm.informe.asset.delete",
    { resourceType: "informe_asset", resourceId: id },
    async () => {
      await supabase.storage.from(INFORMES_FOTOS_BUCKET).remove([fila.storage_path as string]);
      const { error: errBorrado } = await supabase.from("informe_asset").delete().eq("id", id);
      return { error: errBorrado?.message ?? null };
    },
  );
}
