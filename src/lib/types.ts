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
  holding_period: number | null;
  superficie_edificable: number | null;
  es_ultima_fila: number;
}

export interface KPIBundle {
  nProyectos: number;
  nActivos: number;
  nCulminados: number;
  inversionTotal: number;
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
