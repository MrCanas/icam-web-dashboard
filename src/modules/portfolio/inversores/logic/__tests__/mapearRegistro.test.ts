import assert from "node:assert/strict";
import { test } from "node:test";

import {
  leerFecha,
  leerFechaHora,
  leerLookupId,
  leerLookupNombre,
  leerNumero,
  leerTexto,
  mapearRegistro,
  normalizarTipoFlujo,
  type CampoResuelto,
} from "../mapearRegistro";

// ---------------------------------------------------------------------------
// Lookups: la rareza número uno de la API v8
// ---------------------------------------------------------------------------

test("un lookup llega como objeto, no como escalar", () => {
  const valor = { id: "4587000001", name: "Cuenta Pérez" };
  assert.equal(leerLookupId(valor), "4587000001");
  assert.equal(leerLookupNombre(valor), "Cuenta Pérez");
  // Lo que pasaría con un String(v) ingenuo:
  assert.notEqual(leerLookupNombre(valor), "[object Object]");
});

test("un lookup vacío no inventa ids", () => {
  assert.equal(leerLookupId(null), null);
  assert.equal(leerLookupId({}), null);
  assert.equal(leerLookupId({ id: "   " }), null);
  assert.equal(leerLookupNombre(undefined), null);
});

test("si el campo ya viene como texto plano, se acepta", () => {
  assert.equal(leerLookupId("4587000001"), "4587000001");
  assert.equal(leerLookupNombre("Cuenta Pérez"), "Cuenta Pérez");
});

// ---------------------------------------------------------------------------
// Números: la diferencia entre «no lo sabemos» y «es cero»
// ---------------------------------------------------------------------------

test("un importe ausente es null y no cero", () => {
  assert.equal(leerNumero(null), null);
  assert.equal(leerNumero(undefined), null);
  assert.equal(leerNumero(""), null);
  assert.equal(leerNumero("   "), null);
  // Y un cero de verdad sigue siendo cero.
  assert.equal(leerNumero(0), 0);
  assert.equal(leerNumero("0"), 0);
});

test("admite el formato español por si el campo es una fórmula del CRM", () => {
  assert.equal(leerNumero("1.234,56"), 1234.56);
  assert.equal(leerNumero("1234.56"), 1234.56);
  assert.equal(leerNumero("1,234.56"), 1234.56);
  assert.equal(leerNumero("250000"), 250000);
  assert.equal(leerNumero("1.500.000,00 €"), 1500000);
});

test("lo que no es un número no se cuela como NaN", () => {
  assert.equal(leerNumero("pendiente"), null);
  assert.equal(leerNumero(Number.NaN), null);
});

// ---------------------------------------------------------------------------
// Fechas
// ---------------------------------------------------------------------------

test("date y datetime se distinguen", () => {
  assert.equal(leerFecha("2026-02-14"), "2026-02-14");
  assert.equal(leerFecha("2026-02-14T09:30:00+01:00"), "2026-02-14");
  assert.equal(leerFecha("14/02/2026"), null);
  assert.equal(leerFechaHora("2026-02-14T09:30:00Z"), "2026-02-14T09:30:00.000Z");
  assert.equal(leerFechaHora("no es una fecha"), null);
});

// ---------------------------------------------------------------------------
// Texto
// ---------------------------------------------------------------------------

test("un multiselect llega como array y se junta", () => {
  assert.equal(leerTexto(["Titular", "Apoderado"]), "Titular, Apoderado");
  assert.equal(leerTexto([]), null);
});

// ---------------------------------------------------------------------------
// Normalización del tipo de flujo
// ---------------------------------------------------------------------------

test("el diccionario confirmado manda sobre la heurística", () => {
  const notas = { normaliza: { "Entrada de capital": "aporte", Salida: "reparto" } };
  assert.equal(normalizarTipoFlujo("Entrada de capital", notas), "aporte");
  assert.equal(normalizarTipoFlujo("Salida", notas), "reparto");
});

test("el diccionario ignora mayúsculas y acentos", () => {
  const notas = { normaliza: { Aportación: "aporte" } };
  assert.equal(normalizarTipoFlujo("APORTACION", notas), "aporte");
  assert.equal(normalizarTipoFlujo("aportacion", notas), "aporte");
});

test("sin diccionario, la heurística reconoce las raíces habituales", () => {
  assert.equal(normalizarTipoFlujo("Aportación de capital", null), "aporte");
  assert.equal(normalizarTipoFlujo("Desembolso", null), "aporte");
  assert.equal(normalizarTipoFlujo("Reparto de dividendos", null), "reparto");
  assert.equal(normalizarTipoFlujo("Distribución", null), "reparto");
});

test("el diccionario puede FIJAR «desconocido» contra la heurística", () => {
  // «Llamada de capital» es la petición de fondos, no el ingreso. Sin esto, una
  // heurística que viera «capital» podría contarla como aporte e inflar lo
  // aportado con dinero que aún no ha entrado.
  const notas = {
    normaliza: {
      "Aporte de capital": "aporte",
      "Llamada de capital": "desconocido",
      "Reparto de beneficios": "reparto",
      "Impuesto de sociedades": "desconocido",
    },
  };
  assert.equal(normalizarTipoFlujo("Aporte de capital", notas), "aporte");
  assert.equal(normalizarTipoFlujo("Llamada de capital", notas), "desconocido");
  assert.equal(normalizarTipoFlujo("Reparto de beneficios", notas), "reparto");
  assert.equal(normalizarTipoFlujo("Impuesto de sociedades", notas), "desconocido");
});

test("un valor nuevo del CRM cae en «desconocido» y no revienta", () => {
  // Es la válvula de escape: la fila se sincroniza y se ve, pero no suma en
  // los KPIs. Perderla en silencio descuadraría los totales sin avisar.
  assert.equal(normalizarTipoFlujo("Permuta", null), "desconocido");
  assert.equal(normalizarTipoFlujo(null, null), "desconocido");
  assert.equal(normalizarTipoFlujo("", null), "desconocido");
});

// ---------------------------------------------------------------------------
// El mapeo completo
// ---------------------------------------------------------------------------

const CAMPOS: CampoResuelto[] = [
  { destino: "nombre", zohoApiName: "Name", tipo: "text", notas: null },
  { destino: "capital_comprometido", zohoApiName: "Capital", tipo: "number", notas: null },
  { destino: "fecha_alta", zohoApiName: "Alta", tipo: "date", notas: null },
  { destino: "cuenta_zoho_id", zohoApiName: "Cuenta", tipo: "lookup_id", notas: null },
  { destino: "cuenta_nombre", zohoApiName: "Cuenta", tipo: "lookup_nombre", notas: null },
];

test("mapearRegistro guarda el registro entero en raw", () => {
  const registro = {
    id: "4587000000123",
    Name: "Cuenta Pérez",
    Capital: 250000,
    Alta: "2024-03-01",
    Cuenta: { id: "999", name: "Matriz" },
    Modified_Time: "2026-02-14T09:30:00Z",
    Un_Campo_Que_No_Mapeamos: "valor",
  };

  const fila = mapearRegistro(registro, CAMPOS);

  assert.equal(fila.zoho_id, "4587000000123");
  assert.equal(fila.nombre, "Cuenta Pérez");
  assert.equal(fila.capital_comprometido, 250000);
  assert.equal(fila.fecha_alta, "2024-03-01");
  assert.equal(fila.cuenta_zoho_id, "999");
  assert.equal(fila.cuenta_nombre, "Matriz");
  assert.equal(fila.zoho_modified_at, "2026-02-14T09:30:00.000Z");
  // El seguro contra un mapeo incompleto: lo no mapeado sigue ahí.
  assert.deepEqual(fila.raw, registro);
});

test("un campo que Zoho no devolvió se queda a null, no a undefined", () => {
  const fila = mapearRegistro({ id: "1", Name: "Sola" }, CAMPOS);
  assert.equal(fila.capital_comprometido, null);
  assert.equal(fila.cuenta_zoho_id, null);
  assert.ok("capital_comprometido" in fila);
});
