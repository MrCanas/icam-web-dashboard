export type PmTipoUso = "APT" | "RESIDENCIAL_LIBRE";

export interface PmActivo {
  id: string;
  id_activo: string;
  tipo_uso_activo: PmTipoUso;
  nombre_display: string | null;
}

export interface PmHito {
  id: string;
  activo_id: string;
  hito: string;
  orden_hito: number;
  fecha_actual: string | null;
  desviacion_vs_anterior_dias: number | null;
  desviacion_vs_levantamiento_dias: number | null;
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
