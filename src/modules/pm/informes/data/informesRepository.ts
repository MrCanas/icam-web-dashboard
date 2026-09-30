import type { UserContext } from "@/lib/auth/currentUser";
import { withAudit } from "@/lib/audit/withAudit";

import { COLECCIONES } from "../logic/colecciones";
import { esTablaInexistente, mensajeErrorBd } from "../logic/errores";
import { proyectosConActivosPm } from "../logic/proyectos";
import type { ColeccionInforme, DocumentoApp, DocumentoConId } from "../types";
import { getInformesSupabase } from "./client";

/**
 * Almacén de documentos de la app de informes: la misma interfaz de colección
 * + documento que tenía la base de datos del artifact, sobre las tablas de la
 * migración 043.
 */

type Fila = Record<string, unknown> & { datos: DocumentoApp };
type Supabase = ReturnType<typeof getInformesSupabase>;

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
  // Los proyectos del dashboard se ofrecen aunque falte la tabla de
  // configuración: la PM tiene que poder ver y elegir su proyecto siempre.
  if (error && !(coleccion === "proyectos" && esTablaInexistente(error))) {
    return { data: [], error: mensajeErrorBd(error) };
  }

  const docs = ((data ?? []) as unknown as Fila[]).map((f) => ({
    id: String(f[def.clave]),
    datos: f.datos,
  }));

  if (coleccion !== "proyectos") return { data: docs, error: null };
  return { data: await conProyectosDelDashboard(supabase, docs), error: null };
}

/**
 * La lista de proyectos del paso 0 = los configurados para informe + todos los
 * activos de Proyectos (pm_activos) que aún no lo están. Como la mayoría de
 * activos no tiene nombre visible, se toma el de su proyecto de Actas.
 */
async function conProyectosDelDashboard(
  supabase: Supabase,
  configurados: DocumentoConId[],
): Promise<DocumentoConId[]> {
  const [{ data: activos, error }, { data: actas }] = await Promise.all([
    supabase
      .from("pm_activos")
      .select("id, id_activo, nombre_display, archivado_at")
      .is("archivado_at", null)
      .order("orden", { ascending: true }),
    supabase.from("project").select("code, name, pm_activo_id, archived_at"),
  ]);
  if (error) {
    console.error("[informes] pm_activos", error.message);
    return configurados;
  }

  const filas = (activos ?? []) as { id: string; id_activo: string; nombre_display: string | null }[];
  const proyectosActas = (actas ?? []) as { code: string; name: string | null; pm_activo_id: string | null; archived_at: string | null }[];
  const normal = (s: string) => s.toUpperCase().replace(/[^A-Z0-9]/g, "");
  const nombres: Record<string, string> = {};
  for (const a of filas) {
    const p =
      proyectosActas.find((x) => x.pm_activo_id === a.id && !x.archived_at) ??
      proyectosActas.find((x) => x.pm_activo_id == null && !x.archived_at && normal(x.code) === normal(a.id_activo));
    if (p?.name?.trim()) nombres[a.id_activo] = p.name.trim();
  }
  return proyectosConActivosPm(configurados, filas, nombres);
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
  if (error) return { data: null, error: mensajeErrorBd(error) };
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
      if (errExiste) return { error: mensajeErrorBd(errExiste) };

      const fila: Record<string, unknown> = {
        ...def.columnas(datos),
        datos,
      };
      if (def.tabla !== "informe_version") fila.updated_at = new Date().toISOString();
      if (def.autor.cambio) fila[def.autor.cambio] = ctx.id;

      if (existe) {
        const { error } = await supabase.from(def.tabla).update(fila).eq(def.clave, id);
        return { error: error ? mensajeErrorBd(error) : null };
      }
      if (def.autor.alta) fila[def.autor.alta] = ctx.id;
      fila[def.clave] = id;
      const { error } = await supabase.from(def.tabla).insert(fila);
      return { error: error ? mensajeErrorBd(error) : null };
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
      return { error: error ? mensajeErrorBd(error) : null };
    },
  );
}
