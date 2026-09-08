/**
 * Cálculos del tab Corporativas. Funciones puras: ni React ni Supabase.
 *
 * Las cuatro reglas del maestro que gobiernan todo lo de aquí, tomadas de su hoja
 * NOTAS. Están escritas porque son la fuente de todos los errores plausibles:
 *
 *   1. TRIMESTRE, AÑO y ACUMULADO conviven en la misma tabla. Sumar sin filtrar
 *      antes por `tipo_periodo` duplica cifras.
 *   2. Caja, banco, AUM y nº de vehículos son SALDOS a una fecha. No se suman
 *      entre periodos: se toma el valor del último.
 *   3. Los KPI de cabecera solo miran filas REAL. 2026 3T y 4T son previsión, y
 *      los años que las contienen son MIXTO.
 *   4. `es_ultima_fila = 1` marca el último trimestre cerrado de cada sociedad.
 */
import type { Granularidad } from "@/modules/corporativo/logic/corporativoParams";
import { tipoPeriodoDe } from "@/modules/corporativo/logic/corporativoParams";
import type { CorpPeriodo, Sociedad, TipoPeriodo } from "@/modules/corporativo/types";

// ---------------------------------------------------------------------------
// Selección
// ---------------------------------------------------------------------------

/** ¿Es un periodo cerrado? Manda el aspecto: lo no cerrado se pinta distinto. */
export function esCerrado(fila: CorpPeriodo): boolean {
  return fila.naturaleza === "REAL";
}

/** Orden cronológico estable. Las filas sin año (ACUMULADO) van al final. */
function porFecha(a: CorpPeriodo, b: CorpPeriodo): number {
  const anioA = a.anio ?? Number.POSITIVE_INFINITY;
  const anioB = b.anio ?? Number.POSITIVE_INFINITY;
  if (anioA !== anioB) return anioA - anioB;
  return (a.trimestre ?? 0) - (b.trimestre ?? 0);
}

export interface FiltroSerie {
  sociedad: Sociedad;
  granularidad: Granularidad;
  /** Recorta la serie por su izquierda. `undefined` = desde el principio. */
  desde?: number;
  /**
   * `false` deja solo lo cerrado (REAL). Se lleva también las filas MIXTO: un año
   * que incluye dos trimestres de previsión no es un cierre, y dejar la barra de
   * 2026 mientras se ocultan sus trimestres 3T y 4T haría que la gráfica se
   * contradijera a sí misma.
   */
  incluirPrevision: boolean;
}

/** La serie temporal que pintan las gráficas: una sociedad, una granularidad. */
export function serieDe(filas: CorpPeriodo[], filtro: FiltroSerie): CorpPeriodo[] {
  const tipo = tipoPeriodoDe(filtro.granularidad);
  return filas
    .filter((f) => f.sociedad === filtro.sociedad && f.tipo_periodo === tipo)
    .filter((f) => (filtro.desde === undefined ? true : (f.anio ?? 0) >= filtro.desde))
    .filter((f) => (filtro.incluirPrevision ? true : esCerrado(f)))
    .sort(porFecha);
}

export function filasDe(
  filas: CorpPeriodo[],
  sociedad: Sociedad,
  tipoPeriodo: TipoPeriodo,
): CorpPeriodo[] {
  return filas
    .filter((f) => f.sociedad === sociedad && f.tipo_periodo === tipoPeriodo)
    .sort(porFecha);
}

/**
 * Último trimestre cerrado de una sociedad. Prefiere la marca del maestro
 * (`es_ultima_fila`) y, si el fichero llegara sin ella, cae al último REAL.
 */
export function ultimoTrimestreReal(
  filas: CorpPeriodo[],
  sociedad: Sociedad,
): CorpPeriodo | null {
  const trimestres = filasDe(filas, sociedad, "TRIMESTRE");
  const marcado = trimestres.find((f) => f.es_ultima_fila === 1);
  if (marcado) return marcado;
  const reales = trimestres.filter(esCerrado);
  return reales.length > 0 ? reales[reales.length - 1]! : null;
}

/**
 * Periodo de referencia de las gráficas que retratan un instante (puente de
 * EBITDA, mix de facturación, comparativa entre sociedades): el último cerrado de
 * la serie, o el último que haya si no hay ninguno cerrado.
 */
export function periodoReferencia(serie: CorpPeriodo[]): CorpPeriodo | null {
  if (serie.length === 0) return null;
  const cerrados = serie.filter(esCerrado);
  return cerrados.length > 0 ? cerrados[cerrados.length - 1]! : serie[serie.length - 1]!;
}

/** Etiqueta del último periodo cerrado de la serie: la línea de corte real→previsión. */
export function periodoCorte(serie: CorpPeriodo[]): string | null {
  const cerrados = serie.filter(esCerrado);
  if (cerrados.length === 0 || cerrados.length === serie.length) return null;
  return cerrados[cerrados.length - 1]!.periodo;
}

// ---------------------------------------------------------------------------
// KPI de cabecera
// ---------------------------------------------------------------------------

export interface KpisCorp {
  /** Periodo sobre el que se calcula todo: el último trimestre cerrado. */
  periodo: string | null;
  anio: number | null;

  facturacionYtd: number | null;
  varInteranualPct: number | null;

  ebitdaYtd: number | null;
  margenYtdPct: number | null;

  margenTrimestrePct: number | null;
  /** Margen agregado de los 4 últimos trimestres cerrados (EBITDA / facturación). */
  margen4tPct: number | null;

  capitalBajoGestion: number | null;
  vehiculos: number | null;
  feeSobreAumPct: number | null;

  saldoCaja: number | null;
}

const KPIS_VACIOS: KpisCorp = {
  periodo: null,
  anio: null,
  facturacionYtd: null,
  varInteranualPct: null,
  ebitdaYtd: null,
  margenYtdPct: null,
  margenTrimestrePct: null,
  margen4tPct: null,
  capitalBajoGestion: null,
  vehiculos: null,
  feeSobreAumPct: null,
  saldoCaja: null,
};

function ratio(numerador: number | null, denominador: number | null): number | null {
  if (numerador === null || denominador === null || denominador === 0) return null;
  return numerador / denominador;
}

function suma(filas: CorpPeriodo[], campo: keyof CorpPeriodo): number | null {
  const valores = filas.map((f) => f[campo]).filter((v): v is number => typeof v === "number");
  return valores.length === 0 ? null : valores.reduce((a, b) => a + b, 0);
}

/**
 * KPI de cabecera, anclados al último trimestre CERRADO de la sociedad. Nunca
 * miran previsión: la foto de arriba tiene que ser lo que ya ha pasado.
 */
export function buildKpis(filas: CorpPeriodo[], sociedad: Sociedad): KpisCorp {
  const ultimo = ultimoTrimestreReal(filas, sociedad);
  if (!ultimo) return KPIS_VACIOS;

  const trimestresReales = filasDe(filas, sociedad, "TRIMESTRE").filter(esCerrado);
  const hastaElUltimo = trimestresReales.filter(
    (f) => porFecha(f, ultimo) <= 0 && (f.anio ?? 0) === (ultimo.anio ?? 0),
  );

  // La facturación YTD viene calculada en el maestro; el EBITDA YTD no, así que
  // se suma. Ambos sobre trimestres del mismo año y solo cerrados (regla 1 y 3).
  const facturacionYtd = ultimo.facturacion_acumulada_anio ?? suma(hastaElUltimo, "facturacion");
  const ebitdaYtd = suma(hastaElUltimo, "ebitda");

  const ultimos4 = trimestresReales.slice(-4);

  return {
    periodo: ultimo.periodo,
    anio: ultimo.anio,
    facturacionYtd,
    varInteranualPct: ultimo.var_facturacion_interanual_pct,
    ebitdaYtd,
    margenYtdPct: ratio(ebitdaYtd, facturacionYtd),
    margenTrimestrePct: ultimo.margen_ebitda_pct,
    margen4tPct: ratio(suma(ultimos4, "ebitda"), suma(ultimos4, "facturacion")),
    // Saldos: se toma el valor del último trimestre, no se suman (regla 2).
    capitalBajoGestion: ultimo.capital_bajo_gestion,
    vehiculos: ultimo.n_vehiculos,
    feeSobreAumPct: ultimo.fee_sobre_aum_pct,
    saldoCaja: ultimo.saldo_caja_cierre,
  };
}

// ---------------------------------------------------------------------------
// Series para las gráficas
// ---------------------------------------------------------------------------

/** Base común de todos los puntos: etiqueta del eje y si el periodo está cerrado. */
export interface PuntoSerie {
  periodo: string;
  cerrado: boolean;
}

export interface PuntoFacturacionEbitda extends PuntoSerie {
  facturacion: number | null;
  ebitda: number | null;
  margenPct: number | null;
}

export function serieFacturacionEbitda(serie: CorpPeriodo[]): PuntoFacturacionEbitda[] {
  return serie.map((f) => ({
    periodo: f.periodo,
    cerrado: esCerrado(f),
    facturacion: f.facturacion,
    ebitda: f.ebitda,
    margenPct: f.margen_ebitda_pct,
  }));
}

export interface PasoPuente {
  nombre: string;
  /** Altura de la barra visible. Negativa en los tramos de gasto. */
  valor: number;
  /** Hueco transparente bajo la barra, que la coloca a la altura del puente. */
  base: number;
  /** Los extremos (facturación y EBITDA) se pintan como totales, no como saltos. */
  total: boolean;
}

/** Por debajo de un euro, un tramo del puente es ruido de redondeo. */
const UMBRAL_TRAMO = 1;

/**
 * Puente de EBITDA del periodo: de la facturación al EBITDA, tramo a tramo.
 *
 * Dos cosas que el puente NO puede confundir, porque significan cosas distintas
 * y la primera versión de esta función las mezclaba en un solo tramo llamado
 * «Ajuste periodificación»:
 *
 *  · **Gasto sin desglosar.** El maestro solo rellena variables/estructura
 *    cuando cuadra con el total, y en las filas agregadas (GRUPO) suma
 *    sociedades donde unas lo tienen y otras no. En GRUPO 2026 2T sobran
 *    278.249 € entre `gastos_totales` y la suma del desglose: eso es gasto
 *    corriente que nadie ha repartido, no una periodificación.
 *  · **Periodificación de verdad.** La diferencia entre el EBITDA que define el
 *    CF y el EBITDA de caja (facturación − gastos). En 2025 1T son los 444.750 €
 *    del Funding Fee VBARE que el aviso 2 del maestro explica.
 *
 * Por eso el desglose se cierra siempre contra `gastos_totales`, y el salto a
 * EBITDA se calcula aparte. Así el puente cuadra y cada tramo dice la verdad.
 *
 * Cuando no hay desglose (GIIC 2021-2023), cae a un único tramo de gasto total
 * en vez de desaparecer.
 */
export function puenteEbitda(fila: CorpPeriodo | null): PasoPuente[] {
  if (!fila || fila.facturacion === null || fila.ebitda === null) return [];

  const facturacion = fila.facturacion;
  const ebitda = fila.ebitda;
  const gastosTotales = fila.gastos_totales ?? 0;
  const hayDesglose = fila.gastos_variables !== null && fila.gastos_estructura !== null;

  const tramos: { nombre: string; importe: number }[] = [];

  if (hayDesglose) {
    const variables = fila.gastos_variables ?? 0;
    const estructura = fila.gastos_estructura ?? 0;
    tramos.push({ nombre: "Gastos variables", importe: -variables });
    tramos.push({ nombre: "Gastos estructura", importe: -estructura });

    const sinRepartir = gastosTotales - variables - estructura;
    if (Math.abs(sinRepartir) > UMBRAL_TRAMO) {
      tramos.push({ nombre: "Otros gastos", importe: -sinRepartir });
    }
  } else {
    tramos.push({ nombre: "Gastos totales", importe: -gastosTotales });
  }

  // EBITDA − EBITDA de caja: lo que el CF periodifica de otro ejercicio.
  const ajuste = ebitda - (facturacion - gastosTotales);
  if (Math.abs(ajuste) > UMBRAL_TRAMO) {
    tramos.push({ nombre: "Ajuste periodificación", importe: ajuste });
  }

  const pasos: PasoPuente[] = [
    { nombre: "Facturación", valor: facturacion, base: 0, total: true },
  ];
  let acumulado = facturacion;
  for (const tramo of tramos) {
    const siguiente = acumulado + tramo.importe;
    pasos.push({
      nombre: tramo.nombre,
      valor: tramo.importe,
      base: Math.min(acumulado, siguiente),
      total: false,
    });
    acumulado = siguiente;
  }
  pasos.push({ nombre: "EBITDA", valor: ebitda, base: 0, total: true });

  return pasos;
}

export interface PorcionMix {
  nombre: string;
  valor: number;
}

/**
 * Mix de facturación del grupo por sociedad. Sale del desglose que el propio
 * maestro trae en las filas agregadas, no de recomponer sumando otras filas.
 */
export function mixFacturacion(fila: CorpPeriodo | null): PorcionMix[] {
  if (!fila) return [];
  const candidatos: { nombre: string; valor: number | null }[] = [
    { nombre: "ICAM", valor: fila.facturacion_icam },
    { nombre: "ICI", valor: fila.facturacion_ici },
    { nombre: "GIIC", valor: fila.facturacion_giic },
  ];
  return candidatos
    .filter((p) => typeof p.valor === "number" && p.valor !== 0)
    .map((p) => ({ nombre: p.nombre, valor: p.valor as number }));
}

export interface PuntoAum extends PuntoSerie {
  reguladoIcam: number | null;
  noReguladoIci: number | null;
  total: number | null;
  vehiculos: number | null;
}

export function serieAum(serie: CorpPeriodo[]): PuntoAum[] {
  return serie.map((f) => ({
    periodo: f.periodo,
    cerrado: esCerrado(f),
    reguladoIcam: f.aum_regulado_icam,
    noReguladoIci: f.aum_no_regulado_ici,
    total: f.capital_bajo_gestion,
    vehiculos: f.n_vehiculos,
  }));
}

export interface PuntoCaja extends PuntoSerie {
  saldoCaja: number | null;
  ebitdaCaja: number | null;
}

export function serieCaja(serie: CorpPeriodo[]): PuntoCaja[] {
  return serie.map((f) => ({
    periodo: f.periodo,
    cerrado: esCerrado(f),
    saldoCaja: f.saldo_caja_cierre,
    ebitdaCaja: f.ebitda_caja,
  }));
}

export interface PuntoGastos extends PuntoSerie {
  variables: number | null;
  estructura: number | null;
  /** Relleno cuando no hay desglose: así la barra no desaparece. */
  sinDesglose: number | null;
  gastosSobreFacturacionPct: number | null;
}

export function serieEstructuraGastos(serie: CorpPeriodo[]): PuntoGastos[] {
  return serie.map((f) => {
    const hayDesglose = f.gastos_variables !== null && f.gastos_estructura !== null;
    return {
      periodo: f.periodo,
      cerrado: esCerrado(f),
      variables: hayDesglose ? f.gastos_variables : null,
      estructura: hayDesglose ? f.gastos_estructura : null,
      sinDesglose: hayDesglose ? null : f.gastos_totales,
      gastosSobreFacturacionPct: f.gastos_sobre_facturacion_pct,
    };
  });
}

export interface PuntoVariacion extends PuntoSerie {
  variacionPct: number | null;
}

export function serieVarInteranual(serie: CorpPeriodo[]): PuntoVariacion[] {
  return serie
    .filter((f) => f.var_facturacion_interanual_pct !== null)
    .map((f) => ({
      periodo: f.periodo,
      cerrado: esCerrado(f),
      variacionPct: f.var_facturacion_interanual_pct,
    }));
}

// ---------------------------------------------------------------------------
// Comparativa entre sociedades
// ---------------------------------------------------------------------------

export interface FilaComparativa {
  sociedad: Sociedad;
  perimetro: string | null;
  facturacion: number | null;
  gastos: number | null;
  ebitda: number | null;
  margenPct: number | null;
  pesoGrupoPct: number | null;
  /** El periodo puede no existir para una sociedad (ICI+ICAM arranca en 2023). */
  presente: boolean;
}

/**
 * Las tres sociedades en el mismo periodo. Se busca por `periodo` literal y no
 * por índice: ICI+ICAM no tiene filas antes de 2023 y alinear por posición
 * compararía trimestres distintos.
 */
export function comparativaSociedades(
  filas: CorpPeriodo[],
  periodo: string | null,
  tipoPeriodo: TipoPeriodo,
  orden: readonly Sociedad[],
): FilaComparativa[] {
  if (!periodo) return [];
  return orden.map((sociedad) => {
    const fila = filas.find(
      (f) => f.sociedad === sociedad && f.tipo_periodo === tipoPeriodo && f.periodo === periodo,
    );
    if (!fila) {
      return {
        sociedad,
        perimetro: null,
        facturacion: null,
        gastos: null,
        ebitda: null,
        margenPct: null,
        pesoGrupoPct: null,
        presente: false,
      };
    }
    return {
      sociedad,
      perimetro: fila.perimetro,
      facturacion: fila.facturacion,
      gastos: fila.gastos_totales,
      ebitda: fila.ebitda,
      margenPct: fila.margen_ebitda_pct,
      pesoGrupoPct: fila.peso_sobre_facturacion_grupo_pct,
      presente: true,
    };
  });
}

// ---------------------------------------------------------------------------
// Detalle
// ---------------------------------------------------------------------------

export interface CeldaEstacionalidad {
  anio: number;
  trimestre: number;
  facturacion: number | null;
  cerrado: boolean;
}

export interface MatrizEstacionalidad {
  anios: number[];
  celdas: CeldaEstacionalidad[];
  /** Máximo de la matriz, para escalar la intensidad de color. */
  maximo: number;
}

/** Matriz año × trimestre de facturación: deja ver que 2T y 4T concentran el año. */
export function matrizEstacionalidad(serieTrimestral: CorpPeriodo[]): MatrizEstacionalidad {
  const celdas: CeldaEstacionalidad[] = serieTrimestral
    .filter((f) => f.anio !== null && f.trimestre !== null)
    .map((f) => ({
      anio: f.anio!,
      trimestre: f.trimestre!,
      facturacion: f.facturacion,
      cerrado: esCerrado(f),
    }));

  const anios = [...new Set(celdas.map((c) => c.anio))].sort((a, b) => a - b);
  const maximo = celdas.reduce((max, c) => Math.max(max, c.facturacion ?? 0), 0);

  return { anios, celdas, maximo };
}

export interface PuntoCuentas {
  anio: number;
  /** Cifra de negocio de las cuentas depositadas. */
  cuentas: number | null;
  /** Facturación del cash flow de gestión, para contrastarla. */
  gestion: number | null;
  resultadoExplotacion: number | null;
  resultadoEjercicio: number | null;
  totalActivo: number | null;
  patrimonioNeto: number | null;
  efectivo: number | null;
}

/**
 * Cuentas oficiales depositadas frente a la facturación de gestión. Solo GIIC y
 * solo filas de tipo AÑO: es lo único que trae el maestro.
 */
export function serieCuentasOficiales(filas: CorpPeriodo[]): PuntoCuentas[] {
  return filasDe(filas, "GIIC", "AÑO")
    .filter((f) => f.anio !== null && f.cifra_negocio_cuentas !== null)
    .map((f) => ({
      anio: f.anio!,
      cuentas: f.cifra_negocio_cuentas,
      gestion: f.facturacion,
      resultadoExplotacion: f.resultado_explotacion_cuentas,
      resultadoEjercicio: f.resultado_ejercicio_cuentas,
      totalActivo: f.total_activo,
      patrimonioNeto: f.patrimonio_neto,
      efectivo: f.efectivo_balance,
    }));
}

/** Los años presentes en el maestro, para el selector «Desde» de la barra. */
export function aniosDisponibles(filas: CorpPeriodo[]): number[] {
  return [...new Set(filas.map((f) => f.anio).filter((a): a is number => a !== null))].sort(
    (a, b) => a - b,
  );
}
