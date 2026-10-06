import assert from "node:assert/strict";
import { test } from "node:test";

import type { PermitidosCandado } from "@/modules/comunicaciones/logic/candado";
import type { CorreoSaliente } from "@/modules/comunicaciones/logic/envio";
import { enviarConCandado, nombreDePasarelaActiva, VARIABLE_DE_PASARELA } from "../index";
import { PREFIJO_SIMULADO } from "../pasarelaSimulada";
import {
  crearPasarelaZoho,
  cuerpoDeEnvio,
  elegirRemitente,
  hayTokenDeEnvios,
  SinTokenDeEnviosError,
  VARIABLE_TOKEN_ENVIOS,
} from "../pasarelaZoho";
import type { PasarelaCorreo } from "../tipos";

// La puerta de salida. Ninguna de estas pruebas toca la red.

const PERMITIDOS: PermitidosCandado = {
  emails: new Set(["javiercanas@imparcapital.com"]),
  cuentasZohoId: new Set(["jcv"]),
  contactosZohoId: new Set(["c-javier"]),
  cuentas: [{ zohoId: "jcv", nombre: "TEST CUENTA JCV" }],
  promocionEncontrada: true,
};

function correo(p: Partial<CorreoSaliente> = {}): CorreoSaliente {
  return {
    registro: { modulo: "Cuentas_de_Inversi_n", id: "jcv" },
    remitente: "javiercanas@imparcapital.com",
    para: ["javiercanas@imparcapital.com"],
    copia: [],
    copiaOculta: [],
    plantillaId: "plantilla-1",
    ...p,
  };
}

/** Una pasarela que apunta lo que le llega, para saber si le llegó algo. */
function espia(): PasarelaCorreo & { recibidos: CorreoSaliente[] } {
  const recibidos: CorreoSaliente[] = [];
  return {
    nombre: "zoho",
    recibidos,
    async enviar(c) {
      recibidos.push(c);
      return { ok: true, messageId: "m-1" };
    },
  };
}

/** Ejecuta con el token de envíos puesto o quitado, y lo deja como estaba. */
async function conToken<T>(valor: string | undefined, fn: () => T | Promise<T>): Promise<T> {
  const antes = process.env[VARIABLE_TOKEN_ENVIOS];
  if (valor === undefined) delete process.env[VARIABLE_TOKEN_ENVIOS];
  else process.env[VARIABLE_TOKEN_ENVIOS] = valor;
  try {
    return await fn();
  } finally {
    if (antes === undefined) delete process.env[VARIABLE_TOKEN_ENVIOS];
    else process.env[VARIABLE_TOKEN_ENVIOS] = antes;
  }
}

test("un correo permitido llega a la pasarela", async () => {
  const pasarela = espia();
  const r = await enviarConCandado(correo(), PERMITIDOS, pasarela);
  assert.deepEqual(r, { ok: true, messageId: "m-1", pasarela: "zoho" });
  assert.equal(pasarela.recibidos.length, 1);
});

test("un correo que el candado rechaza NO llega a ninguna pasarela", async () => {
  const casos: Partial<CorreoSaliente>[] = [
    { para: ["inversor@real.com"] },
    { copia: ["inversor@real.com"] },
    { copiaOculta: ["inversor@real.com"] },
    { para: ["javiercanas@imparcapital.com", "inversor@real.com"] },
    { registro: { modulo: "Cuentas_de_Inversi_n", id: "cuenta-real" } },
    { registro: { modulo: "Contacts", id: "contacto-real" } },
    { para: [] },
  ];
  for (const caso of casos) {
    const pasarela = espia();
    const r = await enviarConCandado(correo(caso), PERMITIDOS, pasarela);
    assert.equal(r.ok, false, JSON.stringify(caso));
    assert.equal(!r.ok && r.bloqueadoPorCandado, true, JSON.stringify(caso));
    assert.equal(pasarela.recibidos.length, 0, JSON.stringify(caso));
  }
});

test("el candado también va delante de la pasarela simulada", async () => {
  await conToken(undefined, async () => {
    const r = await enviarConCandado(correo({ para: ["inversor@real.com"] }), PERMITIDOS);
    assert.equal(r.ok, false);
    assert.equal(!r.ok && r.bloqueadoPorCandado, true);
  });
});

test("sin token de envíos la pasarela activa es la simulada, y lo que «sale» queda marcado", async () => {
  await conToken(undefined, async () => {
    assert.equal(hayTokenDeEnvios(), false);
    assert.equal(nombreDePasarelaActiva(), "simulada");
    const r = await enviarConCandado(correo(), PERMITIDOS);
    assert.equal(r.ok, true);
    assert.equal(r.pasarela, "simulada");
    assert.ok(r.ok && r.messageId.startsWith(PREFIJO_SIMULADO));
  });
});

test("COMUNICACIONES_PASARELA=simulada fuerza la simulada aunque haya token, y nada fuerza la real", async () => {
  const antes = process.env[VARIABLE_DE_PASARELA];
  try {
    await conToken("un-token-de-envios", async () => {
      delete process.env[VARIABLE_DE_PASARELA];
      assert.equal(nombreDePasarelaActiva(), "zoho");
      for (const valor of ["simulada", " Simulada ", "SIMULADA"]) {
        process.env[VARIABLE_DE_PASARELA] = valor;
        assert.equal(nombreDePasarelaActiva(), "simulada", valor);
        const r = await enviarConCandado(correo(), PERMITIDOS);
        assert.equal(r.ok && r.pasarela, "simulada", valor);
      }
      // Cualquier otro valor no cambia nada: manda el token.
      process.env[VARIABLE_DE_PASARELA] = "zoho";
      assert.equal(nombreDePasarelaActiva(), "zoho");
    });
    // Sin token, ningún valor de la variable enciende la pasarela real.
    await conToken(undefined, () => {
      for (const valor of ["zoho", "real", "simulada", ""]) {
        process.env[VARIABLE_DE_PASARELA] = valor;
        assert.equal(nombreDePasarelaActiva(), "simulada", valor);
      }
    });
  } finally {
    if (antes === undefined) delete process.env[VARIABLE_DE_PASARELA];
    else process.env[VARIABLE_DE_PASARELA] = antes;
  }
});

test("la pasarela real se niega a arrancar sin el token de envíos", async () => {
  await conToken(undefined, () => {
    assert.throws(() => crearPasarelaZoho(), SinTokenDeEnviosError);
  });
  await conToken("   ", () => {
    assert.equal(hayTokenDeEnvios(), false);
    assert.throws(() => crearPasarelaZoho(), SinTokenDeEnviosError);
  });
});

test("el token de lectura del portal no sirve para enviar", async () => {
  const lectura = process.env.ZOHO_REFRESH_TOKEN;
  process.env.ZOHO_REFRESH_TOKEN = "token-de-lectura";
  try {
    await conToken(undefined, () => {
      assert.equal(nombreDePasarelaActiva(), "simulada");
      assert.throws(() => crearPasarelaZoho(), SinTokenDeEnviosError);
    });
  } finally {
    if (lectura === undefined) delete process.env.ZOHO_REFRESH_TOKEN;
    else process.env.ZOHO_REFRESH_TOKEN = lectura;
  }
});

test("si Zoho da la misma dirección como buzón y como organización, se envía por la de la organización", () => {
  const remitentes = [
    { email: "javiercanas@imparcapital.com", nombre: "Javier Canas", tipo: "pop" },
    { email: "javiercanas@imparcapital.com", nombre: "Javier Canas Valverde", tipo: "org_email" },
    { email: "marketing@imparcapital.com", nombre: "Impar Capital", tipo: "org_email" },
  ];
  assert.equal(elegirRemitente(remitentes, " JavierCanas@imparcapital.com ")?.tipo, "org_email");
  assert.equal(elegirRemitente(remitentes.slice(0, 1), "javiercanas@imparcapital.com")?.tipo, "pop");
  // Una dirección que Zoho no ofrece no es remitente, esté o no en los ajustes.
  assert.equal(elegirRemitente(remitentes, "otro@imparcapital.com"), null);
});

test("el cuerpo de la llamada lleva la plantilla y solo las direcciones del correo", () => {
  const cuerpo = cuerpoDeEnvio(
    correo({ copia: ["javiercanas@imparcapital.com"], copiaOculta: [] }),
    { email: "javiercanas@imparcapital.com", nombre: "Javier Canas", tipo: "primary" },
  );
  assert.deepEqual(cuerpo, {
    data: [
      {
        from: { user_name: "Javier Canas", email: "javiercanas@imparcapital.com" },
        to: [{ email: "javiercanas@imparcapital.com" }],
        cc: [{ email: "javiercanas@imparcapital.com" }],
        template: { id: "plantilla-1" },
        org_email: false,
      },
    ],
  });
  const organizacion = cuerpoDeEnvio(correo(), { email: "inversores@imparcapital.com", nombre: null, tipo: "org_email" });
  const mensaje = (organizacion.data as Record<string, unknown>[])[0]!;
  assert.equal(mensaje.org_email, true);
  assert.equal("cc" in mensaje || "bcc" in mensaje, false);
});
