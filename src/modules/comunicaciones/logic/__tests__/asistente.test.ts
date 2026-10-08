import assert from "node:assert/strict";
import { test } from "node:test";

import type { ComAjustesRow, ComComunicacionRow, ResumenDestinatarios } from "@/modules/comunicaciones/types";
import type { ContextoControles } from "../controles";
import {
  avisoDeRetroceso,
  estadosDePasos,
  motivoParaContinuar,
  pasoAMostrar,
  pasoCompletado,
  pasoSugerido,
  puedeIrA,
} from "../asistente";

// El asistente no añade controles: decide qué paso enseñar y adónde se puede ir.

type C = Pick<ComComunicacionRow, "estado" | "plantilla_id">;
const c = (estado: C["estado"], plantilla_id: string | null = null): C => ({ estado, plantilla_id });

test("el paso sugerido es el primero que falta", () => {
  assert.equal(pasoSugerido(c("borrador")), "destinatarios");
  assert.equal(pasoSugerido(c("borrador", "p")), "destinatarios", "con plantilla, pero la lista sin revisar");
  assert.equal(pasoSugerido(c("revisada")), "contenido");
  assert.equal(pasoSugerido(c("revisada", "p")), "prueba");
  assert.equal(pasoSugerido(c("probada", "p")), "enviar");
  assert.equal(pasoSugerido(c("enviando", "p")), "enviar");
  assert.equal(pasoSugerido(c("pausada", "p")), "enviar");
  assert.equal(pasoSugerido(c("enviada", "p")), "enviar");
});

test("hacia atrás siempre; hacia delante, no más allá del primer paso que falta", () => {
  const revisada = c("revisada");
  assert.ok(puedeIrA("audiencia", revisada));
  assert.ok(puedeIrA("destinatarios", revisada));
  assert.ok(puedeIrA("contenido", revisada));
  assert.ok(!puedeIrA("prueba", revisada));
  assert.ok(!puedeIrA("enviar", revisada));
  assert.ok(puedeIrA("enviar", c("probada", "p")));
});

test("un paso pedido que no toca, o que no existe, lleva al sugerido", () => {
  assert.equal(pasoAMostrar("enviar", c("borrador")), "destinatarios");
  assert.equal(pasoAMostrar("cualquiera", c("revisada", "p")), "prueba");
  assert.equal(pasoAMostrar(undefined, c("probada", "p")), "enviar");
  assert.equal(pasoAMostrar("audiencia", c("probada", "p")), "audiencia");
});

test("hecho lo dice el estado guardado", () => {
  assert.ok(!pasoCompletado("destinatarios", c("borrador", "p")));
  assert.ok(!pasoCompletado("contenido", c("borrador", "p")), "al volver a borrador hay que pasar otra vez por la plantilla");
  assert.ok(pasoCompletado("contenido", c("revisada", "p")));
  assert.ok(!pasoCompletado("prueba", c("revisada", "p")));
  assert.ok(pasoCompletado("prueba", c("probada", "p")));
  assert.ok(!pasoCompletado("enviar", c("enviando", "p")));
  assert.ok(pasoCompletado("enviar", c("enviada", "p")));
});

test("el stepper: el que se ve es el actual y el candado bloquea el último", () => {
  const e = estadosDePasos(c("revisada", "p"), "contenido", true);
  assert.deepEqual(e, {
    audiencia: "hecho",
    destinatarios: "hecho",
    contenido: "actual",
    prueba: "pendiente",
    enviar: "bloqueado",
  });
  assert.equal(estadosDePasos(c("probada", "p"), "enviar", true).enviar, "actual");
});

const RESUMEN: ResumenDestinatarios = { total: 3, aEnviar: 2, excluidos: 0, sinDestinatario: 1, direcciones: 2, direccionesExternas: 0 };
const AJUSTES: ComAjustesRow = {
  envios_activados: true,
  modo: "pruebas",
  cuenta_pruebas_zoho_id: "jcv",
  remitentes_permitidos: ["javiercanas@imparcapital.com"],
  dominios_internos: ["imparcapital.com"],
};

function ctx(p: Partial<ComComunicacionRow>, rol: ContextoControles["rol"] = "editor"): ContextoControles {
  return {
    comunicacion: { estado: "borrador", plantilla_id: null, ...p } as ComComunicacionRow,
    resumen: RESUMEN,
    ajustes: AJUSTES,
    rol,
  };
}

test("continuar usa los mismos controles que el servidor", () => {
  assert.equal(motivoParaContinuar("destinatarios", ctx({})), null);
  assert.ok(motivoParaContinuar("destinatarios", ctx({}, "lector")), "un lector no revisa");
  assert.equal(motivoParaContinuar("destinatarios", ctx({ estado: "revisada" })), null, "ya revisada: continuar solo navega");
  assert.ok(motivoParaContinuar("contenido", ctx({ estado: "revisada" })));
  assert.equal(motivoParaContinuar("contenido", ctx({ estado: "revisada", plantilla_id: "p" })), null);
  assert.ok(motivoParaContinuar("prueba", ctx({ estado: "revisada", plantilla_id: "p" })), "sin prueba enviada");
  assert.equal(
    motivoParaContinuar(
      "prueba",
      ctx({ estado: "revisada", plantilla_id: "p", prueba_enviada_at: "2026-10-08T08:00:00Z", prueba_enviada_plantilla_id: "p" }),
    ),
    null,
  );
  assert.equal(motivoParaContinuar("prueba", ctx({ estado: "probada", plantilla_id: "p" })), null);
});

test("retroceder avisa de qué hay que repetir", () => {
  assert.ok(avisoDeRetroceso("revisada", "borrador")?.includes("lista"));
  assert.ok(avisoDeRetroceso("probada", "borrador")?.includes("lista"));
  assert.ok(avisoDeRetroceso("probada", "revisada")?.includes("prueba"));
  assert.equal(avisoDeRetroceso("borrador", "revisada"), null);
  assert.equal(avisoDeRetroceso("probada", "enviando"), null);
});
