import type { UserContext } from "@/lib/auth/currentUser";
import { withAudit } from "@/lib/audit/withAudit";

import { mensajeErrorBd } from "../logic/errores";
import { compararTrimestres } from "../logic/trimestre";
import { CATEGORIAS_FOTO, type CategoriaFoto, type Foto, type FotoBiblioteca } from "../types";
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

/**
 * Biblioteca de imágenes del proyecto: las fotos subidas en cualquiera de sus
 * informes (migración 045: cada foto es de su proyecto), de la más reciente a
 * la más antigua.
 */
export async function listarBiblioteca(ctx: UserContext, codigo: string): Promise<R<FotoBiblioteca[]>> {
  const sb = getInformesSupabase(ctx);
  const [fotos, informes] = await Promise.all([
    sb.from("informe_foto").select(`${COLUMNAS}, informe_id, created_at`).eq("codigo", codigo).order("created_at", { ascending: false }),
    sb.from("informe").select("id, trimestre").eq("codigo", codigo),
  ]);
  if (fotos.error) return { data: null, error: mensajeErrorBd(fotos.error) };
  if (informes.error) return { data: null, error: mensajeErrorBd(informes.error) };
  const trimestres = new Map((informes.data ?? []).map((i) => [i.id as string, i.trimestre as string]));
  return {
    data: ((fotos.data ?? []) as unknown as Record<string, unknown>[]).map((f) => ({
      ...aFoto(f),
      informeId: (f.informe_id as string | null) ?? null,
      trimestre: trimestres.get(f.informe_id as string) ?? null,
      creada: f.created_at as string,
    })),
    error: null,
  };
}

/**
 * Informes del proyecto cuyas slides usan alguna de estas fotos (las slides las
 * referencian por id). Devuelve, por foto, los trimestres que la usan, del más
 * reciente al más antiguo.
 */
export async function usoDeFotos(
  ctx: UserContext,
  codigo: string,
  ids: string[],
  excluirInforme?: string,
): Promise<R<Map<string, string[]>>> {
  const uso = new Map<string, string[]>();
  if (!ids.length) return { data: uso, error: null };
  const { data, error } = await getInformesSupabase(ctx).from("informe").select("id, trimestre, contenido").eq("codigo", codigo);
  if (error) return { data: null, error: mensajeErrorBd(error) };
  const informes = (data ?? [])
    .filter((i) => i.id !== excluirInforme && i.contenido)
    .map((i) => ({ trimestre: i.trimestre as string, texto: JSON.stringify(i.contenido) }))
    .sort((a, b) => compararTrimestres(b.trimestre, a.trimestre));
  for (const id of ids) {
    const donde = informes.filter((i) => i.texto.includes(id)).map((i) => i.trimestre);
    if (donde.length) uso.set(id, donde);
  }
  return { data: uso, error: null };
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
  // Una foto colocada en una slide no se borra: la slide se quedaría sin imagen.
  const { data: informe, error: e1 } = await sb.from("informe").select("codigo").eq("id", informeId).maybeSingle();
  if (e1) return { data: null, error: mensajeErrorBd(e1) };
  if (informe) {
    const uso = await usoDeFotos(ctx, informe.codigo as string, [id]);
    if (uso.error !== null) return { data: null, error: uso.error };
    const donde = uso.data.get(id);
    if (donde) return { data: null, error: `Esa foto está colocada en el informe ${donde.join(", ")}: quítala antes de la slide.` };
  }
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

/**
 * Fotos subidas en un informe que se van a borrar con él: las que ningún otro
 * informe del proyecto usa. Las demás se quedan en la biblioteca del proyecto.
 */
export async function fotosABorrarConInforme(
  ctx: UserContext,
  codigo: string,
  informeId: string,
): Promise<R<{ id: string; ruta: string }[]>> {
  const { data, error } = await getInformesSupabase(ctx).from("informe_foto").select("id, storage_path").eq("informe_id", informeId);
  if (error) return { data: null, error: mensajeErrorBd(error) };
  const fotos = (data ?? []).map((f) => ({ id: f.id as string, ruta: f.storage_path as string }));
  const uso = await usoDeFotos(ctx, codigo, fotos.map((f) => f.id), informeId);
  if (uso.error !== null) return { data: null, error: uso.error };
  return { data: fotos.filter((f) => !uso.data.has(f.id)), error: null };
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
