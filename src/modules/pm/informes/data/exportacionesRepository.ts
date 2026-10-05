import type { UserContext } from "@/lib/auth/currentUser";
import { withAudit } from "@/lib/audit/withAudit";

import { mensajeErrorBd } from "../logic/errores";
import type { Exportacion, IncidenciaExportacion, MedioExportacion } from "../types";
import { getInformesSupabase } from "./client";

type R<T> = { data: T; error: null } | { data: null; error: string };

/** Falta la migración 046: el mensaje dice qué hay que aplicar. */
function sinTabla(error: { code?: string; message?: string }): string | null {
  return error.code === "42P01" || /informe_exportacion/.test(error.message ?? "") && /does not exist|no existe/.test(error.message ?? "")
    ? "Falta la tabla informe_exportacion: aplica la migración 046 (npm run pm:apply-migration-046 -- --apply)."
    : null;
}

/**
 * Anota una exportación del informe: quién, cuándo, por qué medio, qué listó el
 * validador y si hubo que marcar «Estoy seguro». Se guarda el nombre y el
 * correo de entonces, para que el registro no cambie con el usuario.
 */
export async function registrarExportacion(
  ctx: UserContext,
  informe: { id: string; version: number; estado: string },
  datos: { medio: MedioExportacion; incidencias: IncidenciaExportacion[]; confirmado: boolean },
): Promise<R<Exportacion>> {
  const fila = {
    informe_id: informe.id,
    user_id: ctx.id,
    usuario_nombre: ctx.name,
    usuario_email: ctx.email,
    medio: datos.medio,
    version: informe.version,
    estado: informe.estado,
    incidencias: datos.incidencias,
    confirmado: datos.confirmado,
  };
  const { data, error } = await withAudit(
    ctx,
    "pm.informe.exportar",
    { resourceType: "informe", resourceId: informe.id, payload: { medio: datos.medio, incidencias: datos.incidencias.length, confirmado: datos.confirmado } },
    async () => getInformesSupabase(ctx).from("informe_exportacion").insert(fila).select("id, created_at").single(),
  );
  if (error) return { data: null, error: sinTabla(error) ?? mensajeErrorBd(error) };
  return {
    data: {
      id: data.id as number,
      fecha: data.created_at as string,
      usuario: ctx.name,
      email: ctx.email,
      medio: datos.medio,
      version: informe.version,
      estado: informe.estado,
      incidencias: datos.incidencias,
      confirmado: datos.confirmado,
    },
    error: null,
  };
}

/** Exportaciones de un informe, de la más reciente a la más antigua. */
export async function listarExportaciones(ctx: UserContext, informeId: string): Promise<R<Exportacion[]>> {
  const { data, error } = await getInformesSupabase(ctx)
    .from("informe_exportacion")
    .select("id, created_at, usuario_nombre, usuario_email, medio, version, estado, incidencias, confirmado")
    .eq("informe_id", informeId)
    .order("created_at", { ascending: false })
    .limit(200);
  if (error) return { data: null, error: sinTabla(error) ?? mensajeErrorBd(error) };
  return {
    data: (data ?? []).map((e) => ({
      id: e.id as number,
      fecha: e.created_at as string,
      usuario: (e.usuario_nombre as string) || (e.usuario_email as string).split("@")[0] || "",
      email: e.usuario_email as string,
      medio: e.medio as MedioExportacion,
      version: e.version as number,
      estado: e.estado as string,
      incidencias: Array.isArray(e.incidencias) ? (e.incidencias as IncidenciaExportacion[]) : [],
      confirmado: !!e.confirmado,
    })),
    error: null,
  };
}
