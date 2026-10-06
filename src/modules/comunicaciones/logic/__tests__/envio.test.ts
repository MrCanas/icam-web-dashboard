import assert from "node:assert/strict";
import { test } from "node:test";

import type { ComDestinatarioRow, Direccion } from "@/modules/comunicaciones/types";
import { MODULO_CONTACTOS, MODULO_CUENTAS, type PermitidosCandado } from "../candado";
import {
  calcularProgreso,
  direccionesYaEnviadas,
  montarCorreo,
  montarCorreoDePrueba,
  simularCandado,
  type MontarCorreoEntrada,
} from "../envio";

// A qué direcciones sale cada correo. En modo pruebas, ninguna de la lista.

const dir = (email: string, contactoZohoId: string | null = `c-${email}`): Direccion => ({
  email,
  nombre: email,
  contactoZohoId,
  rol: "Contacto principal",
});

function entrada(p: Partial<MontarCorreoEntrada> = {}): MontarCorreoEntrada {
  return {
    comunicacion: { plantilla_id: "plantilla-1", plantilla_modulo: MODULO_CUENTAS },
    destinatario: { cuenta_zoho_id: "cuenta-1", para: [dir("ana@inversor.com")], copia: [dir("abogado@bufete.com")] },
    modo: "real",
    usuarioEmail: "javiercanas@imparcapital.com",
    remitente: "javiercanas@imparcapital.com",
    yaEnviadas: new Set(),
    ...p,
  };
}

test("modo real: Para y copia de la lista, remitente en copia oculta, sobre la cuenta", () => {
  const m = montarCorreo(entrada());
  assert.equal(m.tipo, "correo");
  if (m.tipo !== "correo") return;
  assert.deepEqual(m.correo.para, ["ana@inversor.com"]);
  assert.deepEqual(m.correo.copia, ["abogado@bufete.com"]);
  assert.deepEqual(m.correo.copiaOculta, ["javiercanas@imparcapital.com"]);
  assert.deepEqual(m.correo.registro, { modulo: MODULO_CUENTAS, id: "cuenta-1" });
  assert.equal(m.correo.plantillaId, "plantilla-1");
});

test("modo pruebas: todo se redirige a quien envía y no queda ninguna dirección de la lista", () => {
  const m = montarCorreo(entrada({ modo: "pruebas" }));
  assert.equal(m.tipo, "correo");
  if (m.tipo !== "correo") return;
  assert.deepEqual(m.correo.para, ["javiercanas@imparcapital.com"]);
  assert.deepEqual(m.correo.copia, []);
  assert.deepEqual(m.correo.copiaOculta, []);
  // Las direcciones de verdad se recuerdan para no repetir, pero no reciben nada.
  assert.deepEqual(m.direccionesReales, ["ana@inversor.com", "abogado@bufete.com"]);
});

test("una plantilla de Contactos se envía sobre el primer contacto en Para", () => {
  const m = montarCorreo(
    entrada({ comunicacion: { plantilla_id: "p", plantilla_modulo: MODULO_CONTACTOS } }),
  );
  assert.equal(m.tipo === "correo" && m.correo.registro.id, "c-ana@inversor.com");

  const sinContacto = montarCorreo(
    entrada({
      comunicacion: { plantilla_id: "p", plantilla_modulo: MODULO_CONTACTOS },
      destinatario: { cuenta_zoho_id: "cuenta-1", para: [dir("ana@inversor.com", null)], copia: [] },
    }),
  );
  assert.equal(sinContacto.tipo, "error");
});

test("una dirección recibe un solo correo por comunicación: la segunda cuenta se omite", () => {
  const m = montarCorreo(entrada({ yaEnviadas: new Set(["ana@inversor.com"]) }));
  assert.equal(m.tipo, "omitido");
});

test("si solo parte de las direcciones ya lo recibió, el correo sale sin ellas", () => {
  const m = montarCorreo(
    entrada({
      destinatario: {
        cuenta_zoho_id: "cuenta-1",
        para: [dir("ana@inversor.com"), dir("luis@inversor.com")],
        copia: [dir("abogado@bufete.com")],
      },
      yaEnviadas: new Set(["ana@inversor.com", "abogado@bufete.com"]),
    }),
  );
  assert.equal(m.tipo, "correo");
  if (m.tipo !== "correo") return;
  assert.deepEqual(m.correo.para, ["luis@inversor.com"]);
  assert.deepEqual(m.correo.copia, []);
});

test("modo pruebas omite exactamente lo que omitiría el envío real", () => {
  const m = montarCorreo(entrada({ modo: "pruebas", yaEnviadas: new Set(["ana@inversor.com"]) }));
  assert.equal(m.tipo, "omitido");
});

test("el remitente no se repite en copia oculta si ya está en Para", () => {
  const m = montarCorreo(
    entrada({ destinatario: { cuenta_zoho_id: "c", para: [dir("javiercanas@imparcapital.com")], copia: [] } }),
  );
  assert.equal(m.tipo === "correo" && m.correo.copiaOculta.length, 0);
});

test("sin plantilla o sin remitente no hay correo", () => {
  assert.equal(montarCorreo(entrada({ comunicacion: { plantilla_id: null, plantilla_modulo: null } })).tipo, "error");
  assert.equal(montarCorreo(entrada({ remitente: " " })).tipo, "error");
});

test("la prueba va solo a quien prueba, sobre la cuenta de pruebas designada", () => {
  const m = montarCorreoDePrueba({
    comunicacion: { plantilla_id: "plantilla-1", plantilla_modulo: MODULO_CUENTAS },
    cuentaPruebasZohoId: "cuenta-pruebas",
    contactoPruebasZohoId: "contacto-pruebas",
    usuarioEmail: "JavierCanas@imparcapital.com",
    remitente: "javiercanas@imparcapital.com",
  });
  assert.equal(m.ok, true);
  if (!m.ok) return;
  assert.deepEqual(m.correo.para, ["javiercanas@imparcapital.com"]);
  assert.deepEqual([m.correo.copia, m.correo.copiaOculta], [[], []]);
  assert.deepEqual(m.correo.registro, { modulo: MODULO_CUENTAS, id: "cuenta-pruebas" });
});

test("sin cuenta de pruebas designada no hay prueba", () => {
  const m = montarCorreoDePrueba({
    comunicacion: { plantilla_id: "plantilla-1", plantilla_modulo: MODULO_CUENTAS },
    cuentaPruebasZohoId: null,
    contactoPruebasZohoId: null,
    usuarioEmail: "javiercanas@imparcapital.com",
    remitente: "javiercanas@imparcapital.com",
  });
  assert.equal(m.ok, false);
});

// ---------------------------------------------------------------------------
// La simulación: lo mismo que haría el envío, sin enviar
// ---------------------------------------------------------------------------

const PERMITIDOS: PermitidosCandado = {
  emails: new Set(["javiercanas@imparcapital.com", "iranzuvicente@imparcapital.com"]),
  cuentasZohoId: new Set(["master", "jcv"]),
  contactosZohoId: new Set(["c-javier", "c-iranzu"]),
  cuentas: [],
  promocionEncontrada: true,
};

type FilaSimulada = Parameters<typeof simularCandado>[1][number];
const pendiente = (cuenta: string, para: string[], p: Partial<FilaSimulada> = {}): FilaSimulada => ({
  cuenta_zoho_id: cuenta,
  cuenta_nombre: cuenta,
  para: para.map((e) => dir(e)),
  copia: [],
  excluido: false,
  estado_envio: "pendiente",
  ...p,
});
const PLANTILLA = { plantilla_id: "plantilla-1", plantilla_modulo: MODULO_CUENTAS };
const OPCIONES = { usuarioEmail: "javiercanas@imparcapital.com", remitente: "javiercanas@imparcapital.com" };

/** Todas las direcciones a las que saldría algo, en cualquier campo. */
function direccionesQueSaldrian(simulacion: ReturnType<typeof simularCandado>): string[] {
  return [
    ...new Set(
      simulacion.permitidos.flatMap(({ correo }) => [...correo.para, ...correo.copia, ...correo.copiaOculta]),
    ),
  ].sort();
}

test("una audiencia de inversores reales: no sale NINGÚN correo, ni en modo real ni en modo pruebas", () => {
  const inversores = Array.from({ length: 125 }, (_, i) => pendiente(`real-${i}`, [`inversor${i}@real.com`]));
  for (const modo of ["real", "pruebas"] as const) {
    const s = simularCandado(PLANTILLA, inversores, { ...OPCIONES, modo }, PERMITIDOS);
    assert.equal(s.permitidos.length, 0, modo);
    assert.equal(s.rechazados.length, 125, modo);
    assert.deepEqual(direccionesQueSaldrian(s), [], modo);
  }
});

test("una audiencia mezclada: los inversores se rechazan y solo sale lo de las cuentas de prueba", () => {
  const lista = [
    pendiente("real-1", ["inversor1@real.com"]),
    pendiente("jcv", ["javiercanas@imparcapital.com"]),
    // Un inversor real con una dirección de la lista cerrada entre las suyas.
    pendiente("real-2", ["javiercanas@imparcapital.com", "inversor2@real.com"]),
  ];
  const s = simularCandado(PLANTILLA, lista, { ...OPCIONES, modo: "real" }, PERMITIDOS);
  assert.deepEqual(s.permitidos.map((p) => p.cuenta), ["jcv"]);
  assert.equal(s.rechazados.length, 2);
  assert.deepEqual(direccionesQueSaldrian(s), ["javiercanas@imparcapital.com"]);
});

test("la promoción de pruebas en modo real: solo direcciones de la lista cerrada", () => {
  const lista = [
    pendiente("master", ["iranzuvicente@imparcapital.com", "javiercanas@imparcapital.com"]),
    pendiente("jcv", ["javiercanas@imparcapital.com"]),
    pendiente("inv2", [], { estado_envio: "sin_destinatario" }),
  ];
  const s = simularCandado(PLANTILLA, lista, { ...OPCIONES, modo: "real" }, PERMITIDOS);
  assert.deepEqual(s.permitidos.map((p) => p.cuenta), ["master"]);
  // La segunda cuenta se omite: su única dirección ya recibe el correo por la primera.
  assert.deepEqual(s.omitidos.map((o) => o.cuenta), ["jcv"]);
  assert.deepEqual(direccionesQueSaldrian(s), ["iranzuvicente@imparcapital.com", "javiercanas@imparcapital.com"]);
});

test("una cuenta de prueba con una copia a una dirección externa se rechaza entera", () => {
  const lista = [pendiente("master", ["javiercanas@imparcapital.com"], { copia: [dir("alguien@gmail.com")] })];
  const s = simularCandado(PLANTILLA, lista, { ...OPCIONES, modo: "real" }, PERMITIDOS);
  assert.equal(s.permitidos.length, 0);
  assert.equal(s.rechazados.length, 1);
});

test("la simulación no cuenta excluidos ni lo ya enviado", () => {
  const lista = [
    pendiente("jcv", ["javiercanas@imparcapital.com"], { excluido: true }),
    pendiente("master", ["iranzuvicente@imparcapital.com"], { estado_envio: "enviado" }),
  ];
  const s = simularCandado(PLANTILLA, lista, { ...OPCIONES, modo: "real" }, PERMITIDOS);
  assert.deepEqual([s.permitidos.length, s.rechazados.length, s.omitidos.length], [0, 0, 0]);
});

type Fila = Pick<ComDestinatarioRow, "estado_envio" | "excluido" | "para" | "copia">;
const fila = (estado_envio: Fila["estado_envio"], p: Partial<Fila> = {}): Fila => ({
  estado_envio,
  excluido: false,
  para: [dir("ana@inversor.com")],
  copia: [],
  ...p,
});

test("repetir no reenvía: solo cuentan como ya enviadas las direcciones de quien está «enviado»", () => {
  const enviadas = direccionesYaEnviadas([
    fila("enviado", { para: [dir("Ana@Inversor.com")], copia: [dir("abogado@bufete.com")] }),
    fila("error", { para: [dir("luis@inversor.com")] }),
    fila("pendiente", { para: [dir("eva@inversor.com")] }),
  ]);
  assert.deepEqual([...enviadas].sort(), ["abogado@bufete.com", "ana@inversor.com"]);
});

test("el progreso no cuenta excluidos ni cuentas sin destinatario", () => {
  const p = calcularProgreso([
    fila("enviado"),
    fila("error"),
    fila("omitido"),
    fila("enviando"),
    fila("pendiente"),
    fila("pendiente", { excluido: true }),
    fila("sin_destinatario", { para: [] }),
  ]);
  assert.deepEqual(p, { total: 5, enviados: 1, errores: 1, omitidos: 1, enCurso: 1, pendientes: 1 });
});
