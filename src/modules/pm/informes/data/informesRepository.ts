import type { UserContext } from "@/lib/auth/currentUser";
import { withAudit } from "@/lib/audit/withAudit";

import { mensajeErrorBd } from "../logic/errores";
import { nombresDeActivos, proyectosParaInforme, type ActivoPm, type ProyectoActas } from "../logic/proyectos";
import { compararTrimestres, idInforme, qAnt, qSig } from "../logic/trimestre";
import type { InformeJson, Pie } from "../slides/tipos";
import type {
  Analisis,
  Arquetipo,
  BaseInforme,
  Cambio,
  EstadoInforme,
  Informe,
  InformeResumen,
  PrevioCandidato,
  PrevioEstructurado,
  ProyectoInforme,
  QaInforme,
  Seleccion,
  VersionGuardada,
} from "../types";
import { getInformesSupabase, INFORMES_FOTOS_BUCKET } from "./client";

type R<T> = { data: T; error: null } | { data: null; error: string };

interface FilaProyecto {
  codigo: string;
  id_activo: string | null;
  nombre: string;
  arquetipo: Arquetipo;
  pie: Pie | null;
}

interface FilaInforme {
  id: string;
  codigo: string;
  trimestre: string;
  trimestre_anterior: string;
  siguiente: string;
  estado: EstadoInforme;
  version: number;
  base: BaseInforme | null;
  analisis: Analisis | null;
  seleccion: Seleccion | null;
  contenido: InformeJson | null;
  qa: QaInforme | null;
  updated_at: string;
}

function aProyecto(f: FilaProyecto): ProyectoInforme {
  return { codigo: f.codigo, idActivo: f.id_activo, nombre: f.nombre, arquetipo: f.arquetipo, pie: f.pie, configurado: true };
}

/* ------------------------------------------------------------------ proyectos */

/** Proyectos configurados para informe + activos PM no archivados que todavía no lo están. */
export async function listarProyectos(ctx: UserContext): Promise<R<ProyectoInforme[]>> {
  const sb = getInformesSupabase(ctx);
  const [conf, activos, actas] = await Promise.all([
    sb.from("informe_proyecto").select("codigo, id_activo, nombre, arquetipo, pie"),
    sb.from("pm_activos").select("id, id_activo, nombre_display").is("archivado_at", null).order("orden", { ascending: true }),
    sb.from("project").select("code, name, pm_activo_id, archived_at"),
  ]);
  if (conf.error) return { data: null, error: mensajeErrorBd(conf.error) };
  if (activos.error) return { data: null, error: activos.error.message };
  const filasActivos = (activos.data ?? []) as ActivoPm[];
  const nombres = nombresDeActivos(filasActivos, (actas.data ?? []) as ProyectoActas[]);
  return {
    data: proyectosParaInforme(((conf.data ?? []) as FilaProyecto[]).map(aProyecto), filasActivos, nombres),
    error: null,
  };
}

export async function obtenerProyecto(ctx: UserContext, codigo: string): Promise<R<ProyectoInforme | null>> {
  const { data, error } = await getInformesSupabase(ctx)
    .from("informe_proyecto")
    .select("codigo, id_activo, nombre, arquetipo, pie")
    .eq("codigo", codigo)
    .maybeSingle();
  if (error) return { data: null, error: mensajeErrorBd(error) };
  return { data: data ? aProyecto(data as FilaProyecto) : null, error: null };
}

export async function guardarProyecto(
  ctx: UserContext,
  p: { codigo: string; nombre: string; idActivo: string | null; arquetipo: Arquetipo; pie: Pie | null },
): Promise<R<ProyectoInforme>> {
  const fila = {
    codigo: p.codigo,
    nombre: p.nombre,
    id_activo: p.idActivo,
    arquetipo: p.arquetipo,
    pie: p.pie,
    updated_by: ctx.id,
    updated_at: new Date().toISOString(),
  };
  const { data, error } = await withAudit(
    ctx,
    "pm.informe.proyecto.upsert",
    { resourceType: "informe_proyecto", resourceId: p.codigo, payload: { idActivo: p.idActivo, arquetipo: p.arquetipo } },
    async () =>
      getInformesSupabase(ctx)
        .from("informe_proyecto")
        .upsert(fila, { onConflict: "codigo" })
        .select("codigo, id_activo, nombre, arquetipo, pie")
        .single(),
  );
  if (error) {
    if (error.code === "23505") return { data: null, error: "Ese activo ya está vinculado a otro proyecto de informes." };
    return { data: null, error: mensajeErrorBd(error) };
  }
  return { data: aProyecto(data as FilaProyecto), error: null };
}

/* ------------------------------------------------------------------ informes */

const COLUMNAS_INFORME =
  "id, codigo, trimestre, trimestre_anterior, siguiente, estado, version, base, analisis, seleccion, contenido, qa, updated_at";

export async function listarInformes(ctx: UserContext, opciones: { idActivo?: string } = {}): Promise<R<InformeResumen[]>> {
  const sb = getInformesSupabase(ctx);
  const { data: proyectos, error: e1 } = await sb.from("informe_proyecto").select("codigo, id_activo, nombre");
  if (e1) return { data: null, error: mensajeErrorBd(e1) };
  const porCodigo = new Map((proyectos ?? []).map((p) => [p.codigo as string, p as { codigo: string; id_activo: string | null; nombre: string }]));
  let q = sb.from("informe").select("id, codigo, trimestre, estado, version, updated_at").order("updated_at", { ascending: false });
  if (opciones.idActivo) {
    const codigos = [...porCodigo.values()].filter((p) => p.id_activo === opciones.idActivo).map((p) => p.codigo);
    if (!codigos.length) return { data: [], error: null };
    q = q.in("codigo", codigos);
  }
  const { data, error } = await q;
  if (error) return { data: null, error: mensajeErrorBd(error) };
  return {
    data: (data ?? []).map((f) => {
      const p = porCodigo.get(f.codigo as string);
      return {
        id: f.id as string,
        codigo: f.codigo as string,
        proyecto: p?.nombre ?? (f.codigo as string),
        idActivo: p?.id_activo ?? null,
        trimestre: f.trimestre as string,
        estado: f.estado as EstadoInforme,
        version: f.version as number,
        actualizado: f.updated_at as string,
      };
    }),
    error: null,
  };
}

export async function obtenerInforme(ctx: UserContext, id: string): Promise<R<Informe | null>> {
  const sb = getInformesSupabase(ctx);
  const { data, error } = await sb.from("informe").select(COLUMNAS_INFORME).eq("id", id).maybeSingle();
  if (error) return { data: null, error: mensajeErrorBd(error) };
  if (!data) return { data: null, error: null };
  const f = data as FilaInforme;
  const proyecto = await obtenerProyecto(ctx, f.codigo);
  if (proyecto.error) return { data: null, error: proyecto.error };
  return {
    data: {
      id: f.id,
      codigo: f.codigo,
      proyecto: proyecto.data ?? { codigo: f.codigo, idActivo: null, nombre: f.codigo, arquetipo: "A", pie: null, configurado: true },
      trimestre: f.trimestre,
      trimestreAnterior: f.trimestre_anterior,
      siguiente: f.siguiente,
      estado: f.estado,
      version: f.version,
      base: f.base,
      analisis: f.analisis,
      seleccion: f.seleccion,
      contenido: f.contenido,
      qa: f.qa,
      actualizado: f.updated_at,
    },
    error: null,
  };
}

/** Crea el informe del trimestre (estado «datos»). Si ya existe, devuelve su id sin tocarlo. */
export async function crearInforme(
  ctx: UserContext,
  codigo: string,
  trimestre: string,
): Promise<R<{ id: string; existia: boolean }>> {
  const id = idInforme(codigo, trimestre);
  const sb = getInformesSupabase(ctx);
  const { data: ya, error: e0 } = await sb.from("informe").select("id").eq("id", id).maybeSingle();
  if (e0) return { data: null, error: mensajeErrorBd(e0) };
  if (ya) return { data: { id, existia: true }, error: null };
  const { error } = await withAudit(
    ctx,
    "pm.informe.create",
    { resourceType: "informe", resourceId: id, payload: { codigo, trimestre } },
    async () =>
      sb.from("informe").insert({
        id,
        codigo,
        trimestre,
        trimestre_anterior: qAnt(trimestre),
        siguiente: qSig(trimestre),
        estado: "datos",
        version: 1,
        created_by: ctx.id,
        updated_by: ctx.id,
      }),
  );
  if (error) return { data: null, error: mensajeErrorBd(error) };
  return { data: { id, existia: false }, error: null };
}

export interface CambiosInforme {
  estado?: EstadoInforme;
  version?: number;
  /** Trimestre del informe anterior elegido: el de Q-1 salvo que la PM parta de otro. */
  trimestreAnterior?: string;
  base?: BaseInforme | null;
  analisis?: Analisis | null;
  seleccion?: Seleccion | null;
  contenido?: InformeJson | null;
  qa?: QaInforme | null;
}

export async function actualizarInforme(ctx: UserContext, id: string, cambios: CambiosInforme): Promise<R<{ actualizado: string }>> {
  const fila: Record<string, unknown> = { updated_by: ctx.id, updated_at: new Date().toISOString() };
  for (const [k, v] of Object.entries(cambios)) {
    if (v !== undefined) fila[k === "trimestreAnterior" ? "trimestre_anterior" : k] = v;
  }
  const { data, error } = await withAudit(
    ctx,
    "pm.informe.update",
    { resourceType: "informe", resourceId: id, payload: { campos: Object.keys(cambios), estado: cambios.estado } },
    async () => getInformesSupabase(ctx).from("informe").update(fila).eq("id", id).select("updated_at").maybeSingle(),
  );
  if (error) return { data: null, error: mensajeErrorBd(error) };
  if (!data) return { data: null, error: "El informe ya no existe." };
  return { data: { actualizado: data.updated_at as string }, error: null };
}

/** Borra el informe con sus fuentes, fotos (y sus ficheros), versiones y cambios. */
export async function borrarInforme(ctx: UserContext, id: string): Promise<R<null>> {
  const sb = getInformesSupabase(ctx);
  const { data: fotos, error: e1 } = await sb.from("informe_foto").select("storage_path").eq("informe_id", id);
  if (e1) return { data: null, error: mensajeErrorBd(e1) };
  const { error } = await withAudit(
    ctx,
    "pm.informe.delete",
    { resourceType: "informe", resourceId: id, payload: { fotos: fotos?.length ?? 0 } },
    async () => sb.from("informe").delete().eq("id", id),
  );
  if (error) return { data: null, error: mensajeErrorBd(error) };
  const rutas = (fotos ?? []).map((f) => f.storage_path as string);
  if (rutas.length) {
    const { error: e2 } = await sb.storage.from(INFORMES_FOTOS_BUCKET).remove(rutas);
    if (e2) console.error("[informes] borrar fotos", e2.message);
  }
  return { data: null, error: null };
}

/**
 * Informes del proyecto que pueden hacer de informe anterior del trimestre
 * dado: los de trimestres previos que ya tienen slides, del más reciente al
 * más antiguo.
 */
export async function listarPrevios(ctx: UserContext, codigo: string, trimestre: string): Promise<R<PrevioCandidato[]>> {
  const { data, error } = await getInformesSupabase(ctx)
    .from("informe")
    .select("id, trimestre, estado, version, updated_at, contenido")
    .eq("codigo", codigo);
  if (error) return { data: null, error: mensajeErrorBd(error) };
  const candidatos: PrevioCandidato[] = [];
  for (const f of data ?? []) {
    const slides = (f.contenido as InformeJson | null)?.slides?.length ?? 0;
    if (!slides || compararTrimestres(f.trimestre as string, trimestre) >= 0) continue;
    candidatos.push({
      id: f.id as string,
      trimestre: f.trimestre as string,
      estado: f.estado as EstadoInforme,
      version: f.version as number,
      slides,
      actualizado: f.updated_at as string,
    });
  }
  candidatos.sort((a, b) => compararTrimestres(b.trimestre, a.trimestre));
  return { data: candidatos, error: null };
}

/** Informe anterior elegido (uno del mismo proyecto guardado en el portal), si tiene slides. */
export async function obtenerPrevio(ctx: UserContext, codigo: string, id: string): Promise<R<PrevioEstructurado | null>> {
  const { data, error } = await getInformesSupabase(ctx)
    .from("informe")
    .select("id, version, contenido")
    .eq("id", id)
    .eq("codigo", codigo)
    .maybeSingle();
  if (error) return { data: null, error: mensajeErrorBd(error) };
  const contenido = data?.contenido as InformeJson | null | undefined;
  if (!data || !contenido?.slides?.length) return { data: null, error: null };
  return { data: { id, version: data.version as number, meta: contenido.meta, slides: contenido.slides }, error: null };
}

/* ------------------------------------------------------------------ historial y versiones */

export async function anotarCambio(ctx: UserContext, informeId: string, texto: string): Promise<void> {
  const { error } = await getInformesSupabase(ctx)
    .from("informe_cambio")
    .insert({ informe_id: informeId, texto: texto.slice(0, 2000), user_id: ctx.id });
  if (error) console.error("[informes] anotar cambio", error.message);
}

export async function listarCambios(ctx: UserContext, informeId: string): Promise<R<Cambio[]>> {
  const sb = getInformesSupabase(ctx);
  const { data, error } = await sb
    .from("informe_cambio")
    .select("id, texto, created_at, user_id")
    .eq("informe_id", informeId)
    .order("created_at", { ascending: false })
    .limit(200);
  if (error) return { data: null, error: mensajeErrorBd(error) };
  const ids = [...new Set((data ?? []).map((c) => c.user_id as string | null).filter((x): x is string => !!x))];
  const autores = new Map<string, string>();
  if (ids.length) {
    // Pocos autores por informe: se resuelven uno a uno contra auth.users.
    const usuarios = await Promise.all(ids.map((uid) => sb.auth.admin.getUserById(uid)));
    usuarios.forEach((u, i) => {
      const meta = u.data.user?.user_metadata as Record<string, unknown> | undefined;
      const nombre = typeof meta?.name === "string" && meta.name.trim() ? meta.name.trim() : u.data.user?.email?.split("@")[0];
      if (nombre) autores.set(ids[i]!, nombre);
    });
  }
  return {
    data: (data ?? []).map((c) => ({
      id: c.id as number,
      texto: c.texto as string,
      fecha: c.created_at as string,
      autor: c.user_id ? (autores.get(c.user_id as string) ?? null) : null,
    })),
    error: null,
  };
}

/** Guarda una instantánea de la versión actual y pasa a trabajar en la siguiente. */
export async function guardarVersion(ctx: UserContext, informe: Informe): Promise<R<{ version: number }>> {
  if (!informe.contenido) return { data: null, error: "El informe todavía no tiene slides." };
  const sb = getInformesSupabase(ctx);
  const v = informe.version;
  const { error } = await withAudit(
    ctx,
    "pm.informe.version",
    { resourceType: "informe", resourceId: informe.id, payload: { version: v } },
    async () =>
      sb.from("informe_version").upsert(
        { informe_id: informe.id, version: v, contenido: informe.contenido, estado: informe.estado, created_by: ctx.id },
        { onConflict: "informe_id,version" },
      ),
  );
  if (error) return { data: null, error: mensajeErrorBd(error) };
  const siguiente = v + 1;
  const contenido: InformeJson = { ...informe.contenido, meta: { ...informe.contenido.meta, version: `v${siguiente}` } };
  const act = await actualizarInforme(ctx, informe.id, { version: siguiente, contenido });
  if (act.error) return { data: null, error: act.error };
  return { data: { version: siguiente }, error: null };
}

export async function listarVersiones(ctx: UserContext, informeId: string): Promise<R<VersionGuardada[]>> {
  const { data, error } = await getInformesSupabase(ctx)
    .from("informe_version")
    .select("version, estado, created_at")
    .eq("informe_id", informeId)
    .order("version", { ascending: false });
  if (error) return { data: null, error: mensajeErrorBd(error) };
  return {
    data: (data ?? []).map((v) => ({ version: v.version as number, estado: v.estado as string, fecha: v.created_at as string })),
    error: null,
  };
}
