import assert from "node:assert/strict";
import { test } from "node:test";

import type {
  ComAjustesRow,
  ComComunicacionRow,
  ResumenDestinatarios,
} from "@/modules/comunicaciones/types";
import {
  cabeEnElDia,
  ensayoVigente,
  ENVIOS_DESACTIVADOS,
  puedeCambiarAjustes,
  puedeConfirmar,
  puedeDetener,
  puedeEnsayar,
  puedeEnviarPrueba,
  puedeMarcarPrueba,
  puedeReanudar,
  puedeRevisar,
  puedeSeguirEnviando,
  type ContextoControles,
} from "../controles";

// Cada control, por separado, tiene que decir que no. Son las mismas funciones
// que llaman las acciones del servidor antes de hacer nada.

const AHORA = new Date("2026-10-06T10:00:00Z");
const REMITENTE = "javiercanas@imparcapital.com";

function comunicacion(p: Partial<ComComunicacionRow> = {}): ComComunicacionRow {
  return {
    id: "c1",
    nombre: "Otro · PROMOCIONTEST · 2026-10-06",
    tipo: "otro",
    audiencia: "promocion",
    promocion_zoho_id: "p",
    promocion_nombre: "PROMOCIONTEST",
    roles_para: ["principal"],
    roles_copia: [],
    plantilla_id: "plantilla-1",
    plantilla_nombre: "Plantilla",
    plantilla_modulo: "Cuentas_de_Inversi_n",
    remitente_email: REMITENTE,
    estado: "probada",
    datos_zoho_at: "2026-10-06T06:00:00Z",
    creada_por: null,
    creada_por_email: REMITENTE,
    revisada_por_email: REMITENTE,
    revisada_at: "2026-10-06T08:00:00Z",
    revisada_n: 2,
    probada_por_email: REMITENTE,
    probada_at: "2026-10-06T08:10:00Z",
    probada_plantilla_id: "plantilla-1",
    confirmada_por_email: null,
    confirmada_at: null,
    confirmada_n: null,
    enviada_at: null,
    created_at: "2026-10-06T07:00:00Z",
    updated_at: "2026-10-06T08:10:00Z",
    prueba_enviada_at: "2026-10-06T08:05:00Z",
    prueba_enviada_por_email: REMITENTE,
    prueba_enviada_plantilla_id: "plantilla-1",
    prueba_message_id: "m1",
    pasarela: "simulada",
    ensayo_at: "2026-10-06T09:55:00Z",
    ensayo_por_email: REMITENTE,
    ensayo_resumen: {
      asunto: "Asunto",
      correos: 2,
      omitidos: 0,
      direcciones: [REMITENTE],
      conCamposVacios: [],
      enlaces: 2,
      adjuntos: [],
      imagen: "pixel",
      modo: "pruebas",
    },
    ...p,
  };
}

const RESUMEN: ResumenDestinatarios = {
  total: 3,
  aEnviar: 2,
  excluidos: 0,
  sinDestinatario: 1,
  direcciones: 2,
  direccionesExternas: 0,
};

const AJUSTES: ComAjustesRow = {
  envios_activados: true,
  modo: "pruebas",
  cuenta_pruebas_zoho_id: "jcv",
  remitentes_permitidos: [REMITENTE],
  dominios_internos: ["imparcapital.com"],
};

function ctx(p: Partial<ContextoControles> = {}): ContextoControles {
  return { comunicacion: comunicacion(), resumen: RESUMEN, ajustes: AJUSTES, rol: "editor", ...p };
}

test("un lector no pasa ningún control", () => {
  const lector = ctx({ rol: "lector" });
  assert.ok(puedeRevisar({ ...lector, comunicacion: comunicacion({ estado: "borrador" }) }, 2));
  assert.ok(puedeEnviarPrueba(lector, REMITENTE));
  assert.ok(puedeMarcarPrueba(lector));
  assert.ok(puedeConfirmar(lector, 2, AHORA));
  assert.ok(puedeSeguirEnviando({ ...lector, comunicacion: comunicacion({ estado: "enviando" }) }));
  assert.ok(puedeDetener({ ...lector, comunicacion: comunicacion({ estado: "enviando" }) }));
  assert.ok(puedeReanudar({ ...lector, comunicacion: comunicacion({ estado: "pausada" }) }));
  assert.ok(puedeSeguirEnviando({ ...ctx({ rol: null }), comunicacion: comunicacion({ estado: "enviando" }) }));
});

test("revisar: solo desde borrador, con correos que enviar y con el número que se vio", () => {
  const borrador = ctx({ comunicacion: comunicacion({ estado: "borrador" }) });
  assert.equal(puedeRevisar(borrador, 2), null);
  assert.ok(puedeRevisar(borrador, 3), "la lista cambió desde que se cargó la página");
  assert.ok(puedeRevisar(ctx(), 2), "ya no está en borrador");
  assert.ok(puedeRevisar({ ...borrador, resumen: { ...RESUMEN, aEnviar: 0 } }, 0));
});

test("prueba: no se envía sin revisión", () => {
  assert.ok(puedeEnviarPrueba(ctx({ comunicacion: comunicacion({ estado: "borrador" }) }), REMITENTE));
  assert.equal(puedeEnviarPrueba(ctx({ comunicacion: comunicacion({ estado: "revisada" }) }), REMITENTE), null);
});

test("prueba: con el interruptor apagado no sale ni la prueba", () => {
  const apagado = ctx({ ajustes: { ...AJUSTES, envios_activados: false } });
  assert.equal(puedeEnviarPrueba(apagado, REMITENTE), ENVIOS_DESACTIVADOS);
});

test("prueba: hace falta plantilla y un remitente de los permitidos", () => {
  assert.ok(puedeEnviarPrueba(ctx({ comunicacion: comunicacion({ plantilla_id: null }) }), REMITENTE));
  assert.ok(puedeEnviarPrueba(ctx(), "otro@imparcapital.com"));
  assert.ok(puedeEnviarPrueba(ctx(), ""));
  assert.equal(puedeEnviarPrueba(ctx(), " JavierCanas@ImparCapital.com "), null);
});

test("«la he visto bien» no se puede marcar sin haber enviado una prueba con esa plantilla", () => {
  const revisada = (p: Partial<ComComunicacionRow>) =>
    ctx({ comunicacion: comunicacion({ estado: "revisada", ...p }) });
  assert.equal(puedeMarcarPrueba(revisada({})), null);
  assert.ok(puedeMarcarPrueba(revisada({ prueba_enviada_at: null })));
  assert.ok(puedeMarcarPrueba(revisada({ prueba_enviada_plantilla_id: "otra" })), "la prueba fue con otra plantilla");
  assert.ok(puedeMarcarPrueba(ctx({ comunicacion: comunicacion({ estado: "borrador" }) })));
});

test("confirmar: pasa cuando todo está en orden y el número coincide", () => {
  assert.equal(puedeConfirmar(ctx(), 2, AHORA), null);
});

test("confirmar: no se envía sin revisión ni sin prueba", () => {
  assert.ok(puedeConfirmar(ctx({ comunicacion: comunicacion({ estado: "borrador" }) }), 2, AHORA));
  assert.ok(puedeConfirmar(ctx({ comunicacion: comunicacion({ estado: "revisada" }) }), 2, AHORA));
});

test("confirmar: el número mal tecleado no envía", () => {
  assert.ok(puedeConfirmar(ctx(), 3, AHORA));
  assert.ok(puedeConfirmar(ctx(), 0, AHORA));
  assert.ok(puedeConfirmar(ctx(), Number.NaN, AHORA));
  assert.ok(puedeConfirmar(ctx(), 2.5, AHORA));
});

test("confirmar: el interruptor apagado no envía", () => {
  assert.equal(
    puedeConfirmar(ctx({ ajustes: { ...AJUSTES, envios_activados: false } }), 2, AHORA),
    ENVIOS_DESACTIVADOS,
  );
});

test("confirmar: una comunicación preparada con datos de otro día no se envía", () => {
  const deAyer = ctx({ comunicacion: comunicacion({ datos_zoho_at: "2026-10-05T06:00:00Z" }) });
  assert.ok(puedeConfirmar(deAyer, 2, AHORA));
});

test("confirmar: si la lista o la plantilla cambiaron después del control, no vale", () => {
  assert.ok(puedeConfirmar(ctx({ resumen: { ...RESUMEN, aEnviar: 3 } }), 3, AHORA), "la lista creció");
  assert.ok(puedeConfirmar(ctx({ comunicacion: comunicacion({ probada_plantilla_id: "otra" }) }), 2, AHORA));
  assert.ok(puedeConfirmar(ctx({ comunicacion: comunicacion({ remitente_email: null }) }), 2, AHORA));
});

test("confirmar: sin ensayo general no se envía", () => {
  assert.ok(puedeConfirmar(ctx({ comunicacion: comunicacion({ ensayo_at: null }) }), 2, AHORA));
  assert.ok(puedeConfirmar(ctx({ comunicacion: comunicacion({ ensayo_resumen: null }) }), 2, AHORA));
});

test("confirmar: un ensayo viejo, de otro modo o de otra lista no vale", () => {
  const resumen = comunicacion().ensayo_resumen!;
  const viejo = ctx({ comunicacion: comunicacion({ ensayo_at: "2026-10-06T09:00:00Z" }) });
  assert.ok(puedeConfirmar(viejo, 2, AHORA), "de hace una hora");
  const delFuturo = ctx({ comunicacion: comunicacion({ ensayo_at: "2026-10-06T11:00:00Z" }) });
  assert.ok(puedeConfirmar(delFuturo, 2, AHORA));
  // Se ensayó en pruebas y ahora el modo es real: los destinatarios son otros.
  assert.ok(puedeConfirmar(ctx({ ajustes: { ...AJUSTES, modo: "real" } }), 2, AHORA));
  const otraLista = ctx({ comunicacion: comunicacion({ ensayo_resumen: { ...resumen, correos: 1 } }) });
  assert.ok(puedeConfirmar(otraLista, 2, AHORA));
  // Un omitido por dirección repetida cuenta: 1 correo + 1 omitido son los 2 de la lista.
  const conOmitido = ctx({ comunicacion: comunicacion({ ensayo_resumen: { ...resumen, correos: 1, omitidos: 1 } }) });
  assert.equal(puedeConfirmar(conOmitido, 2, AHORA), null);
  assert.equal(ensayoVigente(ctx(), AHORA), null);
});

test("ensayar exige lo mismo que confirmar, menos el propio ensayo y el número", () => {
  assert.equal(puedeEnsayar(ctx({ comunicacion: comunicacion({ ensayo_at: null, ensayo_resumen: null }) }), AHORA), null);
  assert.ok(puedeEnsayar(ctx({ comunicacion: comunicacion({ estado: "revisada" }) }), AHORA));
  assert.ok(puedeEnsayar(ctx({ ajustes: { ...AJUSTES, envios_activados: false } }), AHORA));
  assert.ok(puedeEnsayar(ctx({ rol: "lector" }), AHORA));
});

test("el tope diario: no se confirma lo que no cabe en lo que queda del día", () => {
  assert.equal(cabeEnElDia(0, 100, 100), null);
  assert.equal(cabeEnElDia(98, 2, 100), null);
  assert.ok(cabeEnElDia(98, 3, 100));
  assert.ok(cabeEnElDia(100, 1, 100));
  assert.ok(cabeEnElDia(120, 1, 100), "si ya se pasó, no queda nada");
  assert.equal(cabeEnElDia(100, 0, 100), null);
});

test("antes de cada correo: el interruptor apagado o la comunicación detenida paran el envío", () => {
  const enviando = ctx({ comunicacion: comunicacion({ estado: "enviando" }) });
  assert.equal(puedeSeguirEnviando(enviando), null);
  assert.equal(
    puedeSeguirEnviando({ ...enviando, ajustes: { ...AJUSTES, envios_activados: false } }),
    ENVIOS_DESACTIVADOS,
  );
  assert.ok(puedeSeguirEnviando(ctx({ comunicacion: comunicacion({ estado: "pausada" }) })));
  assert.ok(puedeSeguirEnviando(ctx({ comunicacion: comunicacion({ estado: "enviada" }) })));
  assert.ok(puedeSeguirEnviando(ctx({ comunicacion: comunicacion({ estado: "cancelada" }) })));
});

test("detener y reanudar solo valen desde su estado", () => {
  assert.equal(puedeDetener(ctx({ comunicacion: comunicacion({ estado: "enviando" }) })), null);
  assert.ok(puedeDetener(ctx()));
  assert.equal(puedeReanudar(ctx({ comunicacion: comunicacion({ estado: "pausada" }) })), null);
  assert.ok(puedeReanudar(ctx({ comunicacion: comunicacion({ estado: "enviando" }) })));
  assert.ok(
    puedeReanudar(
      ctx({
        comunicacion: comunicacion({ estado: "pausada" }),
        ajustes: { ...AJUSTES, envios_activados: false },
      }),
    ),
  );
});

test("los ajustes de envío solo los cambia un administrador de la zona", () => {
  assert.equal(puedeCambiarAjustes("admin"), null);
  assert.ok(puedeCambiarAjustes("editor"));
  assert.ok(puedeCambiarAjustes("lector"));
  assert.ok(puedeCambiarAjustes(null));
});
