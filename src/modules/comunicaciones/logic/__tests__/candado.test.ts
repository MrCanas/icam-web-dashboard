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
  calcularPermitidos,
  CANDADO,
  MODULO_CONTACTOS,
  MODULO_CUENTAS,
  verificarCandado,
  type CorreoParaCandado,
  type EspejosParaCandado,
} from "../candado";

// El candado es lo único que separa este módulo de un inversor real aunque
// todos los demás controles fallen. Estos tests fijan a quién deja pasar.

// Solo se escribe lo que el candado mira; el resto de columnas no pintan nada aquí.
const cuenta = (zoho_id: string, nombre: string, p: Partial<InvCuentaRow> = {}) =>
  ({ zoho_id, nombre, excluida: false, borrado_at: null, ...p }) as InvCuentaRow;
const contacto = (zoho_id: string, email: string | null, p: Partial<InvContactoRow> = {}) =>
  ({ zoho_id, email, nombre_completo: zoho_id, borrado_at: null, ...p }) as InvContactoRow;
const enlace = (cuenta_zoho_id: string, contacto_zoho_id: string, es_principal: boolean) =>
  ({ cuenta_zoho_id, contacto_zoho_id, es_principal, borrado_at: null }) as InvCuentaContactoRow;
const promocion = (zoho_id: string, codigo: string) =>
  ({ zoho_id, codigo, nombre: codigo, borrado_at: null }) as InvPromocionRow;
const suscripcion = (cuenta_zoho_id: string, promocion_zoho_id: string) =>
  ({ cuenta_zoho_id, promocion_zoho_id, borrado_at: null }) as InvCuentaPromocionRow;

const TEST = CANDADO.promocionZohoId;

/** El espejo tal como está el CRM: tres cuentas de prueba y un inversor de verdad. */
function espejos(cambios: Partial<EspejosParaCandado> = {}): EspejosParaCandado {
  return {
    promociones: [promocion(TEST, CANDADO.promocionCodigo), promocion("p-real", "ZUR5")],
    cuentas: [
      cuenta("master", "CUENTA MASTER", { excluida: true }),
      cuenta("jcv", "TEST CUENTA JCV", { excluida: true }),
      cuenta("inv2", "TEST_CUENTAINV2", { excluida: true }),
      cuenta("real", "Inversor Real, S.L."),
      // Un inversor de verdad suscrito por error a la promoción de pruebas.
      cuenta("colado", "Inversor Colado"),
    ],
    cuentaPromocion: [
      suscripcion("master", TEST),
      suscripcion("jcv", TEST),
      suscripcion("inv2", TEST),
      suscripcion("real", "p-real"),
      suscripcion("colado", TEST),
    ],
    contactos: [
      contacto("c-javier", "JavierCanas@imparcapital.com"),
      contacto("c-iranzu", "iranzu@imparcapital.com"),
      contacto("c-externo", "alguien@gmail.com"),
      contacto("c-real", "inversor@real.com"),
      contacto("c-colado", "colado@real.com"),
    ],
    cuentaContacto: [
      enlace("master", "c-javier", true),
      enlace("master", "c-iranzu", true),
      // No principal de una cuenta de prueba, con una dirección externa de verdad.
      enlace("master", "c-externo", false),
      enlace("jcv", "c-javier", true),
      enlace("inv2", "c-externo", false),
      enlace("real", "c-real", true),
      enlace("colado", "c-colado", true),
    ],
    ...cambios,
  };
}

function correo(p: Partial<CorreoParaCandado> = {}): CorreoParaCandado {
  return {
    registro: { modulo: MODULO_CUENTAS, id: "jcv" },
    remitente: "javiercanas@imparcapital.com",
    para: ["javiercanas@imparcapital.com"],
    copia: [],
    copiaOculta: [],
    ...p,
  };
}

test("permite la dirección fija y los contactos principales de las cuentas de prueba", () => {
  const permitidos = calcularPermitidos(espejos());
  assert.deepEqual([...permitidos.emails].sort(), ["iranzu@imparcapital.com", "javiercanas@imparcapital.com"]);
  assert.deepEqual([...permitidos.cuentasZohoId].sort(), ["inv2", "jcv", "master"]);
  assert.deepEqual([...permitidos.contactosZohoId].sort(), ["c-iranzu", "c-javier"]);
  assert.equal(permitidos.promocionEncontrada, true);
});

test("un contacto NO principal de una cuenta de prueba no está permitido", () => {
  const permitidos = calcularPermitidos(espejos());
  assert.equal(permitidos.emails.has("alguien@gmail.com"), false);
  const veredicto = verificarCandado(correo({ copia: ["alguien@gmail.com"] }), permitidos);
  assert.equal(veredicto.ok, false);
});

test("un inversor real suscrito a la promoción de pruebas no entra: no está marcado como prueba", () => {
  const permitidos = calcularPermitidos(espejos());
  assert.equal(permitidos.cuentasZohoId.has("colado"), false);
  assert.equal(permitidos.emails.has("colado@real.com"), false);
});

test("si la promoción de pruebas no está, solo queda la dirección fija", () => {
  const sinPromocion = calcularPermitidos(espejos({ promociones: [promocion("p-real", "ZUR5")] }));
  assert.deepEqual([...sinPromocion.emails], ["javiercanas@imparcapital.com"]);
  assert.equal(sinPromocion.cuentasZohoId.size, 0);
  assert.equal(sinPromocion.promocionEncontrada, false);
});

test("el código reutilizado en otra promoción, o el id con otro código, no abren el candado", () => {
  const otroId = calcularPermitidos(espejos({ promociones: [promocion("otro-id", CANDADO.promocionCodigo)] }));
  assert.equal(otroId.promocionEncontrada, false);
  const otroCodigo = calcularPermitidos(espejos({ promociones: [promocion(TEST, "ZUR5")] }));
  assert.equal(otroCodigo.promocionEncontrada, false);
  assert.equal(otroCodigo.cuentasZohoId.size, 0);
});

test("una promoción, cuenta o enlace borrados en Zoho no cuentan", () => {
  const promoBorrada = calcularPermitidos(
    espejos({
      promociones: [{ ...promocion(TEST, CANDADO.promocionCodigo), borrado_at: "2026-10-01T00:00:00Z" }],
    }),
  );
  assert.equal(promoBorrada.promocionEncontrada, false);

  const base = espejos();
  const enlaceBorrado = calcularPermitidos({
    ...base,
    cuentaContacto: base.cuentaContacto.map((e) =>
      e.contacto_zoho_id === "c-iranzu" ? { ...e, borrado_at: "2026-10-01T00:00:00Z" } : e,
    ),
  });
  assert.equal(enlaceBorrado.emails.has("iranzu@imparcapital.com"), false);
});

test("deja pasar un correo a una dirección permitida sobre una cuenta de prueba", () => {
  const permitidos = calcularPermitidos(espejos());
  assert.deepEqual(verificarCandado(correo(), permitidos), { ok: true });
  // Mayúsculas y espacios no cambian quién es.
  assert.deepEqual(verificarCandado(correo({ para: [" JavierCanas@ImparCapital.com "] }), permitidos), { ok: true });
});

test("rechaza cualquier dirección de fuera, esté en Para, en copia o en copia oculta", () => {
  const permitidos = calcularPermitidos(espejos());
  for (const campo of ["para", "copia", "copiaOculta"] as const) {
    const veredicto = verificarCandado(correo({ [campo]: ["inversor@real.com"] }), permitidos);
    assert.equal(veredicto.ok, false, campo);
    assert.match(veredicto.ok ? "" : veredicto.motivo, /inversor@real\.com/);
  }
});

test("rechaza el correo ENTERO si una sola dirección sobra: no filtra y envía el resto", () => {
  const permitidos = calcularPermitidos(espejos());
  const veredicto = verificarCandado(
    correo({ para: ["javiercanas@imparcapital.com", "inversor@real.com"] }),
    permitidos,
  );
  assert.equal(veredicto.ok, false);
});

test("rechaza un correo a una dirección permitida si se envía sobre la ficha de un inversor real", () => {
  const permitidos = calcularPermitidos(espejos());
  // Modo pruebas sobre una audiencia real: la dirección es buena, el registro no.
  const sobreCuentaReal = verificarCandado(correo({ registro: { modulo: MODULO_CUENTAS, id: "real" } }), permitidos);
  assert.equal(sobreCuentaReal.ok, false);
  const sobreContactoReal = verificarCandado(
    correo({ registro: { modulo: MODULO_CONTACTOS, id: "c-real" } }),
    permitidos,
  );
  assert.equal(sobreContactoReal.ok, false);
  const sobreNoPrincipal = verificarCandado(
    correo({ registro: { modulo: MODULO_CONTACTOS, id: "c-externo" } }),
    permitidos,
  );
  assert.equal(sobreNoPrincipal.ok, false);
});

test("deja pasar un envío sobre un contacto principal de una cuenta de prueba", () => {
  const permitidos = calcularPermitidos(espejos());
  assert.deepEqual(
    verificarCandado(correo({ registro: { modulo: MODULO_CONTACTOS, id: "c-javier" } }), permitidos),
    { ok: true },
  );
});

test("rechaza un módulo que no sabe comprobar y un correo sin nadie en Para", () => {
  const permitidos = calcularPermitidos(espejos());
  assert.equal(verificarCandado(correo({ registro: { modulo: "Leads", id: "jcv" } }), permitidos).ok, false);
  assert.equal(verificarCandado(correo({ para: [] }), permitidos).ok, false);
});
