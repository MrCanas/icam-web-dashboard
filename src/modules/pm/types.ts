export type PmTipoUso = "APT" | "RESIDENCIAL_LIBRE";

export interface PmActivo {
  id: string;
  id_activo: string;
  tipo_uso_activo: PmTipoUso;
  nombre_display: string | null;
  /** Orden en el Gantt. Migración 018; sustituye a PM_PROJECT_ORDER. */
  orden?: number;
  /** Baja lógica: los activos nunca se borran. */
  archivado_at?: string | null;
}

export interface PmHito {
  id: string;
  activo_id: string;
  hito: string;
  orden_hito: number;
  fecha_actual: string | null;
  /**
   * Escritas por el RPC de rescate (Excel). La UI ya NO las lee: se derivan de
   * las fechas en pm-deviations.ts, porque con edición en la app se quedarían
   * obsoletas en cuanto alguien cambia un hito.
   */
  desviacion_vs_anterior_dias: number | null;
  desviacion_vs_levantamiento_dias: number | null;
  /** FK al catálogo global (migración 020). Null si falta pasar el backfill. */
  catalogo_id?: string | null;
  /**
   * Baja lógica POR PROYECTO (migración 022): cada fila de pm_hitos ya es un par
   * activo×hito, así que archivar aquí no toca al resto de proyectos. El hito
   * desaparece de rejilla, Gantt y detalle; sus fechas se conservan.
   */
  archivado_at?: string | null;
}

/**
 * Excepción de publicación: qué trimestres retira un proyecto del Overview.
 * Solo se guardan los `publicado = false`; sin fila = publicado (migración 022).
 */
export interface PmActivoSnapshot {
  activo_id: string;
  snapshot_code: string;
  publicado: boolean;
}

/** Entrada del catálogo global de hitos (migración 020). */
export interface PmHitoCatalogo {
  id: string;
  nombre: string;
  orden_default: number;
  color: string | null;
  /** Sin duración: el Gantt le dibuja siempre un trimestre exacto. */
  es_puntual: boolean;
  /**
   * Cabecera en la hoja "Tabla madre" del maestro financiero: REAL si
   * tabla_madre_existe, PROPUESTA si no (documenta qué columna habría que crear).
   */
  tabla_madre_columna: string | null;
  tabla_madre_existe: boolean;
  activo: boolean;
}

/** Un snapshot = un trimestre reportado por la PMO (migración 020). */
export interface PmSnapshot {
  snapshot_code: string;
  label: string | null;
  /**
   * OBSOLETA desde la 022: publicar es por proyecto (ver PmActivoSnapshot). Se
   * conserva porque la columna sigue en la tabla, pero nadie la lee.
   */
  visible_en_dashboard: boolean;
  orden: number;
  anadido_at: string | null;
}

/** Mapeo activo PM → proyecto del maestro financiero. N:1 (caso PC25). */
export interface PmActivoProyectoMap {
  pm_activo_id: string;
  proyecto_financiero_key: string;
}

export interface PmSnapshotFecha {
  id: string;
  hito_id: string;
  snapshot_code: string;
  fecha: string | null;
}

/** Códigos conocidos + cualquier YYYY_Qn futuro */
export type PmSnapshotCode =
  | "fecha_actual"
  | "levantamiento"
  | "2025_Q2"
  | "2025_Q3"
  | "2025_Q4"
  | "2026_Q1"
  | string;

export const PM_SNAPSHOT_DISPLAY_ORDER: string[] = [
  "fecha_actual",
  "2026_Q1",
  "2025_Q4",
  "2025_Q3",
  "2025_Q2",
  "levantamiento",
];
