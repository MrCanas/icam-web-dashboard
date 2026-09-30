import type { UserContext } from "@/lib/auth/currentUser";
import { withAudit } from "@/lib/audit/withAudit";

import { mensajeErrorBd } from "../logic/errores";
import { CATEGORIAS_FOTO, type CategoriaFoto, type Foto } from "../types";
import { getInformesSupabase, INFORMES_FOTOS_BUCKET } from "./client";

type R<T> = { data: T; error: null } | { data: null; error: string };

export const MIME_FOTO = new Set(["image/jpeg", "image/png", "image/webp"]);
export const MAX_BYTES_FOTO = 10 * 1024 * 1024;

const COLUMNAS = "id, categoria, para, pie, nombre, ancho, alto";

function aFoto(f: Record<string, unknown>): Foto {
  return {
    id: f.id as string,
    categoria: f.categoria as CategoriaFoto,
    para: (f.para as string | null) ?? null,
    pie: (f.pie as string | null) ?? null,
    nombre: (f.nombre as string | null) ?? null,
    ancho: (f.ancho as number | null) ?? null,
    alto: (f.alto as number | null) ?? null,
  };
}

export async function listarFotos(ctx: UserContext, informeId: string): Promise<R<Foto[]>> {
  const { data, error } = await getInformesSupabase(ctx)
    .from("informe_foto")
    .select(COLUMNAS)
    .eq("informe_id", informeId)
    .order("created_at", { ascending: true });
  if (error) return { data: null, error: mensajeErrorBd(error) };
  return { data: (data ?? []).map(aFoto), error: null };
}

export async function subirFoto(
  ctx: UserContext,
  informeId: string,
  fichero: { bytes: ArrayBuffer; mime: string; nombre: string; ancho: number | null; alto: number | null; categoria?: CategoriaFoto; pie?: string | null },
): Promise<R<Foto>> {
  if (!MIME_FOTO.has(fichero.mime)) return { data: null, error: "Formato no admitido: usa JPG, PNG o WEBP." };
  if (fichero.bytes.byteLength > MAX_BYTES_FOTO) return { data: null, error: "La foto supera los 10 MB." };
  const sb = getInformesSupabase(ctx);
  const id = crypto.randomUUID();
  const ext = fichero.mime === "image/png" ? "png" : fichero.mime === "image/webp" ? "webp" : "jpg";
  const ruta = `${informeId}/${id}.${ext}`;
  const { error: e1 } = await sb.storage
    .from(INFORMES_FOTOS_BUCKET)
    .upload(ruta, fichero.bytes, { contentType: fichero.mime, upsert: false });
  if (e1) return { data: null, error: `No se ha podido subir la foto: ${e1.message}` };
  const { data, error } = await withAudit(
    ctx,
    "pm.informe.foto.create",
    { resourceType: "informe", resourceId: informeId, payload: { foto: id, nombre: fichero.nombre } },
    async () =>
      sb
        .from("informe_foto")
        .insert({
          id,
          informe_id: informeId,
          storage_path: ruta,
          mime: fichero.mime,
          ancho: fichero.ancho,
          alto: fichero.alto,
          categoria: fichero.categoria ?? "Obra",
          pie: fichero.pie ?? null,
          nombre: fichero.nombre.slice(0, 200),
          created_by: ctx.id,
        })
        .select(COLUMNAS)
        .single(),
  );
  if (error) {
    await sb.storage.from(INFORMES_FOTOS_BUCKET).remove([ruta]);
    return { data: null, error: mensajeErrorBd(error) };
  }
  return { data: aFoto(data as Record<string, unknown>), error: null };
}

export async function actualizarFoto(
  ctx: UserContext,
  informeId: string,
  id: string,
  cambios: { categoria?: CategoriaFoto; para?: string | null; pie?: string | null },
): Promise<R<null>> {
  if (cambios.categoria && !CATEGORIAS_FOTO.includes(cambios.categoria)) return { data: null, error: "Categoría no válida" };
  const { error } = await withAudit(
    ctx,
    "pm.informe.foto.update",
    { resourceType: "informe", resourceId: informeId, payload: { foto: id, ...cambios } },
    async () => getInformesSupabase(ctx).from("informe_foto").update(cambios).eq("id", id).eq("informe_id", informeId),
  );
  if (error) return { data: null, error: mensajeErrorBd(error) };
  return { data: null, error: null };
}

export async function borrarFoto(ctx: UserContext, informeId: string, id: string): Promise<R<null>> {
  const sb = getInformesSupabase(ctx);
  const { data, error: e0 } = await sb.from("informe_foto").select("storage_path").eq("id", id).eq("informe_id", informeId).maybeSingle();
  if (e0) return { data: null, error: mensajeErrorBd(e0) };
  if (!data) return { data: null, error: null };
  const { error } = await withAudit(
    ctx,
    "pm.informe.foto.delete",
    { resourceType: "informe", resourceId: informeId, payload: { foto: id } },
    async () => sb.from("informe_foto").delete().eq("id", id),
  );
  if (error) return { data: null, error: mensajeErrorBd(error) };
  await sb.storage.from(INFORMES_FOTOS_BUCKET).remove([data.storage_path as string]);
  return { data: null, error: null };
}

/** Binario de una foto para servirla desde /api/informes/fotos/[id]. */
export async function descargarFoto(ctx: UserContext, id: string): Promise<R<{ bytes: ArrayBuffer; mime: string } | null>> {
  const sb = getInformesSupabase(ctx);
  const { data, error } = await sb.from("informe_foto").select("storage_path, mime").eq("id", id).maybeSingle();
  if (error) return { data: null, error: mensajeErrorBd(error) };
  if (!data) return { data: null, error: null };
  const { data: blob, error: e2 } = await sb.storage.from(INFORMES_FOTOS_BUCKET).download(data.storage_path as string);
  if (e2 || !blob) return { data: null, error: e2?.message ?? "No se ha podido leer la foto" };
  return { data: { bytes: await blob.arrayBuffer(), mime: data.mime as string }, error: null };
}
