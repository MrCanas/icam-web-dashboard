import assert from "node:assert/strict";
import { test } from "node:test";

import { evaluarGatePublicacion, motivoGateTexto } from "../publicacion-gate";

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
