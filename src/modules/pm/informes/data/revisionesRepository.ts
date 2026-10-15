import type { UserContext } from "@/lib/auth/currentUser";

import { esTablaInexistente, mensajeErrorBd } from "../logic/errores";
import type { SlideJson } from "../slides/tipos";
import type { RevisionInforme, TipoRevision } from "../types";
import { getInformesSupabase } from "./client";

type R<T> = { data: T; error: null } | { data: null; error: string };

/** Falta la migración 050: el mensaje dice qué hay que aplicar. */
function sinTabla(error: { code?: string; message?: string }): string | null {
  return esTablaInexistente(error)
    ? "Falta la tabla informe_revision: aplica la migración 050 (npm run pm:apply-migration-050 -- --apply). Mientras tanto las revisiones funcionan, pero no quedan en este historial."
    : null;
}

export interface NuevaRevision {
  tipo: TipoRevision;
  instruccion: string;
  resumen: string;
  antes: SlideJson[];
  despues: SlideJson[];
  ordenAntes: string[];
}

function deFila(f: Record<string, unknown>): RevisionInforme {
  return {
    id: f.id as number,
    tipo: f.tipo as TipoRevision,
    instruccion: (f.instruccion as string) ?? "",
    resumen: (f.resumen as string) ?? "",
    antes: (f.slides_antes as SlideJson[]) ?? [],
    despues: (f.slides_despues as SlideJson[]) ?? [],
    ordenAntes: (f.orden_antes as string[]) ?? [],
    fecha: f.created_at as string,
    autor: (f.usuario_nombre as string) || null,
    deshecha: !!f.deshecha,
  };
}

const COLUMNAS = "id, tipo, instruccion, resumen, slides_antes, slides_despues, orden_antes, deshecha, usuario_nombre, created_at";

export async function registrarRevision(ctx: UserContext, informeId: string, r: NuevaRevision): Promise<R<RevisionInforme>> {
  const { data, error } = await getInformesSupabase(ctx)
    .from("informe_revision")
    .insert({
      informe_id: informeId,
      tipo: r.tipo,
      instruccion: r.instruccion.slice(0, 12_000),
      resumen: r.resumen.slice(0, 2000),
      slides_antes: r.antes,
      slides_despues: r.despues,
      orden_antes: r.ordenAntes,
      user_id: ctx.id,
      usuario_nombre: ctx.name,
    })
    .select(COLUMNAS)
    .single();
  if (error) return { data: null, error: sinTabla(error) ?? mensajeErrorBd(error) };
  return { data: deFila(data), error: null };
}

/** Revisiones del informe, de la más reciente a la más antigua. */
export async function listarRevisiones(ctx: UserContext, informeId: string): Promise<R<RevisionInforme[]>> {
  const { data, error } = await getInformesSupabase(ctx)
    .from("informe_revision")
    .select(COLUMNAS)
    .eq("informe_id", informeId)
    .order("created_at", { ascending: false })
    .limit(100);
  if (error) return { data: null, error: sinTabla(error) ?? mensajeErrorBd(error) };
  return { data: (data ?? []).map(deFila), error: null };
}

export async function marcarDeshecha(ctx: UserContext, informeId: string, id: number): Promise<R<null>> {
  const { error } = await getInformesSupabase(ctx).from("informe_revision").update({ deshecha: true }).eq("id", id).eq("informe_id", informeId);
  if (error) return { data: null, error: sinTabla(error) ?? mensajeErrorBd(error) };
  return { data: null, error: null };
}
