export type SituacionProyecto = "En Marcha" | "Culminado";
export type TipoProyecto = "Promoción" | "Fondo";

export interface Proyecto {
  id: number;
  proyecto: string;
  situacion: SituacionProyecto;
  tipo_proyecto: TipoProyecto;
  inversion_total: number | null;
  total_ingresos_venta: number | null;
  beneficios: number | null;
  unidades_totales: number | null;
  tir_desp_is: number | null;
  roe_desp_is: number | null;
  multiplo: number | null;
  project_irr: number | null;
  bcr: number | null;
  ubicacion: string | null;
  equity: number | null;
  entry_yield: number | null;
  exit_yield: number | null;
  credito_total: number | null;
  holding_period: number | null;
  superficie_edificable: number | null;
  es_ultima_fila: number;
  fecha_inicio: string | null;
  created_at?: string | null;
}

export interface KPIBundle {
  nProyectos: number;
  nActivos: number;
  nCulminados: number;
  inversionTotal: number;
  /** Suma de equity gestionado (col AY) del conjunto de proyectos evaluado (respeta filtros). */
  fondosPropiosTotales: number;
  /** Media del equity gestionado entre proyectos con equity > 0 del conjunto evaluado. */
  fondosPropiosMedia: number;
  gdvTotal: number;
  beneficioTotal: number;
  margenPct: number;
  tirPonderada: number;
  tirMedia: number;
  roeMedia: number;
  multiploMedio: number;
  pirrMedio: number;
  inversionMedia: number;
  beneficioMedio: number;
  unidadesTotales: number;
  unidadesMedia: number;
  tirSup15: number;
  tirValidCount: number;
}

export interface GroupedMetric {
  count: number;
  inversion: number;
}

export type SegmentKPIs = {
  portfolio: KPIBundle;
  enMarcha: KPIBundle;
  culminado: KPIBundle;
};
