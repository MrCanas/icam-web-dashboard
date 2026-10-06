import type { UserContext } from "@/lib/auth/currentUser";
import { withAudit } from "@/lib/audit/withAudit";
import { isMissingTableError } from "@/lib/db/pgErrors";
import { getComunicacionesSupabase } from "@/modules/comunicaciones/data/readClient";
import {
  ESTADOS_EDITABLES,
  type Audiencia,
  type ComAjustesRow,
  type ComComunicacionRow,
  type ComDestinatarioRow,
  type DestinatarioCalculado,
  type RolContacto,
  type TipoComunicacion,
} from "@/modules/comunicaciones/types";

/**
 * Único sitio con acceso a las tablas `com_*`.
 *
 * Nada de lo que hay aquí envía un correo: son las comunicaciones preparadas y
 * la foto de sus destinatarios. Las lecturas degradan si la migración 047 no
 * está aplicada, en vez de reventar la página.
 */

export const FALTA_MIGRACION =
  "Las tablas de Comunicaciones no existen todavía. Falta aplicar la migración 047_comunicaciones.";

type Resultado<T> = ({ ok: true } & T) | { ok: false; error: string };

const AJUSTES_POR_DEFECTO: ComAjustesRow = {
  envios_activados: false,
  modo: "pruebas",
  cuenta_pruebas_zoho_id: null,
  remitentes_permitidos: [],
  dominios_internos: ["imparcapital.com"],
};

/** Los interruptores del módulo. Sin migración, todo cerrado. */
export async function leerAjustes(ctx: UserContext): Promise<ComAjustesRow> {
  const supabase = getComunicacionesSupabase(ctx);
  const { data, error } = await supabase
    .from("com_ajustes")
    .select("envios_activados, modo, cuenta_pruebas_zoho_id, remitentes_permitidos, dominios_internos")
    .maybeSingle();

  if (error) {
    if (isMissingTableError(error)) return AJUSTES_POR_DEFECTO;
    throw new Error(`com_ajustes: ${error.message}`);
  }
  return (data as ComAjustesRow | null) ?? AJUSTES_POR_DEFECTO;
}

// ---------------------------------------------------------------------------
// Lecturas
// ---------------------------------------------------------------------------

export interface ListaComunicaciones {
  comunicaciones: ComComunicacionRow[];
  /** Solo lo que hace falta para los totales del historial. */
  destinatarios: Pick<ComDestinatarioRow, "comunicacion_id" | "para" | "excluido">[];
  sinMigracion: boolean;
}

export async function listarComunicaciones(ctx: UserContext, limite = 100): Promise<ListaComunicaciones> {
  const supabase = getComunicacionesSupabase(ctx);
  const { data, error } = await supabase
    .from("com_comunicacion")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limite);

  if (error) {
    if (isMissingTableError(error)) return { comunicaciones: [], destinatarios: [], sinMigracion: true };
    throw new Error(`com_comunicacion: ${error.message}`);
  }
  const comunicaciones = (data ?? []) as ComComunicacionRow[];
  if (comunicaciones.length === 0) return { comunicaciones, destinatarios: [], sinMigracion: false };

  const destinatarios: ListaComunicaciones["destinatarios"] = [];
  const ids = comunicaciones.map((c) => c.id);
  // Supabase corta en 1.000 filas: se pagina, como en Inversores.
  for (let desde = 0; ; desde += 1000) {
    const { data: lote, error: errorDest } = await supabase
      .from("com_destinatario")
      .select("comunicacion_id, para, excluido")
      .in("comunicacion_id", ids)
      .range(desde, desde + 999);
    if (errorDest) throw new Error(`com_destinatario: ${errorDest.message}`);
    destinatarios.push(...((lote ?? []) as ListaComunicaciones["destinatarios"]));
    if ((lote ?? []).length < 1000) break;
  }

  return { comunicaciones, destinatarios, sinMigracion: false };
}

export interface ComunicacionCompleta {
  comunicacion: ComComunicacionRow;
  destinatarios: ComDestinatarioRow[];
}

export async function leerComunicacion(
  ctx: UserContext,
  id: string,
): Promise<ComunicacionCompleta | null> {
  const supabase = getComunicacionesSupabase(ctx);
  const { data, error } = await supabase.from("com_comunicacion").select("*").eq("id", id).maybeSingle();

  if (error) {
    // Un id que no es un uuid no es un fallo: es una URL mal escrita.
    if (isMissingTableError(error) || error.code === "22P02") return null;
    throw new Error(`com_comunicacion: ${error.message}`);
  }
  if (!data) return null;

  const destinatarios: ComDestinatarioRow[] = [];
  for (let desde = 0; ; desde += 1000) {
    const { data: lote, error: errorDest } = await supabase
      .from("com_destinatario")
      .select("*")
      .eq("comunicacion_id", id)
      .order("cuenta_nombre")
      .range(desde, desde + 999);
    if (errorDest) throw new Error(`com_destinatario: ${errorDest.message}`);
    destinatarios.push(...((lote ?? []) as ComDestinatarioRow[]));
    if ((lote ?? []).length < 1000) break;
  }

  return { comunicacion: data as ComComunicacionRow, destinatarios };
}

// ---------------------------------------------------------------------------
// Escrituras
// ---------------------------------------------------------------------------

export interface NuevaComunicacion {
  nombre: string;
  tipo: TipoComunicacion;
  audiencia: Audiencia;
  promocionZohoId: string | null;
  promocionNombre: string | null;
  rolesPara: RolContacto[];
  rolesCopia: RolContacto[];
  datosZohoAt: string | null;
}

/**
 * Guarda la comunicación y la foto de sus destinatarios.
 *
 * Son dos inserciones y PostgREST no las mete en una transacción. Si la segunda
 * falla se borra la primera: una comunicación sin destinatarios parecería
 * preparada y vacía, que es peor que no existir.
 */
export async function crearComunicacion(
  ctx: UserContext,
  nueva: NuevaComunicacion,
  destinatarios: readonly DestinatarioCalculado[],
): Promise<Resultado<{ id: string }>> {
  return withAudit(
    ctx,
    "comunicaciones.comunicacion.create",
    {
      resourceType: "com_comunicacion",
      payload: {
        nombre: nueva.nombre,
        audiencia: nueva.audiencia,
        promocion: nueva.promocionNombre,
        destinatarios: destinatarios.length,
      },
    },
    async (): Promise<Resultado<{ id: string }>> => {
      const supabase = getComunicacionesSupabase(ctx);
      const { data, error } = await supabase
        .from("com_comunicacion")
        .insert({
          nombre: nueva.nombre,
          tipo: nueva.tipo,
          audiencia: nueva.audiencia,
          promocion_zoho_id: nueva.promocionZohoId,
          promocion_nombre: nueva.promocionNombre,
          roles_para: nueva.rolesPara,
          roles_copia: nueva.rolesCopia,
          datos_zoho_at: nueva.datosZohoAt,
          creada_por: ctx.id,
          creada_por_email: ctx.email,
        })
        .select("id")
        .single();

      if (error) {
        return { ok: false, error: isMissingTableError(error) ? FALTA_MIGRACION : error.message };
      }
      const id = (data as { id: string }).id;

      const filas = destinatarios.map((d) => ({
        comunicacion_id: id,
        cuenta_zoho_id: d.cuentaZohoId,
        cuenta_nombre: d.cuentaNombre,
        para: d.para,
        copia: d.copia,
        avisos: d.avisos,
        excluido: d.excluido,
        excluido_motivo: d.excluidoMotivo,
        estado_envio: d.para.length === 0 ? "sin_destinatario" : "pendiente",
      }));
      for (let i = 0; i < filas.length; i += 500) {
        const { error: errorDest } = await supabase.from("com_destinatario").insert(filas.slice(i, i + 500));
        if (errorDest) {
          await supabase.from("com_comunicacion").delete().eq("id", id);
          return { ok: false, error: `No se pudieron guardar los destinatarios: ${errorDest.message}` };
        }
      }
      return { ok: true, id };
    },
  );
}

/** La comunicación, solo si todavía se puede tocar. */
async function leerEditable(
  ctx: UserContext,
  id: string,
): Promise<Resultado<{ comunicacion: ComComunicacionRow }>> {
  const supabase = getComunicacionesSupabase(ctx);
  const { data, error } = await supabase.from("com_comunicacion").select("*").eq("id", id).maybeSingle();
  if (error) return { ok: false, error: isMissingTableError(error) ? FALTA_MIGRACION : error.message };
  if (!data) return { ok: false, error: "La comunicación no existe." };
  const comunicacion = data as ComComunicacionRow;
  if (!ESTADOS_EDITABLES.includes(comunicacion.estado)) {
    return { ok: false, error: "Esta comunicación ya no se puede modificar." };
  }
  return { ok: true, comunicacion };
}

/**
 * Excluye o vuelve a incluir un destinatario.
 *
 * Cambiar la lista invalida los controles ya pasados: la comunicación vuelve a
 * borrador y hay que revisarla (y probarla) otra vez. Lo que se revisó ya no es
 * lo que se enviaría.
 */
export async function cambiarExclusion(
  ctx: UserContext,
  comunicacionId: string,
  destinatarioId: string,
  excluido: boolean,
  motivo: string | null,
): Promise<Resultado<object>> {
  const editable = await leerEditable(ctx, comunicacionId);
  if (!editable.ok) return editable;

  return withAudit(
    ctx,
    excluido ? "comunicaciones.destinatario.excluir" : "comunicaciones.destinatario.incluir",
    {
      resourceType: "com_destinatario",
      resourceId: destinatarioId,
      payload: { comunicacionId, motivo },
    },
    async (): Promise<Resultado<object>> => {
      const supabase = getComunicacionesSupabase(ctx);
      const { data, error } = await supabase
        .from("com_destinatario")
        .update({
          excluido,
          excluido_motivo: excluido ? (motivo ?? "Excluido a mano") : null,
          excluido_por_email: excluido ? ctx.email : null,
        })
        .eq("id", destinatarioId)
        .eq("comunicacion_id", comunicacionId)
        .select("id");
      if (error) return { ok: false, error: error.message };
      if ((data ?? []).length === 0) return { ok: false, error: "El destinatario no existe." };

      const { error: errorCom } = await supabase
        .from("com_comunicacion")
        .update({
          estado: "borrador",
          revisada_por_email: null,
          revisada_at: null,
          revisada_n: null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", comunicacionId);
      if (errorCom) return { ok: false, error: errorCom.message };
      return { ok: true };
    },
  );
}

/** Recuerda qué plantilla de Zoho se ha elegido. Cambiarla invalida la prueba. */
export async function guardarPlantilla(
  ctx: UserContext,
  comunicacionId: string,
  plantilla: { id: string; nombre: string; modulo: string | null },
): Promise<Resultado<object>> {
  const editable = await leerEditable(ctx, comunicacionId);
  if (!editable.ok) return editable;

  return withAudit(
    ctx,
    "comunicaciones.comunicacion.plantilla",
    {
      resourceType: "com_comunicacion",
      resourceId: comunicacionId,
      payload: { plantillaId: plantilla.id, plantilla: plantilla.nombre },
    },
    async (): Promise<Resultado<object>> => {
      const supabase = getComunicacionesSupabase(ctx);
      const { error } = await supabase
        .from("com_comunicacion")
        .update({
          plantilla_id: plantilla.id,
          plantilla_nombre: plantilla.nombre,
          plantilla_modulo: plantilla.modulo,
          // Una prueba hecha con otra plantilla no vale para esta.
          estado: editable.comunicacion.estado === "probada" ? "revisada" : editable.comunicacion.estado,
          probada_por_email: null,
          probada_at: null,
          probada_plantilla_id: null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", comunicacionId);
      if (error) return { ok: false, error: error.message };
      return { ok: true };
    },
  );
}

/** Descarta una comunicación sin enviar. No borra nada: queda en el historial como cancelada. */
export async function cancelarComunicacion(
  ctx: UserContext,
  comunicacionId: string,
): Promise<Resultado<object>> {
  const editable = await leerEditable(ctx, comunicacionId);
  if (!editable.ok) return editable;

  return withAudit(
    ctx,
    "comunicaciones.comunicacion.cancelar",
    { resourceType: "com_comunicacion", resourceId: comunicacionId, payload: {} },
    async (): Promise<Resultado<object>> => {
      const supabase = getComunicacionesSupabase(ctx);
      const { error } = await supabase
        .from("com_comunicacion")
        .update({ estado: "cancelada", updated_at: new Date().toISOString() })
        .eq("id", comunicacionId);
      if (error) return { ok: false, error: error.message };
      return { ok: true };
    },
  );
}
