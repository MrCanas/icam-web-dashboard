import type { UserContext } from "@/lib/auth/currentUser";
import { withAudit } from "@/lib/audit/withAudit";

import { mensajeErrorBd } from "../logic/errores";
import { ORDEN_AUTO } from "../logic/fuentes-auto";
import type { Fuente, FuenteAutomatica, TipoFuente } from "../types";
import { getInformesSupabase } from "./client";

type R<T> = { data: T; error: null } | { data: null; error: string };

/** Tope por fuente: el texto de un documento largo se recorta al guardarlo. */
export const MAX_CARACTERES_FUENTE = 90_000;

const COLUMNAS = "id, tipo, nombre, texto, auto, orden, incluida, updated_at";

function aFuente(f: Record<string, unknown>): Fuente {
  return {
    id: f.id as number,
    tipo: f.tipo as TipoFuente,
    nombre: f.nombre as string,
    texto: f.texto as string,
    auto: f.auto as boolean,
    orden: f.orden as number,
    incluida: f.incluida as boolean,
    actualizado: f.updated_at as string,
  };
}

export async function listarFuentes(ctx: UserContext, informeId: string): Promise<R<Fuente[]>> {
  const { data, error } = await getInformesSupabase(ctx)
    .from("informe_fuente")
    .select(COLUMNAS)
    .eq("informe_id", informeId)
    .order("orden", { ascending: true })
    .order("id", { ascending: true });
  if (error) return { data: null, error: mensajeErrorBd(error) };
  return { data: (data ?? []).map(aFuente), error: null };
}

export async function anadirFuente(
  ctx: UserContext,
  informeId: string,
  f: { tipo: TipoFuente; nombre: string; texto: string; auto?: boolean; orden?: number },
): Promise<R<Fuente>> {
  const { data, error } = await withAudit(
    ctx,
    "pm.informe.fuente.create",
    { resourceType: "informe", resourceId: informeId, payload: { tipo: f.tipo, nombre: f.nombre } },
    async () =>
      getInformesSupabase(ctx)
        .from("informe_fuente")
        .insert({
          informe_id: informeId,
          tipo: f.tipo,
          nombre: f.nombre.slice(0, 300),
          texto: f.texto.slice(0, MAX_CARACTERES_FUENTE),
          auto: f.auto ?? false,
          orden: f.orden ?? 100,
          created_by: ctx.id,
        })
        .select(COLUMNAS)
        .single(),
  );
  if (error) return { data: null, error: mensajeErrorBd(error) };
  return { data: aFuente(data as Record<string, unknown>), error: null };
}

/** Notas libres: una sola fuente «notas» por informe, que se crea o se reescribe. */
export async function guardarNotas(ctx: UserContext, informeId: string, texto: string): Promise<R<Fuente | null>> {
  const sb = getInformesSupabase(ctx);
  const { data: ya, error: e0 } = await sb.from("informe_fuente").select("id").eq("informe_id", informeId).eq("tipo", "notas").maybeSingle();
  if (e0) return { data: null, error: mensajeErrorBd(e0) };
  if (!ya) {
    if (!texto.trim()) return { data: null, error: null };
    return anadirFuente(ctx, informeId, { tipo: "notas", nombre: "Notas del equipo", texto, orden: 50 });
  }
  const { data, error } = await sb
    .from("informe_fuente")
    .update({ texto: texto.slice(0, MAX_CARACTERES_FUENTE), updated_at: new Date().toISOString() })
    .eq("id", ya.id as number)
    .select(COLUMNAS)
    .single();
  if (error) return { data: null, error: mensajeErrorBd(error) };
  return { data: aFuente(data as Record<string, unknown>), error: null };
}

export async function actualizarFuente(
  ctx: UserContext,
  informeId: string,
  id: number,
  cambios: { incluida?: boolean },
): Promise<R<null>> {
  const { error } = await withAudit(
    ctx,
    "pm.informe.fuente.update",
    { resourceType: "informe", resourceId: informeId, payload: { fuente: id, ...cambios } },
    async () =>
      getInformesSupabase(ctx)
        .from("informe_fuente")
        .update({ ...cambios, updated_at: new Date().toISOString() })
        .eq("id", id)
        .eq("informe_id", informeId),
  );
  if (error) return { data: null, error: mensajeErrorBd(error) };
  return { data: null, error: null };
}

export async function borrarFuente(ctx: UserContext, informeId: string, id: number): Promise<R<null>> {
  const { error } = await withAudit(
    ctx,
    "pm.informe.fuente.delete",
    { resourceType: "informe", resourceId: informeId, payload: { fuente: id } },
    async () => getInformesSupabase(ctx).from("informe_fuente").delete().eq("id", id).eq("informe_id", informeId),
  );
  if (error) return { data: null, error: mensajeErrorBd(error) };
  return { data: null, error: null };
}

/**
 * Sustituye las fuentes del portal (actas, planificación) por las recién
 * cargadas, que la PM ha pedido incorporar: quedan incluidas. Solo toca los
 * tipos que han llegado: si una no se ha podido leer, se conserva la que había.
 * Van primero (ORDEN_AUTO): si hay que recortar, se recorta lo aportado a mano.
 */
export async function reemplazarAutomaticas(
  ctx: UserContext,
  informeId: string,
  docs: FuenteAutomatica[],
): Promise<R<null>> {
  if (!docs.length) return { data: null, error: null };
  const sb = getInformesSupabase(ctx);
  const tipos = docs.map((d) => d.tipo);
  const { error } = await withAudit(
    ctx,
    "pm.informe.fuente.auto",
    { resourceType: "informe", resourceId: informeId, payload: { tipos } },
    async () => {
      const del = await sb.from("informe_fuente").delete().eq("informe_id", informeId).eq("auto", true).in("tipo", tipos);
      if (del.error) return del;
      return sb.from("informe_fuente").insert(
        docs.map((d) => ({
          informe_id: informeId,
          tipo: d.tipo,
          nombre: d.nombre,
          texto: d.texto.slice(0, MAX_CARACTERES_FUENTE),
          auto: true,
          orden: ORDEN_AUTO[d.tipo],
          incluida: true,
          created_by: ctx.id,
        })),
      );
    },
  );
  if (error) return { data: null, error: mensajeErrorBd(error) };
  return { data: null, error: null };
}
