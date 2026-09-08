/**
 * Tipos del dominio corporativo: la foto económica del grupo Impar (GIIC, ICI e
 * ICAM), tal y como la publica el maestro corporativo.
 *
 * El maestro es una tabla en formato largo donde conviven tres niveles de periodo.
 * Es la trampa principal del dominio y por eso el tipo la hace explícita: sumar
 * mezclando `tipo_periodo` duplica cifras.
 */

export const SOCIEDADES = ["GRUPO", "GIIC", "ICI+ICAM"] as const;
export type Sociedad = (typeof SOCIEDADES)[number];

export const TIPOS_PERIODO = ["TRIMESTRE", "AÑO", "ACUMULADO"] as const;
export type TipoPeriodo = (typeof TIPOS_PERIODO)[number];

/**
 * REAL hasta 2026 2T · PREVISIÓN a partir de 2026 3T · MIXTO en las filas de año
 * y acumulado que mezclan ambos. Los KPI de cabecera solo miran REAL.
 */
export const NATURALEZAS = ["REAL", "PREVISIÓN", "MIXTO"] as const;
export type Naturaleza = (typeof NATURALEZAS)[number];

/** Una fila de `corp_periodos` = una fila de la hoja DATOS del maestro. */
export interface CorpPeriodo {
  /** Clave del propio Excel: «GIIC|20211T», «GRUPO|2025», «GIIC|ALLTIME». */
  id: string;

  sociedad: Sociedad;
  perimetro: string | null;
  /** 1 = último trimestre con datos REALES de esa sociedad. */
  es_ultima_fila: number;
  /** «2025 3T», «2025» o «ALL TIME». */
  periodo: string;
  tipo_periodo: TipoPeriodo;
  anio: number | null;
  trimestre: number | null;
  fecha_inicio: string | null;
  fecha_fin: string | null;
  /** Meses con datos del periodo. Sirve para anualizar. */
  meses: number | null;
  naturaleza: Naturaleza;

  // --- Cuenta de resultados de gestión ---
  facturacion: number | null;
  gastos_totales: number | null;
  /**
   * Desglose de gastos. Solo viene relleno cuando variables + estructura cuadra
   * con el total; si no cuadra, el maestro deja ambas vacías en vez de publicar un
   * reparto erróneo. GIIC 2021-2023 no lo tiene.
   */
  gastos_variables: number | null;
  gastos_estructura: number | null;
  /** El EBITDA que define el CF de cada sociedad: la cifra oficial de gestión. */
  ebitda: number | null;
  margen_ebitda_pct: number | null;
  gastos_sobre_facturacion_pct: number | null;
  /** Facturación − Gastos Totales, sin periodificar: la caja real del trimestre. */
  ebitda_caja: number | null;
  /** EBITDA − EBITDA de caja. Distinto de cero solo donde el CF periodifica. */
  ajuste_periodificacion: number | null;
  facturacion_acumulada_anio: number | null;
  var_facturacion_interanual_pct: number | null;

  // --- Saldos a una fecha. STOCK: no se suman entre periodos ---
  saldo_caja_cierre: number | null;
  saldo_banco_cierre: number | null;
  capital_bajo_gestion: number | null;
  aum_regulado_icam: number | null;
  aum_no_regulado_ici: number | null;
  n_vehiculos: number | null;
  fee_sobre_aum_pct: number | null;
  facturacion_por_vehiculo: number | null;

  // --- Desglose por sociedad dentro de las filas agregadas ---
  facturacion_icam: number | null;
  facturacion_ici: number | null;
  facturacion_giic: number | null;
  ebitda_icam: number | null;
  ebitda_ici: number | null;
  ebitda_giic: number | null;
  peso_sobre_facturacion_grupo_pct: number | null;

  // --- Cuentas oficiales depositadas de GIIC. Solo en filas de tipo AÑO ---
  cifra_negocio_cuentas: number | null;
  resultado_explotacion_cuentas: number | null;
  resultado_ejercicio_cuentas: number | null;
  total_activo: number | null;
  patrimonio_neto: number | null;
  efectivo_balance: number | null;

  // --- Solo en la fila ACUMULADO de GIIC ---
  volumen_intermediado: number | null;
  n_proyectos_giic: number | null;
}

/** Fila de `corp_diccionario` (hoja DICCIONARIO del maestro). */
export interface CorpDiccionarioEntrada {
  campo: string;
  unidad: string | null;
  descripcion: string | null;
  orden: number;
}

/** Fila de `corp_notas` (hoja NOTAS del maestro). */
export interface CorpNota {
  id: string;
  /** «ORIGEN DE LOS DATOS» o «AVISOS». */
  seccion: string;
  orden: number;
  titulo: string | null;
  texto: string | null;
}
