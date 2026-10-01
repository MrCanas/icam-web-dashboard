import type { UserContext } from "@/lib/auth/currentUser";
import { withAudit } from "@/lib/audit/withAudit";

import { mensajeErrorBd } from "../logic/errores";
import { ORDEN_AUTO } from "../logic/fuentes-auto";
import { compararTrimestres } from "../logic/trimestre";
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

/** Textos libres de los que hay uno solo por informe, que se crea o se reescribe. */
const TEXTOS_UNICOS = {
  notas: { nombre: "Notas del equipo", orden: 50 },
  no_reportar: { nombre: "No reportar", orden: 5 },
} as const;

/** Tope de «No reportar»: va entero en cada petición a Claude. */
export const MAX_CARACTERES_NO_REPORTAR = 4_000;

async function guardarTextoUnico(
  ctx: UserContext,
  informeId: string,
  tipo: keyof typeof TEXTOS_UNICOS,
  texto: string,
): Promise<R<Fuente | null>> {
  const sb = getInformesSupabase(ctx);
  const { data: ya, error: e0 } = await sb.from("informe_fuente").select("id").eq("informe_id", informeId).eq("tipo", tipo).maybeSingle();
  if (e0) return { data: null, error: mensajeErrorBd(e0) };
  if (!ya) {
    if (!texto.trim()) return { data: null, error: null };
    return anadirFuente(ctx, informeId, { tipo, ...TEXTOS_UNICOS[tipo], texto });
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

/** Notas libres del equipo. */
export async function guardarNotas(ctx: UserContext, informeId: string, texto: string): Promise<R<Fuente | null>> {
  return guardarTextoUnico(ctx, informeId, "notas", texto);
}

/** Lo que el equipo pide dejar fuera del informe aunque esté en la información aportada. */
export async function guardarNoReportar(ctx: UserContext, informeId: string, texto: string): Promise<R<Fuente | null>> {
  return guardarTextoUnico(ctx, informeId, "no_reportar", texto.slice(0, MAX_CARACTERES_NO_REPORTAR));
}

/**
 * Precarga «No reportar» en un informe recién creado con lo que decía el
 * informe más reciente del proyecto de un trimestre anterior: lo que no se
 * contaba el trimestre pasado suele seguir sin contarse, y la PM lo revisa en
 * el paso 2. Devuelve el trimestre del que se ha copiado, o null si no había nada.
 */
export async function copiarNoReportar(ctx: UserContext, codigo: string, trimestre: string, informeId: string): Promise<R<string | null>> {
  const sb = getInformesSupabase(ctx);
  const { data: informes, error: e0 } = await sb.from("informe").select("id, trimestre").eq("codigo", codigo);
  if (e0) return { data: null, error: mensajeErrorBd(e0) };
  const anterior = (informes ?? [])
    .map((f) => ({ id: f.id as string, trimestre: f.trimestre as string }))
    .filter((f) => f.id !== informeId && compararTrimestres(f.trimestre, trimestre) < 0)
    .sort((a, b) => compararTrimestres(b.trimestre, a.trimestre))[0];
  if (!anterior) return { data: null, error: null };
  const { data: fuente, error: e1 } = await sb
    .from("informe_fuente")
    .select("texto")
    .eq("informe_id", anterior.id)
    .eq("tipo", "no_reportar")
    .maybeSingle();
  if (e1) return { data: null, error: mensajeErrorBd(e1) };
  const texto = ((fuente?.texto as string | undefined) ?? "").trim();
  if (!texto) return { data: null, error: null };
  const g = await guardarNoReportar(ctx, informeId, texto);
  if (g.error !== null) return { data: null, error: g.error };
  return { data: anterior.trimestre, error: null };
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
