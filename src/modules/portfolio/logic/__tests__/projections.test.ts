import assert from "node:assert/strict";
import { test } from "node:test";

import {
  CRECIMIENTO_DEFAULT,
  anioVencimiento,
  captacionObjetivo,
  fechaFinEfectiva,
  finEsEstimado,
  pipelineVencimientos,
  sanitizeCrecimiento,
} from "../projections";
import type { Proyecto } from "@/modules/portfolio/types";

const HOY = new Date("2026-06-15");

function proyecto(overrides: Partial<Proyecto> = {}): Proyecto {
  return {
    id: 1,
    proyecto: "P1",
    situacion: "En Marcha",
    tipo_proyecto: "Promoción",
    inversion_total: 10_000_000,
    total_ingresos_venta: null,
    beneficios: null,
    unidades_totales: null,
    tir_desp_is: null,
    roe_desp_is: null,
    multiplo: null,
    project_irr: null,
    bcr: null,
    ubicacion: null,
    equity: 3_000_000,
    entry_yield: null,
    exit_yield: null,
    credito_total: null,
    holding_period: 24,
    superficie_edificable: null,
    es_ultima_fila: 1,
    fecha_inicio: "2026-01-01",
    fecha_fin: null,
    ...overrides,
  };
}

test("fechaFinEfectiva prefiere la fecha del maestro sobre la estimación", () => {
  const conFin = proyecto({ fecha_fin: "2027-12-31", fecha_inicio: "2026-01-01", holding_period: 24 });
  assert.equal(fechaFinEfectiva(conFin)?.getFullYear(), 2027);
  assert.equal(finEsEstimado(conFin), false);
});

test("fechaFinEfectiva estima con holding period cuando falta fecha_fin", () => {
  // 2026-01-01 + 24 meses = 2028-01-01.
  const estimado = proyecto({ fecha_fin: null, fecha_inicio: "2026-01-01", holding_period: 24 });
  assert.equal(fechaFinEfectiva(estimado)?.getFullYear(), 2028);
  assert.equal(finEsEstimado(estimado), true);
});

test("fechaFinEfectiva devuelve null si no hay forma de saber el fin", () => {
  assert.equal(fechaFinEfectiva(proyecto({ fecha_fin: null, fecha_inicio: null })), null);
  assert.equal(
    fechaFinEfectiva(proyecto({ fecha_fin: null, holding_period: 0 })),
    null,
    "holding period a cero no sirve para estimar",
  );
  assert.equal(fechaFinEfectiva(proyecto({ fecha_fin: null, holding_period: -12 })), null);
  assert.equal(anioVencimiento(proyecto({ fecha_fin: null, fecha_inicio: null })), null);
});

test("pipelineVencimientos solo cuenta proyectos En Marcha", () => {
  const rows = [
    proyecto({ id: 1, situacion: "En Marcha", fecha_fin: "2027-06-30" }),
    proyecto({ id: 2, situacion: "Culminado", fecha_fin: "2027-06-30" }),
  ];
  const serie = pipelineVencimientos(rows, { hoy: HOY });
  const total = serie.reduce((acc, a) => acc + a.count, 0);
  assert.equal(total, 1);
});

test("pipelineVencimientos acumula en el año en curso lo ya vencido pero vivo", () => {
  // Un proyecto En Marcha cuyo fin era 2024 sigue pendiente de desinvertir.
  const rows = [proyecto({ fecha_fin: "2024-03-31" })];
  const serie = pipelineVencimientos(rows, { hoy: HOY });
  assert.equal(serie[0].year, 2026);
  assert.equal(serie[0].count, 1);
});

test("pipelineVencimientos devuelve años contiguos, rellenando los vacíos a cero", () => {
  const rows = [
    proyecto({ id: 1, fecha_fin: "2026-12-31" }),
    proyecto({ id: 2, fecha_fin: "2029-12-31" }),
  ];
  const serie = pipelineVencimientos(rows, { hoy: HOY });
  assert.deepEqual(
    serie.map((a) => a.year),
    [2026, 2027, 2028, 2029],
  );
  assert.equal(serie[1].count, 0);
  assert.equal(serie[1].inversion, 0);
});

test("pipelineVencimientos descarta lo que cae fuera del horizonte", () => {
  const rows = [proyecto({ fecha_fin: "2099-12-31" })];
  assert.deepEqual(pipelineVencimientos(rows, { hoy: HOY, horizonteAnios: 3 }), []);
});

test("pipelineVencimientos suma inversión y equity, y marca los estimados", () => {
  const rows = [
    proyecto({ id: 1, fecha_fin: "2027-06-30", inversion_total: 10_000_000, equity: 3_000_000 }),
    proyecto({
      id: 2,
      fecha_fin: null,
      fecha_inicio: "2025-06-30",
      holding_period: 24,
      inversion_total: 5_000_000,
      equity: 1_000_000,
    }),
  ];
  const serie = pipelineVencimientos(rows, { hoy: HOY });
  const y2027 = serie.find((a) => a.year === 2027);
  assert.ok(y2027);
  assert.equal(y2027.count, 2);
  assert.equal(y2027.inversion, 15_000_000);
  assert.equal(y2027.equity, 4_000_000);
  assert.equal(y2027.estimados, 1, "el segundo no trae fecha_fin del maestro");
});

test("captacionObjetivo al 0 % es exactamente lo que vence", () => {
  const pipeline = pipelineVencimientos([proyecto({ fecha_fin: "2027-06-30" })], { hoy: HOY });
  const objetivos = captacionObjetivo(pipeline, 0);
  const y2027 = objetivos.find((a) => a.year === 2027);
  assert.ok(y2027);
  assert.equal(y2027.objetivo, y2027.vence);
  assert.equal(y2027.crecimientoAbsoluto, 0);
});

test("captacionObjetivo aplica el crecimiento pedido", () => {
  const pipeline = pipelineVencimientos(
    [proyecto({ fecha_fin: "2027-06-30", inversion_total: 10_000_000 })],
    { hoy: HOY },
  );
  const y2027 = captacionObjetivo(pipeline, 0.1).find((a) => a.year === 2027);
  assert.ok(y2027);
  assert.equal(y2027.objetivo, 11_000_000);
  assert.equal(y2027.crecimientoAbsoluto, 1_000_000);
});

test("sanitizeCrecimiento admite porcentaje y tanto por uno, y acota la basura", () => {
  assert.equal(sanitizeCrecimiento("10"), 0.1);
  assert.equal(sanitizeCrecimiento("0.1"), 0.1);
  assert.equal(sanitizeCrecimiento("0"), 0);
  assert.equal(sanitizeCrecimiento(undefined), CRECIMIENTO_DEFAULT);
  assert.equal(sanitizeCrecimiento(""), CRECIMIENTO_DEFAULT);
  assert.equal(sanitizeCrecimiento("abc"), CRECIMIENTO_DEFAULT);
  assert.equal(sanitizeCrecimiento("-5"), CRECIMIENTO_DEFAULT);
  assert.equal(sanitizeCrecimiento("500"), 1, "se acota al máximo");
});
