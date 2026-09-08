import assert from "node:assert/strict";
import { test } from "node:test";

import {
  buildKpis,
  comparativaSociedades,
  matrizEstacionalidad,
  mixFacturacion,
  periodoCorte,
  periodoReferencia,
  puenteEbitda,
  serieCuentasOficiales,
  serieDe,
  serieEstructuraGastos,
  ultimoTrimestreReal,
} from "../calculations";
import type { CorpPeriodo, Sociedad } from "@/modules/corporativo/types";

/**
 * Las cifras de estas fixtures salen del maestro real (GRUPO 2025 y 2026), para
 * que un cambio en la lógica choque contra números que alguien puede contrastar
 * abriendo el Excel, no contra valores inventados.
 */

function fila(over: Partial<CorpPeriodo> & Pick<CorpPeriodo, "id">): CorpPeriodo {
  return {
    sociedad: "GRUPO",
    perimetro: "Consolidado del grupo Impar",
    es_ultima_fila: 0,
    periodo: "2025 1T",
    tipo_periodo: "TRIMESTRE",
    anio: 2025,
    trimestre: 1,
    fecha_inicio: null,
    fecha_fin: null,
    meses: 3,
    naturaleza: "REAL",
    facturacion: null,
    gastos_totales: null,
    gastos_variables: null,
    gastos_estructura: null,
    ebitda: null,
    margen_ebitda_pct: null,
    gastos_sobre_facturacion_pct: null,
    ebitda_caja: null,
    ajuste_periodificacion: null,
    facturacion_acumulada_anio: null,
    var_facturacion_interanual_pct: null,
    saldo_caja_cierre: null,
    saldo_banco_cierre: null,
    capital_bajo_gestion: null,
    aum_regulado_icam: null,
    aum_no_regulado_ici: null,
    n_vehiculos: null,
    fee_sobre_aum_pct: null,
    facturacion_por_vehiculo: null,
    facturacion_icam: null,
    facturacion_ici: null,
    facturacion_giic: null,
    ebitda_icam: null,
    ebitda_ici: null,
    ebitda_giic: null,
    peso_sobre_facturacion_grupo_pct: null,
    cifra_negocio_cuentas: null,
    resultado_explotacion_cuentas: null,
    resultado_ejercicio_cuentas: null,
    total_activo: null,
    patrimonio_neto: null,
    efectivo_balance: null,
    volumen_intermediado: null,
    n_proyectos_giic: null,
    ...over,
  };
}

/** Los cuatro trimestres de 2025 y los cuatro de 2026 de GRUPO. */
const TRIMESTRES: CorpPeriodo[] = [
  fila({ id: "GRUPO|20251T", periodo: "2025 1T", anio: 2025, trimestre: 1, facturacion: 705895, ebitda: 57834 }),
  fila({ id: "GRUPO|20252T", periodo: "2025 2T", anio: 2025, trimestre: 2, facturacion: 3040144, ebitda: 695970 }),
  fila({ id: "GRUPO|20253T", periodo: "2025 3T", anio: 2025, trimestre: 3, facturacion: 510077, ebitda: -256368 }),
  fila({ id: "GRUPO|20254T", periodo: "2025 4T", anio: 2025, trimestre: 4, facturacion: 1304219, ebitda: 515846 }),
  fila({
    id: "GRUPO|20261T",
    periodo: "2026 1T",
    anio: 2026,
    trimestre: 1,
    facturacion: 2478626,
    ebitda: 731652,
    facturacion_acumulada_anio: 2478626,
  }),
  fila({
    id: "GRUPO|20262T",
    periodo: "2026 2T",
    anio: 2026,
    trimestre: 2,
    es_ultima_fila: 1,
    facturacion: 1236990,
    gastos_totales: 885136,
    gastos_variables: 57937,
    gastos_estructura: 548950,
    ebitda: 351854,
    margen_ebitda_pct: 0.2844,
    facturacion_acumulada_anio: 3715616,
    var_facturacion_interanual_pct: -0.5931,
    saldo_caja_cierre: 216325,
    capital_bajo_gestion: 180482090.91,
    aum_regulado_icam: 120482090.91,
    aum_no_regulado_ici: 60000000,
    n_vehiculos: 10,
    fee_sobre_aum_pct: 0.0274,
    facturacion_icam: 700000,
    facturacion_ici: 300000,
    facturacion_giic: 236990,
  }),
  fila({
    id: "GRUPO|20263T",
    periodo: "2026 3T",
    anio: 2026,
    trimestre: 3,
    naturaleza: "PREVISIÓN",
    facturacion: 1641122,
    ebitda: 533032,
  }),
  fila({
    id: "GRUPO|20264T",
    periodo: "2026 4T",
    anio: 2026,
    trimestre: 4,
    naturaleza: "PREVISIÓN",
    facturacion: 2657471,
    ebitda: 1273775,
  }),
];

const ANIOS: CorpPeriodo[] = [
  fila({
    id: "GRUPO|2025",
    periodo: "2025",
    tipo_periodo: "AÑO",
    anio: 2025,
    trimestre: null,
    meses: 12,
    facturacion: 5560335.35,
    ebitda: 1013282.68,
  }),
  fila({
    id: "GRUPO|2026",
    periodo: "2026",
    tipo_periodo: "AÑO",
    anio: 2026,
    trimestre: null,
    meses: 12,
    naturaleza: "MIXTO",
    facturacion: 8014209.76,
    ebitda: 2890314.18,
  }),
];

const ACUMULADO: CorpPeriodo[] = [
  fila({
    id: "GRUPO|ALLTIME",
    periodo: "ALL TIME",
    tipo_periodo: "ACUMULADO",
    anio: null,
    trimestre: null,
    naturaleza: "MIXTO",
    facturacion: 23101498.9,
    ebitda: 6483017.85,
  }),
];

const TODAS = [...TRIMESTRES, ...ANIOS, ...ACUMULADO];

// ---------------------------------------------------------------------------
// Regla 1: nunca mezclar tipo_periodo
// ---------------------------------------------------------------------------

test("serieDe aísla un único tipo_periodo", () => {
  // Si se colara una fila de AÑO o de ACUMULADO en la serie trimestral, la
  // facturación del grupo se contaría tres veces. Es el error que la hoja NOTAS
  // avisa en su punto 6.
  const trimestral = serieDe(TODAS, {
    sociedad: "GRUPO",
    granularidad: "trimestre",
    incluirPrevision: true,
  });
  assert.equal(trimestral.length, 8);
  assert.ok(trimestral.every((f) => f.tipo_periodo === "TRIMESTRE"));

  const anual = serieDe(TODAS, {
    sociedad: "GRUPO",
    granularidad: "anio",
    incluirPrevision: true,
  });
  assert.deepEqual(anual.map((f) => f.periodo), ["2025", "2026"]);
});

test("serieDe recorta por año y ordena cronológicamente", () => {
  const serie = serieDe(TODAS, {
    sociedad: "GRUPO",
    granularidad: "trimestre",
    desde: 2026,
    incluirPrevision: true,
  });
  assert.deepEqual(serie.map((f) => f.periodo), ["2026 1T", "2026 2T", "2026 3T", "2026 4T"]);
});

test("ocultar previsión se lleva también los periodos MIXTO", () => {
  // Un año que incluye dos trimestres de previsión no es un cierre. Dejar la
  // barra de 2026 mientras se ocultan sus trimestres 3T y 4T haría que la
  // gráfica se contradijera consigo misma.
  const anual = serieDe(TODAS, {
    sociedad: "GRUPO",
    granularidad: "anio",
    incluirPrevision: false,
  });
  assert.deepEqual(anual.map((f) => f.periodo), ["2025"]);

  const trimestral = serieDe(TODAS, {
    sociedad: "GRUPO",
    granularidad: "trimestre",
    incluirPrevision: false,
  });
  assert.equal(trimestral.length, 6);
  assert.ok(trimestral.every((f) => f.naturaleza === "REAL"));
});

// ---------------------------------------------------------------------------
// Reglas 2, 3 y 4: KPI de cabecera
// ---------------------------------------------------------------------------

test("ultimoTrimestreReal usa la marca del maestro", () => {
  assert.equal(ultimoTrimestreReal(TODAS, "GRUPO")?.periodo, "2026 2T");
});

test("ultimoTrimestreReal cae al último REAL si falta la marca", () => {
  const sinMarca = TRIMESTRES.map((f) => ({ ...f, es_ultima_fila: 0 }));
  assert.equal(ultimoTrimestreReal(sinMarca, "GRUPO")?.periodo, "2026 2T");
});

test("los KPI excluyen la previsión y se anclan al último trimestre cerrado", () => {
  const kpis = buildKpis(TODAS, "GRUPO");

  assert.equal(kpis.periodo, "2026 2T");
  assert.equal(kpis.anio, 2026);
  // YTD 2026 = 1T + 2T. Si colara 3T o 4T (previsión), saldría 8.014.209.
  assert.equal(kpis.facturacionYtd, 3715616);
  assert.equal(kpis.ebitdaYtd, 731652 + 351854);
});

test("el margen YTD es el agregado, no la media de márgenes", () => {
  const kpis = buildKpis(TODAS, "GRUPO");
  assert.equal(kpis.margenYtdPct, (731652 + 351854) / 3715616);
});

test("el margen de los últimos 4T agrega antes de dividir", () => {
  // Promediar los cuatro márgenes daría un número distinto y sin sentido
  // económico: pesa igual un trimestre de 500 k€ que uno de 3 M€.
  const kpis = buildKpis(TODAS, "GRUPO");
  const ebitda4t = -256368 + 515846 + 731652 + 351854;
  const facturacion4t = 510077 + 1304219 + 2478626 + 1236990;
  assert.equal(kpis.margen4tPct, ebitda4t / facturacion4t);
});

test("los saldos se toman del último trimestre, no se suman", () => {
  const kpis = buildKpis(TODAS, "GRUPO");
  assert.equal(kpis.capitalBajoGestion, 180482090.91);
  assert.equal(kpis.vehiculos, 10);
  assert.equal(kpis.saldoCaja, 216325);
});

test("una sociedad sin trimestres devuelve KPI vacíos en vez de reventar", () => {
  const kpis = buildKpis(TODAS, "ICI+ICAM");
  assert.equal(kpis.periodo, null);
  assert.equal(kpis.facturacionYtd, null);
  assert.equal(kpis.margenYtdPct, null);
});

// ---------------------------------------------------------------------------
// Puente de EBITDA
// ---------------------------------------------------------------------------

test("el puente encadena facturación, gastos y EBITDA", () => {
  const pasos = puenteEbitda(TRIMESTRES.find((f) => f.id === "GRUPO|20262T")!);

  assert.equal(pasos[0]!.valor, 1236990);
  assert.equal(pasos[pasos.length - 1]!.valor, 351854);
  // Los tramos intermedios levantan la barra desde su base hasta el acumulado.
  assert.equal(pasos[1]!.base + Math.abs(pasos[1]!.valor), 1236990);

  // Y el puente cierra: facturación más todos los saltos da el EBITDA.
  const saltos = pasos.slice(1, -1).reduce((acc, p) => acc + p.valor, 0);
  assert.ok(Math.abs(pasos[0]!.valor + saltos - 351854) < 1);
});

test("el gasto sin repartir no se disfraza de periodificación", () => {
  // GRUPO 2026 2T: gastos_totales 885.136 pero el desglose solo suma 606.887,
  // porque la fila agrega sociedades y no todas lo publican. Esos 278.249 € son
  // gasto corriente que nadie ha repartido. Aquí el EBITDA de caja coincide con
  // el EBITDA, así que NO hay periodificación y el tramo no debe aparecer.
  const pasos = puenteEbitda(TRIMESTRES.find((f) => f.id === "GRUPO|20262T")!);

  assert.deepEqual(pasos.map((p) => p.nombre), [
    "Facturación",
    "Gastos variables",
    "Gastos estructura",
    "Otros gastos",
    "EBITDA",
  ]);
  assert.equal(pasos.find((p) => p.nombre === "Otros gastos")!.valor, -278249);
});

test("la periodificación sí aparece cuando el EBITDA se aparta del de caja", () => {
  // 2025 1T es el caso del aviso 2 del maestro: el CF de ICI excluye del EBITDA
  // de enero los 444.750 € del Funding Fee VBARE, devengados del ejercicio
  // anterior. El puente tiene que enseñarlos, y como tramo propio.
  const q1 = fila({
    id: "GRUPO|20251T",
    periodo: "2025 1T",
    facturacion: 705895,
    gastos_totales: 1092810,
    gastos_variables: 559994,
    gastos_estructura: 333679,
    ebitda: 57834,
    ebitda_caja: -386916,
  });
  const pasos = puenteEbitda(q1);

  assert.deepEqual(pasos.map((p) => p.nombre), [
    "Facturación",
    "Gastos variables",
    "Gastos estructura",
    "Otros gastos",
    "Ajuste periodificación",
    "EBITDA",
  ]);
  const ajuste = pasos.find((p) => p.nombre === "Ajuste periodificación")!;
  assert.equal(Math.round(ajuste.valor), 444749);
  assert.ok(ajuste.valor > 0, "la periodificación suma: recupera honorarios del ejercicio anterior");

  const saltos = pasos.slice(1, -1).reduce((acc, p) => acc + p.valor, 0);
  assert.ok(Math.abs(705895 + saltos - 57834) < 1, "el puente tiene que cerrar en el EBITDA");
});

test("sin desglose de gastos el puente cae a un solo tramo", () => {
  // GIIC 2021-2023 no trae variables/estructura: el maestro prefiere dejarlo
  // vacío antes que publicar un reparto que no cuadra.
  const sinDesglose = fila({
    id: "GIIC|20211T",
    sociedad: "GIIC",
    facturacion: 393110.68,
    gastos_totales: 311620.32,
    ebitda: 81490.36,
  });
  const pasos = puenteEbitda(sinDesglose);

  assert.deepEqual(pasos.map((p) => p.nombre), ["Facturación", "Gastos totales", "EBITDA"]);
});

test("el puente se rinde si falta facturación o EBITDA", () => {
  assert.deepEqual(puenteEbitda(fila({ id: "x" })), []);
  assert.deepEqual(puenteEbitda(null), []);
});

// ---------------------------------------------------------------------------
// Resto de series
// ---------------------------------------------------------------------------

test("periodoReferencia y periodoCorte marcan el salto real→previsión", () => {
  const serie = serieDe(TODAS, {
    sociedad: "GRUPO",
    granularidad: "trimestre",
    incluirPrevision: true,
  });
  assert.equal(periodoReferencia(serie)?.periodo, "2026 2T");
  assert.equal(periodoCorte(serie), "2026 2T");
});

test("sin previsión en la serie no hay línea de corte que pintar", () => {
  const serie = serieDe(TODAS, {
    sociedad: "GRUPO",
    granularidad: "trimestre",
    incluirPrevision: false,
  });
  assert.equal(periodoCorte(serie), null);
});

test("el mix de facturación descarta las sociedades sin dato", () => {
  const conMix = mixFacturacion(TRIMESTRES.find((f) => f.id === "GRUPO|20262T")!);
  assert.deepEqual(conMix.map((p) => p.nombre), ["ICAM", "ICI", "GIIC"]);

  // 2025 1T no trae desglose por sociedad: mejor nada que tres ceros.
  assert.deepEqual(mixFacturacion(TRIMESTRES[0]!), []);
});

test("la estructura de gastos separa lo desglosado de lo que no lo está", () => {
  const puntos = serieEstructuraGastos([
    TRIMESTRES.find((f) => f.id === "GRUPO|20262T")!,
    fila({ id: "GIIC|20211T", gastos_totales: 311620.32 }),
  ]);

  assert.equal(puntos[0]!.variables, 57937);
  assert.equal(puntos[0]!.sinDesglose, null);
  assert.equal(puntos[1]!.variables, null);
  assert.equal(puntos[1]!.sinDesglose, 311620.32);
});

test("la comparativa alinea por periodo, no por posición", () => {
  // ICI+ICAM no existe antes de 2023: alinear por índice compararía trimestres
  // distintos y el peso sobre el grupo dejaría de sumar 100 %.
  const orden: Sociedad[] = ["GRUPO", "GIIC", "ICI+ICAM"];
  const filas = comparativaSociedades(TODAS, "2026 2T", "TRIMESTRE", orden);

  assert.deepEqual(filas.map((f) => f.sociedad), orden);
  assert.equal(filas[0]!.presente, true);
  assert.equal(filas[0]!.facturacion, 1236990);
  assert.equal(filas[1]!.presente, false);
  assert.equal(filas[1]!.facturacion, null);
});

test("la matriz de estacionalidad indexa por año y trimestre", () => {
  const matriz = matrizEstacionalidad(
    serieDe(TODAS, { sociedad: "GRUPO", granularidad: "trimestre", incluirPrevision: true }),
  );

  assert.deepEqual(matriz.anios, [2025, 2026]);
  assert.equal(matriz.celdas.length, 8);
  assert.equal(matriz.maximo, 3040144);
  const q2 = matriz.celdas.find((c) => c.anio === 2026 && c.trimestre === 2)!;
  assert.equal(q2.facturacion, 1236990);
  assert.equal(q2.cerrado, true);
});

test("las cuentas oficiales solo miran los años de GIIC con cifra depositada", () => {
  const conCuentas = [
    ...TODAS,
    fila({
      id: "GIIC|2024",
      sociedad: "GIIC",
      periodo: "2024",
      tipo_periodo: "AÑO",
      anio: 2024,
      trimestre: null,
      facturacion: 1159010.25,
      cifra_negocio_cuentas: 1176632,
      resultado_ejercicio_cuentas: -9192,
      patrimonio_neto: 99785,
    }),
    // Año de GIIC sin cuentas depositadas: fuera de la serie.
    fila({
      id: "GIIC|2026",
      sociedad: "GIIC",
      periodo: "2026",
      tipo_periodo: "AÑO",
      anio: 2026,
      trimestre: null,
      naturaleza: "MIXTO",
      facturacion: 4077111.8,
    }),
  ];

  const puntos = serieCuentasOficiales(conCuentas);
  assert.equal(puntos.length, 1);
  assert.equal(puntos[0]!.anio, 2024);
  assert.equal(puntos[0]!.cuentas, 1176632);
  assert.equal(puntos[0]!.gestion, 1159010.25);
  assert.equal(puntos[0]!.resultadoEjercicio, -9192);
});
