import assert from "node:assert/strict";
import { test } from "node:test";

import type { PmHitoEnriched } from "@/modules/pm/data/pmRepository";
import {
  buildGanttSegmentsForProject,
  buildPmDeviationRows,
  compareQuarterCodes,
  deviationDaysToMonths,
  deviationVsLevantamientoDays,
  formatDeviationMonths,
  formatSnapshotLabel,
  isPmPuntoHito,
  latestHitoDates,
  normalizePmDate,
  parseQuarterCode,
  quarterCodesFromSnapshotList,
} from "../pm-viz";

function hito(over: Partial<PmHitoEnriched> = {}): PmHitoEnriched {
  return {
    id: "h1",
    activo_id: "a1",
    hito: "Inicio de obra",
    orden_hito: 1,
    fecha_actual: null,
    desviacion_vs_anterior_dias: null,
    desviacion_vs_levantamiento_dias: null,
    snapshots: {},
    ...over,
  };
}

/**
 * Fecha local en ISO. NO se usa toISOString(): convierte a UTC, y en Madrid el
 * 1 de marzo a medianoche sale como «2026-02-28». Las fechas de PM son días de
 * calendario, no instantes.
 */
const iso = (d: Date | null) =>
  d
    ? `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
        d.getDate(),
      ).padStart(2, "0")}`
    : null;

// === normalizePmDate ==========================================================

test("normalizePmDate descarta los centinelas de Excel", () => {
  // El maestro usa 1899-12-30 como «vacío»; pintarlo estiraría el eje 120 años.
  assert.equal(normalizePmDate("1899-12-30"), null);
  assert.equal(normalizePmDate("1899-12-31"), null);
});

test("normalizePmDate descarta vacíos y nulos", () => {
  for (const v of [null, undefined, "", "   "]) {
    assert.equal(normalizePmDate(v), null, `debería descartar ${JSON.stringify(v)}`);
  }
});

test("normalizePmDate acepta una fecha normal", () => {
  assert.equal(iso(normalizePmDate("2026-06-15")), "2026-06-15");
});

test("normalizePmDate tolera timestamps completos", () => {
  assert.equal(iso(normalizePmDate("2026-06-15T00:00:00.000Z")), "2026-06-15");
});

// === Códigos de trimestre =====================================================

test("parseQuarterCode acepta AAAA_Qn y rechaza el resto", () => {
  assert.deepEqual(parseQuarterCode("2026_Q2"), { y: 2026, q: 2 });
  assert.deepEqual(parseQuarterCode("2026_q2"), { y: 2026, q: 2 });
  assert.equal(parseQuarterCode("2026_Q5"), null);
  assert.equal(parseQuarterCode("levantamiento"), null);
  assert.equal(parseQuarterCode("fecha_actual"), null);
});

test("compareQuarterCodes ordena cronológicamente cruzando el año", () => {
  const codes = ["2026_Q1", "2025_Q2", "2026_Q2", "2025_Q4"];
  assert.deepEqual([...codes].sort(compareQuarterCodes), [
    "2025_Q2",
    "2025_Q4",
    "2026_Q1",
    "2026_Q2",
  ]);
});

test("quarterCodesFromSnapshotList quita levantamiento y ordena desc", () => {
  const r = quarterCodesFromSnapshotList(["2025_Q4", "levantamiento", "2026_Q1", "2025_Q4"]);
  assert.deepEqual(r, ["2026_Q1", "2025_Q4"]);
});

test("formatSnapshotLabel humaniza los códigos", () => {
  assert.equal(formatSnapshotLabel("fecha_actual"), "Fecha actual");
  assert.equal(formatSnapshotLabel("2026_Q2"), "Q2 2026");
  assert.equal(formatSnapshotLabel("levantamiento"), "levantamiento");
});

// === Desviación ===============================================================

test("la desviación es fecha_actual − levantamiento", () => {
  const h = hito({
    fecha_actual: "2026-03-02", // 60 días después
    snapshots: { levantamiento: "2026-01-01" },
  });
  assert.equal(deviationVsLevantamientoDays(h), 60);
});

test("adelantarse da desviación negativa", () => {
  const h = hito({
    fecha_actual: "2025-12-02",
    snapshots: { levantamiento: "2026-01-01" },
  });
  assert.equal(deviationVsLevantamientoDays(h), -30);
});

test("REGRESIÓN: sin fecha_actual no hay desviación, aunque haya snapshots", () => {
  // Este es el caso de los 3 hitos «Incio pago renta» del maestro: sin previsión
  // vigente pero con trimestres antiguos. Derivar de «la última fecha
  // disponible» les inventaba 274 días que el Excel dejaba a NULL, y eso movía
  // la media del KPI.
  const h = hito({
    fecha_actual: null,
    snapshots: { levantamiento: "2026-01-01", "2025_Q4": "2026-10-01" },
  });
  assert.equal(deviationVsLevantamientoDays(h), null);
});

test("sin levantamiento no hay contra qué comparar", () => {
  const h = hito({ fecha_actual: "2026-03-02", snapshots: {} });
  assert.equal(deviationVsLevantamientoDays(h), null);
});

test("un levantamiento centinela no cuenta como baseline", () => {
  const h = hito({
    fecha_actual: "2026-03-02",
    snapshots: { levantamiento: "1899-12-30" },
  });
  assert.equal(deviationVsLevantamientoDays(h), null);
});

test("deviationDaysToMonths redondea a meses de 30 días", () => {
  assert.equal(deviationDaysToMonths(60), 2);
  assert.equal(deviationDaysToMonths(45), 2); // 1,5 → 2
  assert.equal(deviationDaysToMonths(-60), -2);
  assert.equal(deviationDaysToMonths(null), null);
});

test("formatDeviationMonths pone el signo y marca los huecos", () => {
  assert.equal(formatDeviationMonths(60), "+2 m");
  assert.equal(formatDeviationMonths(-60), "-2 m");
  assert.equal(formatDeviationMonths(0), "0 m");
  assert.equal(formatDeviationMonths(null), "N/A");
});

// === latestHitoDates ==========================================================

test("latestHitoDates prefiere fecha_actual sobre los trimestres", () => {
  const h = hito({
    fecha_actual: "2026-06-01",
    snapshots: { "2025_Q4": "2026-03-01", "2026_Q1": "2026-04-01" },
  });
  const { latest, prev } = latestHitoDates(h, ["2025_Q4", "2026_Q1"]);
  assert.equal(iso(latest), "2026-06-01");
  assert.equal(iso(prev), "2026-04-01", "el anterior es el trimestre más reciente");
});

test("latestHitoDates cae al último trimestre si no hay fecha_actual", () => {
  const h = hito({
    fecha_actual: null,
    snapshots: { "2025_Q4": "2026-03-01", "2026_Q1": "2026-04-01" },
  });
  const { latest, prev } = latestHitoDates(h, ["2025_Q4", "2026_Q1"]);
  assert.equal(iso(latest), "2026-04-01");
  assert.equal(iso(prev), "2026-03-01");
});

test("latestHitoDates ignora los trimestres sin fecha", () => {
  const h = hito({
    fecha_actual: null,
    snapshots: { "2025_Q4": "2026-03-01", "2026_Q1": null },
  });
  const { latest, prev } = latestHitoDates(h, ["2025_Q4", "2026_Q1"]);
  assert.equal(iso(latest), "2026-03-01");
  assert.equal(prev, null);
});

// === Hitos puntuales ==========================================================

test("isPmPuntoHito reconoce los 4 hitos sin duración", () => {
  // Coincide con los 4 que marca el catálogo tras el backfill.
  assert.equal(isPmPuntoHito("ARRAS"), true);
  assert.equal(isPmPuntoHito("Obtencion licencia"), true);
  assert.equal(isPmPuntoHito("Salida del Vehiculo"), true);
  assert.equal(isPmPuntoHito("Entrega llaves Operador"), true);
});

test("isPmPuntoHito no marca los hitos con duración", () => {
  assert.equal(isPmPuntoHito("Inicio de obra"), false);
  assert.equal(isPmPuntoHito("Anteproyecto"), false);
  assert.equal(isPmPuntoHito("Solicitud de licencia"), false);
});

test("isPmPuntoHito tolera tildes y mayúsculas", () => {
  assert.equal(isPmPuntoHito("obtención licencia"), true);
  assert.equal(isPmPuntoHito("SALIDA DEL VEHÍCULO"), true);
});

// === Segmentos del Gantt ======================================================

const VENTANA_INI = new Date(2024, 0, 1);
const VENTANA_FIN = new Date(2030, 0, 1);

test("un hito dura hasta el siguiente con fecha", () => {
  const hitos = [
    hito({ id: "h1", hito: "Inicio de obra", orden_hito: 1, fecha_actual: "2026-01-01" }),
    hito({ id: "h2", hito: "Fin de obra", orden_hito: 2, fecha_actual: "2026-10-01" }),
  ];
  const segs = buildGanttSegmentsForProject(hitos, "fecha_actual", VENTANA_INI, VENTANA_FIN);
  assert.equal(segs.length, 2);
  assert.equal(iso(segs[0].start), "2026-01-01");
  assert.equal(iso(segs[0].end), "2026-10-01", "acaba donde empieza el siguiente");
});

test("los hitos puntuales duran exactamente un trimestre", () => {
  const hitos = [
    hito({ id: "h1", hito: "ARRAS", orden_hito: 1, fecha_actual: "2026-01-01" }),
    hito({ id: "h2", hito: "Fin de obra", orden_hito: 2, fecha_actual: "2027-01-01" }),
  ];
  const segs = buildGanttSegmentsForProject(hitos, "fecha_actual", VENTANA_INI, VENTANA_FIN);
  assert.equal(
    iso(segs[0].end),
    "2026-04-01",
    "ARRAS es puntual: 3 meses, no hasta el hito siguiente",
  );
});

test("un hito con duración corta se estira al mínimo visual de un trimestre", () => {
  const hitos = [
    hito({ id: "h1", hito: "Inicio de obra", orden_hito: 1, fecha_actual: "2026-01-01" }),
    hito({ id: "h2", hito: "Fin de obra", orden_hito: 2, fecha_actual: "2026-01-20" }),
  ];
  const segs = buildGanttSegmentsForProject(hitos, "fecha_actual", VENTANA_INI, VENTANA_FIN);
  assert.equal(iso(segs[0].end), "2026-04-01", "19 días serían invisibles en el Gantt");
});

test("los hitos sin fecha no pintan segmento", () => {
  const hitos = [
    hito({ id: "h1", hito: "Inicio de obra", orden_hito: 1, fecha_actual: null }),
    hito({ id: "h2", hito: "Fin de obra", orden_hito: 2, fecha_actual: "2026-10-01" }),
  ];
  const segs = buildGanttSegmentsForProject(hitos, "fecha_actual", VENTANA_INI, VENTANA_FIN);
  assert.equal(segs.length, 1);
  assert.equal(segs[0].hitoName, "Fin de obra");
});

test("un hito salta por encima del siguiente si ese no tiene fecha", () => {
  const hitos = [
    hito({ id: "h1", hito: "Inicio de obra", orden_hito: 1, fecha_actual: "2026-01-01" }),
    hito({ id: "h2", hito: "Trámites", orden_hito: 2, fecha_actual: null }),
    hito({ id: "h3", hito: "Fin de obra", orden_hito: 3, fecha_actual: "2026-10-01" }),
  ];
  const segs = buildGanttSegmentsForProject(hitos, "fecha_actual", VENTANA_INI, VENTANA_FIN);
  assert.equal(iso(segs[0].end), "2026-10-01", "llega hasta el siguiente CON fecha");
});

test("los segmentos se recortan a la ventana visible", () => {
  const hitos = [hito({ hito: "Inicio de obra", fecha_actual: "2026-01-01" })];
  const segs = buildGanttSegmentsForProject(
    hitos,
    "fecha_actual",
    new Date(2026, 2, 1), // la ventana empieza DESPUÉS del hito
    VENTANA_FIN,
  );
  assert.equal(iso(segs[0].start), "2026-03-01", "recortado al inicio de la ventana");
});

test("un hito sin sucesor se estira hasta el fin de la ventana", () => {
  // Si nada viene después no se sabe cuándo acaba, así que ocupa lo que queda:
  // aunque empiece antes de la ventana, su barra sigue siendo visible.
  const hitos = [hito({ hito: "Inicio de obra", fecha_actual: "2020-01-01" })];
  const segs = buildGanttSegmentsForProject(
    hitos,
    "fecha_actual",
    new Date(2026, 0, 1),
    VENTANA_FIN,
  );
  assert.equal(segs.length, 1);
  assert.equal(iso(segs[0].start), "2026-01-01", "recortado al inicio de la ventana");
  assert.equal(iso(segs[0].end), "2030-01-01");
});

test("un hito puntual que acaba antes de la ventana no pinta nada", () => {
  // Puntual = 3 meses fijos, así que este termina en abr-2020 y queda entero
  // fuera de una ventana que empieza en 2026.
  const hitos = [hito({ hito: "ARRAS", fecha_actual: "2020-01-01" })];
  const segs = buildGanttSegmentsForProject(
    hitos,
    "fecha_actual",
    new Date(2026, 0, 1),
    VENTANA_FIN,
  );
  assert.equal(segs.length, 0);
});

test("el segmento lleva la desviación vs levantamiento para el tooltip", () => {
  const hitos = [
    hito({
      hito: "Inicio de obra",
      fecha_actual: "2026-03-02",
      snapshots: { levantamiento: "2026-01-01" },
    }),
  ];
  const segs = buildGanttSegmentsForProject(hitos, "fecha_actual", VENTANA_INI, VENTANA_FIN);
  assert.equal(segs[0].deviationVsBaselineDays, 60);
  assert.equal(iso(segs[0].baseline), "2026-01-01");
});

test("el Gantt de un snapshot usa las fechas de ese snapshot", () => {
  const hitos = [
    hito({
      hito: "Inicio de obra",
      fecha_actual: "2026-06-01",
      snapshots: { "2025_Q4": "2026-01-01" },
    }),
  ];
  const segs = buildGanttSegmentsForProject(hitos, "2025_Q4", VENTANA_INI, VENTANA_FIN);
  assert.equal(iso(segs[0].start), "2026-01-01", "no la previsión vigente");
});

// === Tabla de desviaciones ====================================================

test("la tendencia marca «worse» cuando el hito se retrasa entre reportes", () => {
  const hitos = [
    hito({
      hito: "Inicio de obra",
      fecha_actual: "2026-10-01", // +9 meses vs levantamiento
      snapshots: { levantamiento: "2026-01-01", "2025_Q4": "2026-03-01" }, // +2
    }),
  ];
  const rows = buildPmDeviationRows(hitos, ["2025_Q4"]);
  assert.equal(rows[0].trend, "worse");
});

test("la tendencia marca «better» cuando se adelanta", () => {
  const hitos = [
    hito({
      hito: "Inicio de obra",
      fecha_actual: "2026-02-01",
      snapshots: { levantamiento: "2026-01-01", "2025_Q4": "2026-10-01" },
    }),
  ];
  const rows = buildPmDeviationRows(hitos, ["2025_Q4"]);
  assert.equal(rows[0].trend, "better");
});

test("un movimiento de un mes es «stable»: es ruido de planificación", () => {
  const hitos = [
    hito({
      hito: "Inicio de obra",
      fecha_actual: "2026-04-01",
      snapshots: { levantamiento: "2026-01-01", "2025_Q4": "2026-03-01" },
    }),
  ];
  const rows = buildPmDeviationRows(hitos, ["2025_Q4"]);
  assert.equal(rows[0].trend, "stable");
});

test("sin reporte anterior no hay tendencia", () => {
  const hitos = [
    hito({
      hito: "Inicio de obra",
      fecha_actual: "2026-04-01",
      snapshots: { levantamiento: "2026-01-01" },
    }),
  ];
  const rows = buildPmDeviationRows(hitos, []);
  assert.equal(rows[0].trend, null);
});

test("las filas de desviación salen ordenadas por orden_hito", () => {
  const hitos = [
    hito({ id: "h2", hito: "Fin de obra", orden_hito: 2 }),
    hito({ id: "h1", hito: "Inicio de obra", orden_hito: 1 }),
  ];
  const rows = buildPmDeviationRows(hitos, []);
  assert.deepEqual(
    rows.map((r) => r.hito),
    ["Inicio de obra", "Fin de obra"],
  );
});
