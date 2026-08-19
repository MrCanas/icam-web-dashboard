import type { UserContext } from "@/lib/auth/currentUser";
import { isMissingTableError } from "@/lib/db/pgErrors";
import { getPmReadSupabase } from "@/modules/pm/data/readClient";
import { hayCambioVsZoho } from "@/modules/pm/avance/logic/avance-obra";
import type {
  PmAvanceFase,
  PmAvanceFaseValor,
  PmAvanceHistorico,
  PmAvanceObra,
  PmAvanceOutbox,
  PmAvanceProyecto,
  PmPromocion,
  PromocionOption,
} from "@/modules/pm/avance/types";

/**
 * Lectura de Avance de obra (migración 028).
 *
 * Todas las consultas van guardadas con `isMissingTableError`: hasta que la 028
 * esté aplicada en un entorno, las pantallas tienen que degradar a un aviso, no
 * romperse. Es la regla de la casa para features detrás de una migración.
 */

/** Nº de cambios que se listan en el histórico de un proyecto. */
const HISTORICO_LIMITE = 50;

export interface AvanceProyectoResult {
  data: PmAvanceProyecto | null;
  /** El activo existe pero no está emparejado con ninguna promoción de Zoho. */
  sinPromocion: boolean;
  /** La migración 028 no está aplicada en este entorno. */
  migracionPendiente: boolean;
  error: string | null;
}

const VACIO: AvanceProyectoResult = {
  data: null,
  sinPromocion: false,
  migracionPendiente: false,
  error: null,
};

export async function fetchAvanceObraProyecto(
  ctx: UserContext,
  idActivo: string,
): Promise<AvanceProyectoResult> {
  const supabase = await getPmReadSupabase(ctx);

  const { data: activo, error: eActivo } = await supabase
    .from("pm_activos")
    .select("id")
    .eq("id_activo", idActivo)
    .maybeSingle();

  if (eActivo) return { ...VACIO, error: eActivo.message };
  if (!activo) return { ...VACIO, error: `No existe el proyecto ${idActivo}` };

  const { data: mapeo, error: eMapeo } = await supabase
    .from("pm_activo_promocion_map")
    .select("promocion_id, origen")
    .eq("pm_activo_id", (activo as { id: string }).id)
    .maybeSingle();

  if (eMapeo) {
    if (isMissingTableError(eMapeo)) return { ...VACIO, migracionPendiente: true };
    return { ...VACIO, error: eMapeo.message };
  }
  if (!mapeo) return { ...VACIO, sinPromocion: true };

  const { promocion_id: promocionId, origen: mapeoOrigen } = mapeo as {
    promocion_id: string;
    origen: "auto" | "manual";
  };

  const [rPromo, rFases, rValores, rHist, rOutbox] = await Promise.all([
    supabase.from("pm_promociones").select("*").eq("id", promocionId).maybeSingle(),
    supabase
      .from("pm_avance_fase_catalogo")
      .select("*")
      .eq("activo", true)
      .order("orden"),
    supabase.from("pm_avance_obra").select("*").eq("promocion_id", promocionId),
    supabase
      .from("pm_avance_obra_historico")
      .select("*")
      .eq("promocion_id", promocionId)
      .order("cambiado_at", { ascending: false })
      .limit(HISTORICO_LIMITE),
    supabase
      .from("pm_avance_zoho_outbox")
      .select("*")
      .eq("promocion_id", promocionId)
      .in("estado", ["pendiente", "aprobado"])
      .order("creado_at", { ascending: false }),
  ]);

  const fallo = [rPromo, rFases, rValores, rHist, rOutbox].find((r) => r.error);
  if (fallo?.error) {
    if (isMissingTableError(fallo.error)) return { ...VACIO, migracionPendiente: true };
    return { ...VACIO, error: fallo.error.message };
  }

  const promocion = rPromo.data as PmPromocion | null;
  if (!promocion) return { ...VACIO, sinPromocion: true };

  const fases = (rFases.data ?? []) as PmAvanceFase[];
  const valores = (rValores.data ?? []) as PmAvanceObra[];
  const historico = (rHist.data ?? []) as PmAvanceHistorico[];
  const outbox = (rOutbox.data ?? []) as PmAvanceOutbox[];

  const nombreFase = new Map(fases.map((f) => [f.id, f.nombre]));
  const porFase = new Map(valores.map((v) => [v.fase_id, v]));

  const resuelve = (fase: PmAvanceFase): PmAvanceFaseValor => {
    const v = porFase.get(fase.id);
    const porcentaje = numero(v?.porcentaje);
    const porcentajeZoho = numero(v?.porcentaje_zoho);
    return {
      fase,
      porcentaje,
      porcentajeZoho,
      origen: v?.origen ?? null,
      pendiente: hayCambioVsZoho(porcentaje, porcentajeZoho),
    };
  };

  return {
    data: {
      promocion,
      mapeoOrigen,
      general: fases.filter((f) => f.es_general).map(resuelve)[0] ?? null,
      fases: fases.filter((f) => !f.es_general).map(resuelve),
      historico: historico.map((h) => ({
        ...h,
        porcentaje_anterior: numero(h.porcentaje_anterior),
        porcentaje_nuevo: numero(h.porcentaje_nuevo),
        fase_nombre: nombreFase.get(h.fase_id) ?? "—",
      })),
      pendientes: outbox.map((o) => ({
        ...o,
        porcentaje_zoho: numero(o.porcentaje_zoho),
        porcentaje_nuevo: numero(o.porcentaje_nuevo),
        fase_nombre: nombreFase.get(o.fase_id) ?? "—",
      })),
    },
    sinPromocion: false,
    migracionPendiente: false,
    error: null,
  };
}

// ---------------------------------------------------------------------------
// Mapeo maestro
// ---------------------------------------------------------------------------

export interface PromocionesYMapeo {
  promociones: PromocionOption[];
  /** pm_activos.id → { promocionId, origen }. */
  mapeo: Record<string, { promocionId: string; origen: "auto" | "manual" }>;
  error: string | null;
}

/**
 * Opciones y estado del emparejamiento para la columna «Promoción (Zoho)».
 *
 * Si la 028 no está aplicada devuelve listas vacías y `error: null`: Mapeo
 * maestro tiene que seguir funcionando sin esta feature.
 */
export async function fetchPromocionesYMapeo(ctx: UserContext): Promise<PromocionesYMapeo> {
  const supabase = await getPmReadSupabase(ctx);

  const [rPromos, rMapeo] = await Promise.all([
    supabase
      .from("pm_promociones")
      .select("id, codigo_promocion, nombre, situacion")
      .order("codigo_promocion"),
    supabase.from("pm_activo_promocion_map").select("pm_activo_id, promocion_id, origen"),
  ]);

  const fallo = [rPromos, rMapeo].find((r) => r.error);
  if (fallo?.error) {
    if (isMissingTableError(fallo.error)) {
      return { promociones: [], mapeo: {}, error: null };
    }
    return { promociones: [], mapeo: {}, error: fallo.error.message };
  }

  const mapeo: PromocionesYMapeo["mapeo"] = {};
  for (const m of (rMapeo.data ?? []) as {
    pm_activo_id: string;
    promocion_id: string;
    origen: "auto" | "manual";
  }[]) {
    mapeo[m.pm_activo_id] = { promocionId: m.promocion_id, origen: m.origen };
  }

  return {
    promociones: (rPromos.data ?? []) as PromocionOption[],
    mapeo,
    error: null,
  };
}

// ---------------------------------------------------------------------------
// Hub
// ---------------------------------------------------------------------------

/** Una fila de la bandeja de salida, ya resuelta para pintar. */
export interface OutboxFila {
  id: string;
  estado: PmAvanceOutbox["estado"];
  codigoPromocion: string;
  nombrePromocion: string | null;
  faseNombre: string;
  porcentajeZoho: number | null;
  porcentajeNuevo: number | null;
  creadoPorEmail: string | null;
  creadoAt: string;
  aprobadoPorEmail: string | null;
  aprobadoAt: string | null;
  exportadoAt: string | null;
  motivo: string | null;
}

/** Una promoción en la tabla del hub, con su avance general y su activo de PM. */
export interface PromocionFila {
  id: string;
  codigo: string;
  nombre: string | null;
  situacion: string | null;
  general: number | null;
  idsActivo: string[];
  pendientes: number;
}

export interface AvanceHubData {
  pendientes: OutboxFila[];
  aprobados: OutboxFila[];
  promociones: PromocionFila[];
  migracionPendiente: boolean;
  error: string | null;
}

export async function fetchAvanceHubData(ctx: UserContext): Promise<AvanceHubData> {
  const supabase = await getPmReadSupabase(ctx);
  const vacio: AvanceHubData = {
    pendientes: [],
    aprobados: [],
    promociones: [],
    migracionPendiente: false,
    error: null,
  };

  const [rPromos, rFases, rValores, rOutbox, rMapeo, rActivos] = await Promise.all([
    supabase
      .from("pm_promociones")
      .select("id, codigo_promocion, nombre, situacion")
      .order("codigo_promocion"),
    supabase.from("pm_avance_fase_catalogo").select("id, nombre, es_general").order("orden"),
    supabase.from("pm_avance_obra").select("promocion_id, fase_id, porcentaje"),
    supabase
      .from("pm_avance_zoho_outbox")
      .select("*")
      .in("estado", ["pendiente", "aprobado"])
      .order("creado_at", { ascending: false }),
    supabase.from("pm_activo_promocion_map").select("pm_activo_id, promocion_id"),
    supabase.from("pm_activos").select("id, id_activo"),
  ]);

  const fallo = [rPromos, rFases, rValores, rOutbox, rMapeo, rActivos].find((r) => r.error);
  if (fallo?.error) {
    if (isMissingTableError(fallo.error)) return { ...vacio, migracionPendiente: true };
    return { ...vacio, error: fallo.error.message };
  }

  const promos = (rPromos.data ?? []) as PromocionOption[];
  const fases = (rFases.data ?? []) as { id: string; nombre: string; es_general: boolean }[];
  const valores = (rValores.data ?? []) as {
    promocion_id: string;
    fase_id: string;
    porcentaje: number | string | null;
  }[];
  const outbox = (rOutbox.data ?? []) as PmAvanceOutbox[];
  const activos = (rActivos.data ?? []) as { id: string; id_activo: string }[];
  const mapeo = (rMapeo.data ?? []) as { pm_activo_id: string; promocion_id: string }[];

  const nombreFase = new Map(fases.map((f) => [f.id, f.nombre]));
  const promoPorId = new Map(promos.map((p) => [p.id, p]));
  const idFaseGeneral = fases.find((f) => f.es_general)?.id;
  const idActivoPorUuid = new Map(activos.map((a) => [a.id, a.id_activo]));

  const activosPorPromocion = new Map<string, string[]>();
  for (const m of mapeo) {
    const id = idActivoPorUuid.get(m.pm_activo_id);
    if (!id) continue;
    activosPorPromocion.set(m.promocion_id, [
      ...(activosPorPromocion.get(m.promocion_id) ?? []),
      id,
    ]);
  }

  const generalPorPromocion = new Map<string, number | null>();
  for (const v of valores) {
    if (v.fase_id === idFaseGeneral) generalPorPromocion.set(v.promocion_id, numero(v.porcentaje));
  }

  const pendientesPorPromocion = new Map<string, number>();
  for (const o of outbox) {
    if (o.estado !== "pendiente") continue;
    pendientesPorPromocion.set(o.promocion_id, (pendientesPorPromocion.get(o.promocion_id) ?? 0) + 1);
  }

  const fila = (o: PmAvanceOutbox): OutboxFila => {
    const p = promoPorId.get(o.promocion_id);
    return {
      id: o.id,
      estado: o.estado,
      codigoPromocion: p?.codigo_promocion ?? "—",
      nombrePromocion: p?.nombre ?? null,
      faseNombre: nombreFase.get(o.fase_id) ?? "—",
      porcentajeZoho: numero(o.porcentaje_zoho),
      porcentajeNuevo: numero(o.porcentaje_nuevo),
      creadoPorEmail: o.creado_por_email,
      creadoAt: o.creado_at,
      aprobadoPorEmail: o.aprobado_por_email,
      aprobadoAt: o.aprobado_at,
      exportadoAt: o.exportado_at,
      motivo: o.motivo,
    };
  };

  return {
    pendientes: outbox.filter((o) => o.estado === "pendiente").map(fila),
    aprobados: outbox.filter((o) => o.estado === "aprobado").map(fila),
    promociones: promos.map((p) => ({
      id: p.id,
      codigo: p.codigo_promocion,
      nombre: p.nombre,
      situacion: p.situacion,
      general: generalPorPromocion.get(p.id) ?? null,
      idsActivo: activosPorPromocion.get(p.id) ?? [],
      pendientes: pendientesPorPromocion.get(p.id) ?? 0,
    })),
    migracionPendiente: false,
    error: null,
  };
}

// ---------------------------------------------------------------------------
// Exportación
// ---------------------------------------------------------------------------

export interface CambiosAprobadosResult {
  cambios: {
    outboxId: string;
    zohoRecordId: string;
    zohoAnalyticsId: string | null;
    codigoPromocion: string;
    zohoColumna: string | null;
    zohoApiName: string | null;
    faseNombre: string;
    porcentajeNuevo: number | null;
  }[];
  /** Cabeceras de fase, en el orden del catálogo. */
  columnasFase: string[];
  error: string | null;
}

/** Los cambios aprobados y aún no exportados, listos para construir el fichero. */
export async function fetchCambiosAprobados(
  ctx: UserContext,
): Promise<CambiosAprobadosResult> {
  const supabase = await getPmReadSupabase(ctx);

  const [rOutbox, rFases, rPromos] = await Promise.all([
    supabase
      .from("pm_avance_zoho_outbox")
      .select("id, promocion_id, fase_id, porcentaje_nuevo")
      .eq("estado", "aprobado")
      .order("creado_at"),
    supabase
      .from("pm_avance_fase_catalogo")
      .select("id, nombre, zoho_columna, zoho_api_name")
      .eq("activo", true)
      .order("orden"),
    supabase.from("pm_promociones").select("id, zoho_record_id, zoho_analytics_id, codigo_promocion"),
  ]);

  const fallo = [rOutbox, rFases, rPromos].find((r) => r.error);
  if (fallo?.error) {
    return { cambios: [], columnasFase: [], error: fallo.error.message };
  }

  const fases = (rFases.data ?? []) as {
    id: string;
    nombre: string;
    zoho_columna: string | null;
    zoho_api_name: string | null;
  }[];
  const promos = new Map(
    ((rPromos.data ?? []) as {
      id: string;
      zoho_record_id: string;
      zoho_analytics_id: string | null;
      codigo_promocion: string;
    }[]).map((p) => [p.id, p]),
  );
  const porFase = new Map(fases.map((f) => [f.id, f]));

  const cambios = ((rOutbox.data ?? []) as {
    id: string;
    promocion_id: string;
    fase_id: string;
    porcentaje_nuevo: number | string | null;
  }[])
    .map((o) => {
      const p = promos.get(o.promocion_id);
      const f = porFase.get(o.fase_id);
      if (!p || !f) return null;
      return {
        outboxId: o.id,
        zohoRecordId: p.zoho_record_id,
        zohoAnalyticsId: p.zoho_analytics_id,
        codigoPromocion: p.codigo_promocion,
        zohoColumna: f.zoho_columna,
        zohoApiName: f.zoho_api_name,
        faseNombre: f.nombre,
        porcentajeNuevo: numero(o.porcentaje_nuevo),
      };
    })
    .filter((c): c is NonNullable<typeof c> => c !== null);

  return {
    cambios,
    columnasFase: fases.map((f) => f.zoho_columna ?? f.nombre),
    error: null,
  };
}

/**
 * PostgREST devuelve `numeric` como string para no perder precisión. Sin esto,
 * `porcentaje` llegaría como "45.38" y toda comparación con la línea base de
 * Zoho fallaría por tipo, no por valor.
 */
function numero(v: number | string | null | undefined): number | null {
  if (v === null || v === undefined) return null;
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : null;
}
