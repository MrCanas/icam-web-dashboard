import assert from "node:assert/strict";
import { test } from "node:test";

import {
  contarPendientes,
  estadoDiscrepancia,
  fechasMaestroPorHito,
  puedePublicarAuto,
} from "../discrepancias";

// ---------------------------------------------------------------------------
// estadoDiscrepancia
// ---------------------------------------------------------------------------

test("sin fecha del maestro no bloquea: sin_dato_maestro", () => {
  // 9 de los 17 hitos de PM no existen en el maestro (toda la fase pre-obra).
  assert.equal(
    estadoDiscrepancia({ fechaOficial: "2026-06-01", fechaMaestro: undefined }),
    "sin_dato_maestro",
  );
  assert.equal(
    estadoDiscrepancia({ fechaOficial: "2026-06-01", fechaMaestro: null }),
    "sin_dato_maestro",
  );
});

test("fechas iguales coinciden", () => {
  assert.equal(
    estadoDiscrepancia({ fechaOficial: "2026-06-01", fechaMaestro: "2026-06-01" }),
    "coincide",
  );
});

test("fechas distintas sin resolución: pendiente", () => {
  assert.equal(
    estadoDiscrepancia({ fechaOficial: "2026-06-01", fechaMaestro: "2026-07-01" }),
    "pendiente",
  );
  // PM sin fecha y maestro con ella también es una discrepancia.
  assert.equal(
    estadoDiscrepancia({ fechaOficial: null, fechaMaestro: "2026-07-01" }),
    "pendiente",
  );
});

test("resolución vigente: resuelta", () => {
  // La PM eligió mantener su fecha (2026-06-01) frente al maestro (2026-07-01).
  assert.equal(
    estadoDiscrepancia({
      fechaOficial: "2026-06-01",
      fechaMaestro: "2026-07-01",
      resolucion: { fecha_elegida: "2026-06-01", fecha_maestro: "2026-07-01" },
    }),
    "resuelta",
  );
});

test("la resolución caduca si el maestro cambia después", () => {
  // Nueva carga del maestro con otra fecha: la foto ya no coincide.
  assert.equal(
    estadoDiscrepancia({
      fechaOficial: "2026-06-01",
      fechaMaestro: "2026-08-15",
      resolucion: { fecha_elegida: "2026-06-01", fecha_maestro: "2026-07-01" },
    }),
    "pendiente",
  );
});

test("la resolución caduca si se edita la celda a mano", () => {
  // La PM resolvió con 2026-06-01 y luego alguien editó la celda a 2026-09-01:
  // la fecha elegida ya no es la oficial.
  assert.equal(
    estadoDiscrepancia({
      fechaOficial: "2026-09-01",
      fechaMaestro: "2026-07-01",
      resolucion: { fecha_elegida: "2026-06-01", fecha_maestro: "2026-07-01" },
    }),
    "pendiente",
  );
});

test("elegir el maestro deja las fechas iguales: coincide, no hace falta resolución", () => {
  assert.equal(
    estadoDiscrepancia({
      fechaOficial: "2026-07-01",
      fechaMaestro: "2026-07-01",
      resolucion: { fecha_elegida: "2026-07-01", fecha_maestro: "2026-07-01" },
    }),
    "coincide",
  );
});

// ---------------------------------------------------------------------------
// puedePublicarAuto
// ---------------------------------------------------------------------------

test("puedePublicarAuto solo bloquea con pendientes", () => {
  assert.equal(puedePublicarAuto(["coincide", "sin_dato_maestro", "resuelta"]), true);
  assert.equal(puedePublicarAuto(["coincide", "pendiente"]), false);
  assert.equal(puedePublicarAuto([]), true);
});

// ---------------------------------------------------------------------------
// fechasMaestroPorHito
// ---------------------------------------------------------------------------

const LINEA = [
  { columna: "Fecha obra", fecha: "2026-03-01" },
  { columna: "Fecha LPO", fecha: null },
];

test("fechasMaestroPorHito cruza por columna con comparación laxa", () => {
  const r = fechasMaestroPorHito(
    [
      { id: "a", catalogoColumna: "fecha obra" }, // case-insensitive
      { id: "b", catalogoColumna: "Fecha LPO" },
      { id: "c", catalogoColumna: "Fecha Anteproyecto" }, // no está en el maestro
      { id: "d", catalogoColumna: null }, // sin mapear
    ],
    LINEA,
  );
  assert.equal(r.get("a"), "2026-03-01");
  assert.equal(r.get("b"), null); // columna presente pero celda vacía
  assert.equal(r.has("c"), false);
  assert.equal(r.has("d"), false);
});

test("dos activos sobre la misma línea del maestro (caso PC25)", () => {
  // PC25-CP6 y PC25-26-RESIDENCIAL comparten proyecto financiero: la misma
  // línea sirve para comparar los hitos de ambos.
  const activoA = fechasMaestroPorHito([{ id: "h1", catalogoColumna: "Fecha obra" }], LINEA);
  const activoB = fechasMaestroPorHito([{ id: "h9", catalogoColumna: "Fecha obra" }], LINEA);
  assert.equal(activoA.get("h1"), "2026-03-01");
  assert.equal(activoB.get("h9"), "2026-03-01");
});

// ---------------------------------------------------------------------------
// contarPendientes
// ---------------------------------------------------------------------------

test("contarPendientes cuenta solo las pendientes reales", () => {
  const hitos = [
    { id: "a", catalogoColumna: "Fecha obra", fechaOficial: "2026-03-01" }, // coincide
    { id: "b", catalogoColumna: "Fecha LPO", fechaOficial: "2026-05-01" }, // maestro sin fecha
    { id: "c", catalogoColumna: "Fecha entrega", fechaOficial: "2026-06-01" }, // sin columna en línea
    { id: "d", catalogoColumna: "Fecha obra", fechaOficial: "2026-04-01" }, // pendiente
  ];
  assert.equal(contarPendientes(hitos, LINEA, new Map()), 1);

  // Con la resolución vigente de «d», cero pendientes.
  const res = new Map([
    ["d", { fecha_elegida: "2026-04-01", fecha_maestro: "2026-03-01" }],
  ]);
  assert.equal(contarPendientes(hitos, LINEA, res), 0);
});
