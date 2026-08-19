/**
 * Tipos de Avance de obra (migración 028).
 *
 * Escritos a mano, como el resto del repo: no hay generación de tipos desde
 * Supabase. Si cambia el esquema, hay que tocar esto a la vez.
 */

/** Fila de pm_avance_fase_catalogo. */
export interface PmAvanceFase {
  id: string;
  nombre: string;
  orden: number;
  /** true solo en «Avance general», que Zoho calcula aparte y aquí no se recalcula. */
  es_general: boolean;
  /** Cabecera literal de la columna en el export de Zoho. */
  zoho_columna: string | null;
  /** Nombre API del campo en Zoho CRM. NULL mientras no haya integración. */
  zoho_api_name: string | null;
  activo: boolean;
}

/** Fila de pm_promociones: una promoción del módulo Promociones de Zoho CRM. */
export interface PmPromocion {
  id: string;
  /** Parte numérica del id de Zoho CRM. */
  zoho_record_id: string;
  /** El mismo id con el prefijo «zcrm_» que añade Zoho Analytics. */
  zoho_analytics_id: string | null;
  codigo_promocion: string;
  nombre: string | null;
  owner_zoho_id: string | null;
  situacion: string | null;
  fuente_archivo: string | null;
  importado_at: string;
}

/** Fila de pm_avance_obra: el porcentaje vigente de una fase. */
export interface PmAvanceObra {
  promocion_id: string;
  fase_id: string;
  /** NULL = sin dato. Distinto de 0, que es «medido y a cero». */
  porcentaje: number | null;
  /** Última lectura importada de Zoho. La línea base del diff. */
  porcentaje_zoho: number | null;
  origen: "zoho_import" | "app";
  actualizado_por: string | null;
  actualizado_por_email: string | null;
  actualizado_at: string;
}

/** Fila de pm_avance_obra_historico. Append-only. */
export interface PmAvanceHistorico {
  id: string;
  promocion_id: string;
  fase_id: string;
  porcentaje_anterior: number | null;
  porcentaje_nuevo: number | null;
  origen: "zoho_import" | "app";
  cambiado_por: string | null;
  cambiado_por_email: string | null;
  cambiado_at: string;
}

export type PmOutboxEstado =
  | "pendiente"
  | "aprobado"
  | "exportado"
  | "enviado"
  | "descartado";

/**
 * Fila de pm_avance_zoho_outbox: estado deseado por (promoción, fase), no un log.
 * Nada sale de aquí sin aprobación humana explícita.
 */
export interface PmAvanceOutbox {
  id: string;
  promocion_id: string;
  fase_id: string;
  porcentaje_zoho: number | null;
  porcentaje_nuevo: number | null;
  estado: PmOutboxEstado;
  creado_por: string | null;
  creado_por_email: string | null;
  creado_at: string;
  aprobado_por: string | null;
  aprobado_por_email: string | null;
  aprobado_at: string | null;
  exportado_at: string | null;
  enviado_at: string | null;
  motivo: string | null;
  error: string | null;
}

/** Una fase con su valor, ya resuelta para pintar. */
export interface PmAvanceFaseValor {
  fase: PmAvanceFase;
  porcentaje: number | null;
  porcentajeZoho: number | null;
  origen: "zoho_import" | "app" | null;
  /** Hay un cambio pendiente de comunicar a Zoho para esta fase. */
  pendiente: boolean;
}

/** Todo lo que necesita la pestaña de un proyecto. */
export interface PmAvanceProyecto {
  promocion: PmPromocion;
  /** Origen del emparejamiento activo↔promoción. */
  mapeoOrigen: "auto" | "manual";
  general: PmAvanceFaseValor | null;
  fases: PmAvanceFaseValor[];
  historico: (PmAvanceHistorico & { fase_nombre: string })[];
  pendientes: (PmAvanceOutbox & { fase_nombre: string })[];
}

/** Opción del desplegable de emparejamiento en Mapeo maestro. */
export interface PromocionOption {
  id: string;
  codigo_promocion: string;
  nombre: string | null;
  situacion: string | null;
}
