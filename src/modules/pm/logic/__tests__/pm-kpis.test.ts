import assert from "node:assert/strict";
import { test } from "node:test";

import type { PmHitoEnriched, PmPortfolioRow } from "@/modules/pm/data/pmRepository";
import {
  hitoActualYPendiente,
  meanAbsLevantamiento,
  portfolioPmKpis,
  trafficLightForActiv,
} from "../pm-kpis";

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

function row(hitos: PmHitoEnriched[]): PmPortfolioRow {
  return {
    activo: { id: "a1", id_activo: "GQ8", tipo_uso_activo: "APT", nombre_display: null },
    hitos,
  };
}

// === meanAbsLevantamiento: undefined vs null ===================================
// El repositorio rellena `desviacion_lev_derivada` SIEMPRE (aunque sea a null).
// Distinguir "no calculado" (undefined) de "calculado y sin plan vigente" (null)
// es lo que evita que el KPI se quede leyendo el valor rancio del Excel después
// de que la PMO borre una fecha en Planificación.

test("usa la desviación derivada e ignora la columna del Excel", () => {
  const r = row([
    hito({ desviacion_lev_derivada: 30, desviacion_vs_levantamiento_dias: 999 }),
  ]);
  assert.equal(meanAbsLevantamiento(r), 30);
});

test("derivada null NO cae al valor del Excel: es un null calculado", () => {
  // Caso real: la PMO borra fecha_actual. Sin plan vigente no hay desviación,
  // aunque el Excel dejara 240 días grabados de antes.
  const r = row([
    hito({ desviacion_lev_derivada: null, desviacion_vs_levantamiento_dias: 240 }),
  ]);
  assert.equal(
    meanAbsLevantamiento(r),
    null,
    "con ?? habría devuelto 240, el valor rancio",
  );
});

test("sin derivada (undefined) sí cae al Excel: nadie la calculó", () => {
  // Un row que no pasó por fetchPmPortfolio, p. ej. desde un script.
  const r = row([hito({ desviacion_vs_levantamiento_dias: 60 })]);
  assert.equal(meanAbsLevantamiento(r), 60);
});

test("promedia en valor absoluto: adelantarse también es desviarse", () => {
  const r = row([
    hito({ id: "h1", desviacion_lev_derivada: -60 }),
    hito({ id: "h2", desviacion_lev_derivada: 120 }),
  ]);
  assert.equal(meanAbsLevantamiento(r), 90);
});

test("los hitos sin desviación no cuentan en la media", () => {
  const r = row([
    hito({ id: "h1", desviacion_lev_derivada: 100 }),
    hito({ id: "h2", desviacion_lev_derivada: null }),
  ]);
  assert.equal(meanAbsLevantamiento(r), 100, "el null no debe arrastrar la media a 50");
});

test("sin ningún hito con desviación devuelve null, no 0", () => {
  assert.equal(meanAbsLevantamiento(row([hito({ desviacion_lev_derivada: null })])), null);
  assert.equal(meanAbsLevantamiento(row([])), null);
});

// === Semáforo =================================================================

test("semáforo: verde <2 meses, ámbar hasta 6, rojo por encima", () => {
  assert.equal(trafficLightForActiv(0), "green");
  assert.equal(trafficLightForActiv(30), "green"); // 1 mes
  assert.equal(trafficLightForActiv(75), "yellow"); // 2,5 → 3 meses
  assert.equal(trafficLightForActiv(180), "yellow"); // 6 meses justos, incluido
  assert.equal(trafficLightForActiv(200), "red"); // 6,7 → 7 meses
});

test("semáforo en las fronteras exactas de mes", () => {
  // El redondeo es días/30, así que la frontera no cae en días redondos: hay
  // 15 días de diferencia entre verde y ámbar.
  assert.equal(trafficLightForActiv(44), "green", "44/30 = 1,47 → 1 mes");
  assert.equal(trafficLightForActiv(45), "yellow", "45/30 = 1,5 → 2 meses");
  assert.equal(trafficLightForActiv(59), "yellow", "59/30 = 1,97 → 2 meses, ya no es verde");
  assert.equal(trafficLightForActiv(194), "yellow", "194/30 = 6,47 → 6 meses");
  assert.equal(trafficLightForActiv(195), "red", "195/30 = 6,5 → 7 meses");
});

test("sin desviación el semáforo es verde, no rojo", () => {
  // Un proyecto sin levantamiento no es un proyecto en riesgo.
  assert.equal(trafficLightForActiv(null), "green");
});

// === Hito actual y próximo ====================================================

const HOY = new Date(2026, 5, 15); // 15 jun 2026

test("hito actual es el último cumplido; próximo, el primero pendiente", () => {
  const r = row([
    hito({ id: "h1", hito: "ARRAS", orden_hito: 1, fecha_actual: "2026-01-10" }),
    hito({ id: "h2", hito: "Inicio de obra", orden_hito: 2, fecha_actual: "2026-03-01" }),
    hito({ id: "h3", hito: "Fin de obra", orden_hito: 3, fecha_actual: "2026-12-01" }),
  ]);
  const { ultimoCumplido, proximo } = hitoActualYPendiente(r, HOY);
  assert.equal(ultimoCumplido?.hito, "Inicio de obra");
  assert.equal(proximo?.hito, "Fin de obra");
});

test("un hito sin fecha cuenta como próximo", () => {
  const r = row([
    hito({ id: "h1", hito: "ARRAS", orden_hito: 1, fecha_actual: "2026-01-10" }),
    hito({ id: "h2", hito: "Licitación", orden_hito: 2, fecha_actual: null }),
  ]);
  const { ultimoCumplido, proximo } = hitoActualYPendiente(r, HOY);
  assert.equal(ultimoCumplido?.hito, "ARRAS");
  assert.equal(proximo?.hito, "Licitación");
});

test("un hito que vence HOY cuenta como cumplido", () => {
  // REGRESIÓN: parsePmDate ancla a las 12:00 y antes se comparaba contra la
  // medianoche de hoy, así que el día exacto del vencimiento el hito salía como
  // pendiente pese al rótulo «con fecha ≤ hoy». Fallaba solo ese día.
  const r = row([hito({ hito: "ARRAS", fecha_actual: "2026-06-15" })]);
  const { ultimoCumplido, proximo } = hitoActualYPendiente(r, HOY);
  assert.equal(ultimoCumplido?.hito, "ARRAS");
  assert.equal(proximo, null);
});

test("un hito que vence mañana sigue pendiente", () => {
  const r = row([hito({ hito: "ARRAS", fecha_actual: "2026-06-16" })]);
  const { ultimoCumplido, proximo } = hitoActualYPendiente(r, HOY);
  assert.equal(ultimoCumplido, null);
  assert.equal(proximo?.hito, "ARRAS");
});

test("la hora de `today` no altera el recuento de cumplidos", () => {
  // Da igual que se consulte a las 00:01 o a las 23:59: el corte es el día.
  const r = row([hito({ fecha_actual: "2026-06-15" })]);
  for (const h of [0, 12, 23]) {
    const t = new Date(2026, 5, 15, h, 30);
    assert.equal(portfolioPmKpis([r], t).hitosCompletados, 1, `falla a las ${h}:30`);
  }
});

test("con todo pendiente no hay hito actual", () => {
  const r = row([hito({ hito: "ARRAS", fecha_actual: "2027-01-01" })]);
  const { ultimoCumplido, proximo } = hitoActualYPendiente(r, HOY);
  assert.equal(ultimoCumplido, null);
  assert.equal(proximo?.hito, "ARRAS");
});

// === KPIs del portfolio =======================================================

test("los KPIs del Overview cuadran", () => {
  const rows: PmPortfolioRow[] = [
    {
      activo: { id: "a1", id_activo: "GQ8", tipo_uso_activo: "APT", nombre_display: null },
      hitos: [
        hito({ id: "h1", fecha_actual: "2026-01-01", desviacion_lev_derivada: 60 }),
        hito({ id: "h2", fecha_actual: "2027-01-01", desviacion_lev_derivada: 120 }),
      ],
    },
    {
      activo: { id: "a2", id_activo: "CA1", tipo_uso_activo: "RESIDENCIAL_LIBRE", nombre_display: null },
      hitos: [hito({ id: "h3", fecha_actual: "2026-01-01", desviacion_lev_derivada: 300 })],
    },
  ];
  const k = portfolioPmKpis(rows, HOY);

  assert.equal(k.nProyectos, 2);
  assert.equal(k.totalHitos, 3);
  assert.equal(k.hitosCompletados, 2, "solo los de fecha ≤ hoy");
  assert.equal(k.desviacionMediaPortfolio, 195, "media de medias: (90 + 300) / 2");
  assert.equal(k.proyectoMayorRetraso, "CA1");
});

test("un portfolio vacío no revienta ni inventa ceros", () => {
  const k = portfolioPmKpis([], HOY);
  assert.equal(k.nProyectos, 0);
  assert.equal(k.desviacionMediaPortfolio, null);
  assert.equal(k.proyectoMayorRetraso, null);
});
