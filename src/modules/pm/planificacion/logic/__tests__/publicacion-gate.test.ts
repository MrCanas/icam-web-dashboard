import assert from "node:assert/strict";
import { test } from "node:test";

import {
  evaluarGatePublicacion,
  motivoGateTexto,
  PRIMER_TRIMESTRE_VALIDADO,
  sujetoAValidacion,
} from "../publicacion-gate";

test("el corte del flujo es Q2 2026", () => {
  // Decidido por la PMO: todo lo anterior es historia consolidada y no cambia.
  assert.equal(PRIMER_TRIMESTRE_VALIDADO, "2026_Q2");
  assert.equal(sujetoAValidacion("2026_Q2"), true);
  assert.equal(sujetoAValidacion("2026_Q3"), true);
  assert.equal(sujetoAValidacion("2027_Q1"), true);
  assert.equal(sujetoAValidacion("2026_Q1"), false);
  assert.equal(sujetoAValidacion("2025_Q4"), false);
  assert.equal(sujetoAValidacion("2018_Q3"), false);
  assert.equal(sujetoAValidacion("levantamiento"), false);
});

test("los trimestres anteriores al corte están exentos del gate", () => {
  for (const code of ["2026_Q1", "2025_Q4", "2018_Q3"]) {
    assert.deepEqual(
      evaluarGatePublicacion({
        snapshotCode: code,
        proyectoFinanciero: null,
        lineaMaestroExiste: false,
        discrepanciasPendientes: 3,
      }),
      { permitido: true },
      `«${code}» debería publicarse como siempre`,
    );
  }
});

test("el levantamiento está exento del gate", () => {
  // Es la foto inicial del proyecto, anterior al ciclo de reporte trimestral.
  assert.deepEqual(
    evaluarGatePublicacion({
      snapshotCode: "levantamiento",
      proyectoFinanciero: null,
      lineaMaestroExiste: false,
      discrepanciasPendientes: 5,
    }),
    { permitido: true },
  );
});

test("sin mapeo a proyecto financiero no se publica", () => {
  assert.deepEqual(
    evaluarGatePublicacion({
      snapshotCode: "2026_Q3",
      proyectoFinanciero: null,
      lineaMaestroExiste: true,
      discrepanciasPendientes: 0,
    }),
    { permitido: false, motivo: "sin_mapeo" },
  );
});

test("sin línea del maestro no se publica", () => {
  assert.deepEqual(
    evaluarGatePublicacion({
      snapshotCode: "2026_Q3",
      proyectoFinanciero: "PC25",
      lineaMaestroExiste: false,
      discrepanciasPendientes: 0,
    }),
    { permitido: false, motivo: "sin_linea_maestro" },
  );
});

test("con discrepancias pendientes no se publica", () => {
  assert.deepEqual(
    evaluarGatePublicacion({
      snapshotCode: "2026_Q3",
      proyectoFinanciero: "PC25",
      lineaMaestroExiste: true,
      discrepanciasPendientes: 2,
    }),
    { permitido: false, motivo: "discrepancias_pendientes" },
  );
});

test("con línea del maestro y sin pendientes se permite", () => {
  assert.deepEqual(
    evaluarGatePublicacion({
      snapshotCode: "2026_Q3",
      proyectoFinanciero: "PC25",
      lineaMaestroExiste: true,
      discrepanciasPendientes: 0,
    }),
    { permitido: true },
  );
});

test("motivoGateTexto nombra el proyecto y el trimestre", () => {
  const t = motivoGateTexto("sin_linea_maestro", {
    proyectoFinanciero: "PC25",
    etiquetaTrimestre: "Q3 2026",
  });
  assert.match(t, /PC25/);
  assert.match(t, /Q3 2026/);
});
