import type { UserContext } from "@/lib/auth/currentUser";
import { fetchActasActaView } from "@/modules/pm/actas/data/actaRepository";
import { fetchActasLinkForPmActivo } from "@/modules/pm/actas/data/actasRepository";
import { formatCategoryDisplayName } from "@/modules/pm/actas/logic/actas-category-display";
import { toElementStatus } from "@/modules/pm/actas/logic/element-status";
import { asOfDateToTimestamptz } from "@/modules/pm/actas/logic/operativo-asof";
import { fetchAvanceObraAFecha } from "@/modules/pm/avance/data/avanceRepository";
import { fetchPmPortfolio } from "@/modules/pm/data/pmRepository";

import { formatearActas, type EstadoElemento } from "../logic/fuentes-actas";
import { formatearPlanificacion } from "../logic/fuentes-planificacion";
import { rangoTrimestre, trimestreAnterior, type Trimestre } from "../logic/trimestre";
import type { FuenteAutomatica, FuentesAutomaticasResultado, TipoFuenteAuto } from "../types";
import { getInformesSupabase } from "./client";

/**
 * Fuentes del portal del paso 2 de la app: las actas del trimestre y la
 * planificación del activo, que se incorporan si la PM lo pide. Cada una falla
 * por separado: si una no se puede leer, la otra llega igual y la PM ve un aviso.
 */

function diaAnterior(ymd: string): string {
  const d = new Date(`${ymd}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
}

async function estadosAFecha(
  ctx: UserContext,
  projectId: string,
  ymd: string,
): Promise<EstadoElemento[]> {
  // Mismo RPC y mismo corte de fin de día que la vista «a fecha» del Operativo.
  const { data, error } = await getInformesSupabase(ctx).rpc("reconstruct_project_at_date", {
    p_project_id: projectId,
    p_as_of_date: asOfDateToTimestamptz(ymd),
  });
  if (error) throw new Error(error.message);
  return ((data ?? []) as {
    element_id: string;
    element_name: string;
    category_id: string;
    status_at_date: string | null;
  }[]).map((r) => ({
    elementId: r.element_id,
    nombre: r.element_name,
    categoriaId: r.category_id,
    estado: r.status_at_date ? toElementStatus(r.status_at_date) : null,
  }));
}

async function fuenteActas(
  ctx: UserContext,
  idActivo: string,
  trimestre: Trimestre,
  etiqueta: string,
): Promise<{ doc: FuenteAutomatica | null; aviso: string | null }> {
  const link = await fetchActasLinkForPmActivo(ctx, idActivo);
  if (!link) {
    return { doc: null, aviso: `El activo ${idActivo} no tiene proyecto de Actas vinculado: no se han podido cargar las actas.` };
  }
  const supabase = getInformesSupabase(ctx);
  const { data: proyecto, error } = await supabase
    .from("project")
    .select("id, code, name")
    .eq("code", link.code)
    .maybeSingle();
  if (error || !proyecto) {
    return { doc: null, aviso: `No se ha podido leer el proyecto de Actas ${link.code}.` };
  }

  const { desde, hasta } = rangoTrimestre(trimestre);
  const [vista, inicio, cierre, categorias] = await Promise.all([
    fetchActasActaView(ctx, { projectId: proyecto.id as string, dateFrom: desde, dateTo: hasta }),
    estadosAFecha(ctx, proyecto.id as string, diaAnterior(desde)),
    estadosAFecha(ctx, proyecto.id as string, hasta),
    supabase
      .from("category")
      .select("id, name, sublot_label")
      .eq("project_id", proyecto.id as string),
  ]);
  if (vista.error || !vista.data) {
    return { doc: null, aviso: `No se han podido leer las actas de ${link.code}: ${vista.error ?? "sin datos"}.` };
  }

  const nombresCategoria: Record<string, string> = {};
  for (const c of (categorias.data ?? []) as { id: string; name: string; sublot_label: string | null }[]) {
    nombresCategoria[c.id] = formatCategoryDisplayName(c.name, c.sublot_label);
  }

  const texto = formatearActas({
    proyecto: { code: proyecto.code as string, name: proyecto.name as string },
    trimestre: etiqueta,
    desde,
    hasta,
    vista: vista.data,
    estadoInicio: inicio,
    estadoCierre: cierre,
    categorias: nombresCategoria,
  });
  return {
    doc: { tipo: "actas", nombre: `Actas ${etiqueta} · ${proyecto.code} (portal)`, texto },
    aviso: link.archived ? `El proyecto de Actas ${link.code} está archivado.` : null,
  };
}

async function fuentePlanificacion(
  ctx: UserContext,
  idActivo: string,
  trimestre: Trimestre,
  etiqueta: string,
): Promise<{ doc: FuenteAutomatica | null; aviso: string | null }> {
  // Todos los snapshots, publicados o no: el informe es interno hasta que se
  // aprueba y necesita la previsión del trimestre anterior aunque no se publique.
  const { rows, error } = await fetchPmPortfolio(ctx, {
    soloIdActivo: idActivo,
    soloPublicados: false,
    incluirActivosArchivados: true,
  });
  const row = rows[0];
  if (error || !row) {
    return { doc: null, aviso: `No se ha podido leer la planificación de ${idActivo}${error ? `: ${error}` : ""}.` };
  }
  const { hasta } = rangoTrimestre(trimestre);
  const hastaAnterior = rangoTrimestre(trimestreAnterior(trimestre)).hasta;
  const [avance, avanceAnterior] = await Promise.all([
    fetchAvanceObraAFecha(ctx, idActivo, hasta),
    fetchAvanceObraAFecha(ctx, idActivo, hastaAnterior),
  ]);

  const texto = formatearPlanificacion({
    row,
    trimestre,
    hasta,
    avanceCierre: avance.data,
    avanceCierreAnterior: avanceAnterior.data,
  });
  return {
    doc: { tipo: "planificacion", nombre: `Planificación y avance ${etiqueta} · ${idActivo} (portal)`, texto },
    aviso: null,
  };
}

const CARGADORES: Record<TipoFuenteAuto, { nombre: string; cargar: typeof fuenteActas }> = {
  planificacion: { nombre: "la planificación", cargar: fuentePlanificacion },
  actas: { nombre: "las actas", cargar: fuenteActas },
};

/** Carga las fuentes del portal que la PM ha pedido incorporar. */
export async function cargarFuentesAutomaticas(
  ctx: UserContext,
  idActivo: string,
  trimestre: Trimestre,
  etiqueta: string,
  tipos: TipoFuenteAuto[],
): Promise<FuentesAutomaticasResultado> {
  const resultados = await Promise.allSettled(tipos.map((t) => CARGADORES[t].cargar(ctx, idActivo, trimestre, etiqueta)));
  const documentos: FuenteAutomatica[] = [];
  const avisos: string[] = [];
  resultados.forEach((r, i) => {
    if (r.status === "rejected") {
      console.error("[informes/fuentes-auto]", r.reason);
      avisos.push(`No se han podido cargar ${CARGADORES[tipos[i]!].nombre}.`);
      return;
    }
    if (r.value.doc) documentos.push(r.value.doc);
    if (r.value.aviso) avisos.push(r.value.aviso);
  });
  return { documentos, avisos };
}
