import type { UserContext } from "@/lib/auth/currentUser";
import { withAudit } from "@/lib/audit/withAudit";

import { COLECCIONES } from "../logic/colecciones";
import { proyectosConActivosPm } from "../logic/proyectos";
import type { ColeccionInforme, DocumentoApp, DocumentoConId } from "../types";
import { getInformesSupabase } from "./client";

/**
 * Almacén de documentos de la app de informes: la misma interfaz de colección
 * + documento que tenía la base de datos del artifact, sobre las tablas de la
 * migración 043.
 */

type Fila = Record<string, unknown> & { datos: DocumentoApp };

export async function listarDocumentos(
  ctx: UserContext,
  coleccion: ColeccionInforme,
  filtro?: { campo: string; valor: string },
): Promise<{ data: DocumentoConId[]; error: string | null }> {
  const def = COLECCIONES[coleccion];
  const supabase = getInformesSupabase(ctx);

  let consulta = supabase.from(def.tabla).select(`${def.clave}, datos`);
  if (filtro) {
    const columna = def.filtros[filtro.campo];
    if (!columna) return { data: [], error: `No se puede filtrar ${coleccion} por ${filtro.campo}` };
    consulta = consulta.eq(columna, filtro.valor);
  }
  const { data, error } = await consulta;
  if (error) return { data: [], error: error.message };

  const docs = ((data ?? []) as unknown as Fila[]).map((f) => ({
    id: String(f[def.clave]),
    datos: f.datos,
  }));

  if (coleccion !== "proyectos") return { data: docs, error: null };

  // La lista de proyectos del paso 0 también ofrece los activos PM que aún no
  // tienen configuración de informe: así la PM no tiene que teclear el código.
  const { data: activos, error: errActivos } = await supabase
    .from("pm_activos")
    .select("id_activo, nombre_display, archivado_at")
    .is("archivado_at", null)
    .order("orden", { ascending: true });
  if (errActivos) return { data: docs, error: null };
  return {
    data: proyectosConActivosPm(
      docs,
      (activos ?? []) as { id_activo: string; nombre_display: string | null }[],
    ),
    error: null,
  };
}

export async function obtenerDocumento(
  ctx: UserContext,
  coleccion: ColeccionInforme,
  id: string,
): Promise<{ data: DocumentoApp | null; error: string | null }> {
  const def = COLECCIONES[coleccion];
  const supabase = getInformesSupabase(ctx);
  const { data, error } = await supabase
    .from(def.tabla)
    .select("datos")
    .eq(def.clave, id)
    .maybeSingle();
  if (error) return { data: null, error: error.message };
  return { data: ((data as Fila | null)?.datos ?? null) as DocumentoApp | null, error: null };
}

export async function guardarDocumento(
  ctx: UserContext,
  coleccion: ColeccionInforme,
  id: string,
  datos: DocumentoApp,
): Promise<{ error: string | null }> {
  const def = COLECCIONES[coleccion];
  return withAudit(
    ctx,
    `pm.informe.${coleccion}.set`,
    { resourceType: def.tabla, resourceId: id },
    async () => {
      const supabase = getInformesSupabase(ctx);
      const { data: existe, error: errExiste } = await supabase
        .from(def.tabla)
        .select(def.clave)
        .eq(def.clave, id)
        .maybeSingle();
      if (errExiste) return { error: errExiste.message };

      const fila: Record<string, unknown> = {
        ...def.columnas(datos),
        datos,
      };
      if (def.tabla !== "informe_version") fila.updated_at = new Date().toISOString();
      if (def.autor.cambio) fila[def.autor.cambio] = ctx.id;

      if (existe) {
        const { error } = await supabase.from(def.tabla).update(fila).eq(def.clave, id);
        return { error: error?.message ?? null };
      }
      if (def.autor.alta) fila[def.autor.alta] = ctx.id;
      fila[def.clave] = id;
      const { error } = await supabase.from(def.tabla).insert(fila);
      return { error: error?.message ?? null };
    },
  );
}

export async function borrarDocumento(
  ctx: UserContext,
  coleccion: ColeccionInforme,
  id: string,
): Promise<{ error: string | null }> {
  const def = COLECCIONES[coleccion];
  return withAudit(
    ctx,
    `pm.informe.${coleccion}.delete`,
    { resourceType: def.tabla, resourceId: id },
    async () => {
      const supabase = getInformesSupabase(ctx);
      const { error } = await supabase.from(def.tabla).delete().eq(def.clave, id);
      return { error: error?.message ?? null };
    },
  );
}
