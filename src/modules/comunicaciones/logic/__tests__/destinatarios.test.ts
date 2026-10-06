import assert from "node:assert/strict";
import { test } from "node:test";

import type {
  InvContactoRow,
  InvCuentaContactoRow,
  InvCuentaPromocionRow,
  InvCuentaRow,
  InvPromocionRow,
} from "@/modules/portfolio/inversores/types";
import {
  contarAudiencias,
  cuentasDeAudiencia,
  resolverDestinatarios,
  resumirDestinatarios,
  type EspejosDeContacto,
  type OpcionesDestinatarios,
} from "../destinatarios";

// Estos tests fijan a quién se escribe. Un fallo aquí no es una cifra rara en
// una gráfica: es un correo a quien no debía recibirlo, y eso no se deshace.

// ---------------------------------------------------------------------------
// Fábricas: solo se escribe lo que el test mira
// ---------------------------------------------------------------------------

const SYNC = { sync_id: null, sincronizado_at: "2026-10-06T06:00:00Z", borrado_at: null };

function cuenta(p: Partial<InvCuentaRow> & { zoho_id: string; nombre: string }): InvCuentaRow {
  return {
    codigo: null,
    estado: null,
    tipo: null,
    fecha_alta: null,
    email: null,
    telefono: null,
    capital_comprometido: null,
    moneda: "EUR",
    propietario_zoho_id: null,
    propietario_nombre: null,
    zoho_modified_at: null,
    excluida: false,
    excluida_motivo: null,
    tiene_intermediario: false,
    ...SYNC,
    ...p,
  };
}

function contacto(zoho_id: string, email: string | null, p: Partial<InvContactoRow> = {}): InvContactoRow {
  return {
    zoho_id,
    nombre: null,
    apellidos: null,
    nombre_completo: `Persona ${zoho_id}`,
    email,
    email_secundario: null,
    telefono: null,
    zoho_modified_at: null,
    email_opt_out: false,
    ...SYNC,
    ...p,
  };
}

let nEnlace = 0;
function enlace(
  cuenta_zoho_id: string,
  contacto_zoho_id: string,
  papeles: Partial<
    Pick<
      InvCuentaContactoRow,
      "es_principal" | "es_secundario" | "es_representante_legal" | "es_abogado" | "es_intermediario"
    >
  >,
): InvCuentaContactoRow {
  return {
    zoho_id: `enlace-${++nEnlace}`,
    cuenta_zoho_id,
    cuenta_nombre: null,
    contacto_zoho_id,
    contacto_nombre: null,
    // En el CRM real este campo viene vacío: el correo sale de inv_contactos.
    contacto_email: null,
    contacto_telefono: null,
    es_principal: false,
    es_secundario: false,
    es_representante_legal: false,
    es_abogado: false,
    es_intermediario: false,
    concepto_representante: null,
    rol: null,
    participacion: null,
    zoho_modified_at: null,
    ...SYNC,
    ...papeles,
  };
}

function suscripcion(cuenta_zoho_id: string, promocion_zoho_id: string): InvCuentaPromocionRow {
  return {
    zoho_id: `sus-${cuenta_zoho_id}-${promocion_zoho_id}-${++nEnlace}`,
    cuenta_zoho_id,
    cuenta_nombre: null,
    promocion_zoho_id,
    promocion_nombre: null,
    importe_comprometido: null,
    importe_aportado: null,
    participacion: null,
    fecha: null,
    status: null,
    coste_vehiculo_intermedio: null,
    zoho_modified_at: null,
    ...SYNC,
  };
}

function promocion(zoho_id: string, nombre: string): InvPromocionRow {
  return { zoho_id, codigo: zoho_id.toUpperCase(), nombre, situacion: null, tipologia: null, zoho_modified_at: null, ...SYNC };
}

function espejos(p: Partial<EspejosDeContacto>): EspejosDeContacto {
  return { cuentas: [], contactos: [], cuentaContacto: [], promociones: [], cuentaPromocion: [], ...p };
}

const SOLO_PRINCIPAL: OpcionesDestinatarios = {
  rolesPara: ["principal"],
  rolesCopia: [],
  dominiosInternos: ["imparcapital.com"],
};

// ---------------------------------------------------------------------------
// Audiencias
// ---------------------------------------------------------------------------

test("«Inversores directos» son las cuentas con «Tiene intermediario» en false", () => {
  const e = espejos({
    cuentas: [
      cuenta({ zoho_id: "a", nombre: "Directa", tiene_intermediario: false }),
      cuenta({ zoho_id: "b", nombre: "Con intermediario", tiene_intermediario: true }),
    ],
  });
  assert.deepEqual(
    cuentasDeAudiencia(e, { audiencia: "inversores_directos" }).map((c) => c.zoho_id),
    ["a"],
  );
});

test("una cuenta sin el dato de intermediario NO entra en «Inversores directos»", () => {
  // null = todavía sin sincronizar. Ante la duda no se le escribe, y el
  // recuento dice cuántas son para que no pase desapercibido.
  const e = espejos({
    cuentas: [
      cuenta({ zoho_id: "a", nombre: "Directa" }),
      cuenta({ zoho_id: "b", nombre: "Sin dato", tiene_intermediario: null }),
    ],
  });
  assert.deepEqual(
    cuentasDeAudiencia(e, { audiencia: "inversores_directos" }).map((c) => c.zoho_id),
    ["a"],
  );
  assert.equal(contarAudiencias(e).sinDatoIntermediario, 1);
});

test("la audiencia de una promoción son sus cuentas suscritas, sin repetir", () => {
  const e = espejos({
    cuentas: [cuenta({ zoho_id: "a", nombre: "A" }), cuenta({ zoho_id: "b", nombre: "B" })],
    promociones: [promocion("gq8", "Glorieta de Quevedo 8"), promocion("se84", "Santa Engracia 84")],
    // La cuenta «a» tiene dos suscripciones a la misma promoción.
    cuentaPromocion: [suscripcion("a", "gq8"), suscripcion("a", "gq8"), suscripcion("b", "se84")],
  });
  assert.deepEqual(
    cuentasDeAudiencia(e, { audiencia: "promocion", promocionZohoId: "gq8" }).map((c) => c.zoho_id),
    ["a"],
  );
  assert.deepEqual(
    contarAudiencias(e).promociones.map((p) => [p.zohoId, p.numCuentas]),
    [
      ["gq8", 1],
      ["se84", 1],
    ],
  );
});

test("la audiencia «promoción» sin promoción elegida no devuelve a nadie", () => {
  const e = espejos({ cuentas: [cuenta({ zoho_id: "a", nombre: "A" })] });
  assert.deepEqual(cuentasDeAudiencia(e, { audiencia: "promocion" }), []);
});

// ---------------------------------------------------------------------------
// Para y copia
// ---------------------------------------------------------------------------

test("va en «Para» quien tiene un papel elegido; el resto de papeles no recibe nada", () => {
  const cuentas = [cuenta({ zoho_id: "a", nombre: "A" })];
  const e = espejos({
    contactos: [contacto("p", "principal@ejemplo.com"), contacto("ab", "abogado@ejemplo.com")],
    cuentaContacto: [enlace("a", "p", { es_principal: true }), enlace("a", "ab", { es_abogado: true })],
  });
  const [d] = resolverDestinatarios(cuentas, e, SOLO_PRINCIPAL);
  assert.deepEqual(d!.para.map((x) => x.email), ["principal@ejemplo.com"]);
  assert.deepEqual(d!.copia, []);
});

test("nadie va a la vez en «Para» y en copia", () => {
  const cuentas = [cuenta({ zoho_id: "a", nombre: "A" })];
  const e = espejos({
    contactos: [contacto("p", "doble@ejemplo.com"), contacto("s", "secundario@ejemplo.com")],
    cuentaContacto: [
      // Principal y abogado a la vez: es «Para», no copia.
      enlace("a", "p", { es_principal: true, es_abogado: true }),
      enlace("a", "s", { es_abogado: true }),
    ],
  });
  const [d] = resolverDestinatarios(cuentas, e, {
    rolesPara: ["principal"],
    rolesCopia: ["abogado"],
    dominiosInternos: [],
  });
  assert.deepEqual(d!.para.map((x) => x.email), ["doble@ejemplo.com"]);
  assert.deepEqual(d!.copia.map((x) => x.email), ["secundario@ejemplo.com"]);
});

test("un contacto dado de baja no recibe nada y se avisa", () => {
  const cuentas = [cuenta({ zoho_id: "a", nombre: "A" })];
  const e = espejos({
    contactos: [contacto("p", "baja@ejemplo.com", { email_opt_out: true })],
    cuentaContacto: [enlace("a", "p", { es_principal: true })],
  });
  const [d] = resolverDestinatarios(cuentas, e, SOLO_PRINCIPAL);
  assert.deepEqual(d!.para, []);
  assert.ok(d!.avisos.includes("dado_de_baja"));
  assert.ok(d!.avisos.includes("sin_destinatario"));
});

test("un contacto sin correo no recibe nada y se avisa", () => {
  const cuentas = [cuenta({ zoho_id: "a", nombre: "A" })];
  const e = espejos({
    contactos: [contacto("p", null)],
    cuentaContacto: [enlace("a", "p", { es_principal: true })],
  });
  const [d] = resolverDestinatarios(cuentas, e, SOLO_PRINCIPAL);
  assert.deepEqual(d!.para, []);
  assert.ok(d!.avisos.includes("sin_correo"));
});

test("una cuenta sin contacto principal sigue en la lista, sin destinatario", () => {
  const cuentas = [cuenta({ zoho_id: "a", nombre: "A" })];
  const [d] = resolverDestinatarios(cuentas, espejos({}), SOLO_PRINCIPAL);
  assert.deepEqual(d!.para, []);
  assert.deepEqual(d!.avisos, ["sin_destinatario"]);
  // No recibe nada, pero tampoco se marca «excluida»: nadie la ha excluido.
  assert.equal(d!.excluido, false);
});

test("el mismo correo dos veces en una cuenta sale una sola vez", () => {
  const cuentas = [cuenta({ zoho_id: "a", nombre: "A" })];
  const e = espejos({
    contactos: [contacto("p1", "Mismo@Ejemplo.com"), contacto("p2", "mismo@ejemplo.com")],
    cuentaContacto: [enlace("a", "p1", { es_principal: true }), enlace("a", "p2", { es_principal: true })],
  });
  const [d] = resolverDestinatarios(cuentas, e, SOLO_PRINCIPAL);
  assert.deepEqual(d!.para.map((x) => x.email), ["mismo@ejemplo.com"]);
});

// ---------------------------------------------------------------------------
// Exclusiones de salida y avisos
// ---------------------------------------------------------------------------

test("una cuenta de prueba aparece en la lista, marcada y excluida", () => {
  const cuentas = [cuenta({ zoho_id: "t", nombre: "CUENTA MASTER", excluida: true, excluida_motivo: "Pruebas" })];
  const e = espejos({
    contactos: [contacto("p", "alguien@ejemplo.com")],
    cuentaContacto: [enlace("t", "p", { es_principal: true })],
  });
  const [d] = resolverDestinatarios(cuentas, e, SOLO_PRINCIPAL);
  assert.equal(d!.excluido, true);
  assert.equal(d!.excluidoMotivo, "Pruebas");
  assert.ok(d!.avisos.includes("cuenta_de_prueba"));
});

test("una cuenta con todas sus direcciones internas sale excluida; con alguna externa, solo avisada", () => {
  const cuentas = [cuenta({ zoho_id: "i", nombre: "Interna" }), cuenta({ zoho_id: "m", nombre: "Mixta" })];
  const e = espejos({
    contactos: [contacto("in", "socio@imparcapital.com"), contacto("ex", "fuera@ejemplo.com")],
    cuentaContacto: [
      enlace("i", "in", { es_principal: true }),
      enlace("m", "in", { es_principal: true }),
      enlace("m", "ex", { es_principal: true }),
    ],
  });
  const [interna, mixta] = resolverDestinatarios(cuentas, e, SOLO_PRINCIPAL);
  assert.equal(interna!.excluido, true);
  assert.equal(mixta!.excluido, false);
  assert.ok(mixta!.avisos.includes("direccion_interna"));
});

test("la misma persona en «Para» de dos cuentas se avisa en las dos", () => {
  const cuentas = [cuenta({ zoho_id: "a", nombre: "A" }), cuenta({ zoho_id: "b", nombre: "B" })];
  const e = espejos({
    contactos: [contacto("p", "repetida@ejemplo.com")],
    cuentaContacto: [enlace("a", "p", { es_principal: true }), enlace("b", "p", { es_principal: true })],
  });
  const lista = resolverDestinatarios(cuentas, e, SOLO_PRINCIPAL);
  assert.ok(lista.every((d) => d.avisos.includes("persona_repetida")));
});

test("coincidir con una cuenta excluida no cuenta como persona repetida", () => {
  const cuentas = [
    cuenta({ zoho_id: "a", nombre: "A" }),
    cuenta({ zoho_id: "t", nombre: "Prueba", excluida: true }),
  ];
  const e = espejos({
    contactos: [contacto("p", "una@ejemplo.com")],
    cuentaContacto: [enlace("a", "p", { es_principal: true }), enlace("t", "p", { es_principal: true })],
  });
  const lista = resolverDestinatarios(cuentas, e, SOLO_PRINCIPAL);
  assert.ok(lista.every((d) => !d.avisos.includes("persona_repetida")));
});

// ---------------------------------------------------------------------------
// Resumen
// ---------------------------------------------------------------------------

test("el resumen cuenta correos, no cuentas: excluidos y sin destinatario no salen", () => {
  const dir = (email: string) => ({ email, nombre: email, contactoZohoId: null, rol: "" });
  const resumen = resumirDestinatarios(
    [
      { para: [dir("a@ejemplo.com"), dir("b@imparcapital.com")], excluido: false },
      { para: [dir("a@ejemplo.com")], excluido: false },
      { para: [dir("c@ejemplo.com")], excluido: true },
      { para: [], excluido: false },
    ],
    ["imparcapital.com"],
  );
  assert.deepEqual(resumen, {
    total: 4,
    aEnviar: 2,
    excluidos: 1,
    sinDestinatario: 1,
    direcciones: 2,
    direccionesExternas: 1,
  });
});
