import assert from "node:assert/strict";
import { test } from "node:test";

import type { ComEventoRow, DestinatarioCalculado, Direccion } from "@/modules/comunicaciones/types";
import {
  abrio,
  agruparPorPlantilla,
  cifrasDe,
  clicsPorEnlace,
  cumpleFiltro,
  enlacesPulsados,
  esMedible,
  filasPorComunicacion,
  filasPorCuenta,
  porQueNoEsMedible,
  serieTemporal,
  type ComunicacionAnalitica,
  type DestinatarioAnalitica,
} from "../analitica";
import { ajustarAlOriginal, cuentasParaReenvio, esFiltroDeReenvio, MOTIVO_DIRECCION_NUEVA } from "../reenvio";

// Las cifras del panel y, sobre todo, a quién incluye un reenvío.

const dir = (email: string): Direccion => ({ email, nombre: email, contactoZohoId: `c-${email}`, rol: "Contacto principal" });

function dest(id: string, p: Partial<DestinatarioAnalitica> = {}): DestinatarioAnalitica {
  return {
    id,
    comunicacion_id: "com-1",
    cuenta_zoho_id: `cuenta-${id}`,
    cuenta_nombre: `Cuenta ${id}`,
    para: [dir(`${id}@inversor.com`)],
    copia: [],
    excluido: false,
    estado_envio: "enviado",
    enviado_at: "2026-10-06T10:00:00Z",
    enviado_para: { remitente: "r@imparcapital.com", para: [`${id}@inversor.com`], copia: [], copiaOculta: [] },
    aperturas: 0,
    primera_apertura_at: null,
    ultima_apertura_at: null,
    clics: 0,
    primer_clic_at: null,
    ultimo_clic_at: null,
    entrega_estado: null,
    rebote_motivo: null,
    error: null,
    ...p,
  };
}

let nEvento = 0;
function evento(destinatario: string | null, tipo: "apertura" | "clic", p: Partial<ComEventoRow> = {}): ComEventoRow {
  return {
    id: ++nEvento,
    comunicacion_id: "com-1",
    destinatario_id: destinatario,
    token: "t",
    tipo,
    enlace: tipo === "clic" ? 0 : null,
    automatico: false,
    es_prueba: false,
    agente: "Mozilla",
    ocurrido_at: "2026-10-06T10:30:00Z",
    ...p,
  };
}

const LISTA = [
  dest("nada"),
  dest("abre", { aperturas: 2, ultima_apertura_at: "2026-10-06T11:00:00Z" }),
  dest("clic", { aperturas: 1, clics: 1, ultimo_clic_at: "2026-10-06T12:00:00Z" }),
  // Pulsó un enlace sin que conste la imagen: lo abrió igualmente.
  dest("clic-sin-imagen", { clics: 3 }),
  dest("error", { estado_envio: "error", error: "LIMIT_EXCEEDED" }),
  dest("omitido", { estado_envio: "omitido" }),
  dest("rebotado", { entrega_estado: "rebotado" }),
  dest("excluido", { excluido: true, estado_envio: "pendiente" }),
];

test("quien pulsa un enlace cuenta como que abrió, aunque no conste la imagen", () => {
  assert.equal(abrio(dest("x", { clics: 1 })), true);
  assert.equal(abrio(dest("x", { aperturas: 1 })), true);
  assert.equal(abrio(dest("x")), false);
});

test("las cifras cuentan solo lo que salió, y las tasas van sobre los enviados", () => {
  const c = cifrasDe(LISTA);
  assert.equal(c.enviados, 5);
  assert.equal(c.abiertos, 3);
  assert.equal(c.conClic, 2);
  assert.equal(c.errores, 1);
  assert.equal(c.omitidos, 1);
  assert.equal(c.rebotados, 1);
  assert.equal(c.tasaApertura, 3 / 5);
  assert.equal(c.tasaClic, 2 / 5);
  assert.equal(cifrasDe([]).tasaApertura, null);
});

test("cada filtro elige a quien tiene que elegir", () => {
  const pulsados = new Map([["clic", new Set([0])], ["clic-sin-imagen", new Set([1])]]);
  const ids = (filtro: Parameters<typeof cumpleFiltro>[1], enlace: number | null = null) =>
    LISTA.filter((d) => cumpleFiltro(d, filtro, enlace, pulsados)).map((d) => d.id);
  assert.equal(ids("todos").length, LISTA.length);
  assert.deepEqual(ids("no_consta_apertura"), ["nada", "rebotado"]);
  assert.deepEqual(ids("abrio"), ["abre", "clic", "clic-sin-imagen"]);
  assert.deepEqual(ids("hizo_clic"), ["clic", "clic-sin-imagen"]);
  assert.deepEqual(ids("abrio_sin_clic"), ["abre"]);
  assert.deepEqual(ids("pulso_enlace", 0), ["clic"]);
  assert.deepEqual(ids("pulso_enlace", 1), ["clic-sin-imagen"]);
  assert.deepEqual(ids("pulso_enlace", null), []);
  assert.deepEqual(ids("error"), ["error"]);
  assert.deepEqual(ids("rebotado"), ["rebotado"]);
});

test("de un correo que no salió no se dice que «no consta apertura»", () => {
  for (const d of [dest("e", { estado_envio: "error" }), dest("o", { estado_envio: "omitido" }), dest("x", { excluido: true })]) {
    assert.equal(cumpleFiltro(d, "no_consta_apertura"), false);
  }
});

test("lo que abre un filtro de correo y lo de la prueba no entra en ninguna cifra", () => {
  const eventos = [
    evento("a", "clic", { enlace: 0 }),
    evento("a", "clic", { enlace: 0 }),
    evento("b", "clic", { enlace: 1 }),
    evento("c", "clic", { enlace: 0, automatico: true }),
    evento(null, "clic", { enlace: 0, es_prueba: true }),
    evento("a", "apertura"),
  ];
  assert.deepEqual([...enlacesPulsados(eventos).entries()].map(([k, v]) => [k, [...v]]), [["a", [0]], ["b", [1]]]);
  const enlaces = [{ posicion: 1, url: "https://b", texto: "B" }, { posicion: 0, url: "https://a", texto: "A" }];
  assert.deepEqual(
    clicsPorEnlace(eventos, enlaces).map((e) => [e.posicion, e.clics, e.personas]),
    [[0, 2, 1], [1, 1, 1]],
  );
  const serie = serieTemporal(eventos, "2026-10-06T10:00:00Z", 3);
  assert.deepEqual(serie, [{ hora: 0, aperturas: 1, clics: 3 }, { hora: 1, aperturas: 0, clics: 0 }, { hora: 2, aperturas: 0, clics: 0 }]);
});

test("la evolución ignora lo anterior al envío y lo que cae fuera del periodo", () => {
  const eventos = [
    evento("a", "apertura", { ocurrido_at: "2026-10-06T09:59:00Z" }),
    evento("a", "apertura", { ocurrido_at: "2026-10-06T11:10:00Z" }),
    evento("a", "apertura", { ocurrido_at: "2026-10-09T11:10:00Z" }),
  ];
  const serie = serieTemporal(eventos, "2026-10-06T10:00:00Z", 2);
  assert.deepEqual(serie.map((p) => p.aperturas), [0, 1]);
  assert.equal(serieTemporal(eventos, null, 2).every((p) => p.aperturas === 0), true);
});

test("solo es medible lo que salió por Zoho y en modo real", () => {
  const base = { estado: "enviada", modo_envio: "real", pasarela: "zoho" } as const;
  assert.equal(esMedible(base), true);
  assert.equal(porQueNoEsMedible(base), null);
  assert.equal(esMedible({ ...base, modo_envio: "pruebas" }), false);
  assert.equal(esMedible({ ...base, pasarela: "simulada" }), false);
  assert.equal(esMedible({ ...base, estado: "probada" }), false);
  assert.equal(esMedible({ ...base, modo_envio: null }), false);
  for (const c of [{ ...base, modo_envio: "pruebas" as const }, { ...base, pasarela: "simulada" as const }, { ...base, estado: "borrador" as const }, { ...base, modo_envio: null }]) {
    assert.ok(porQueNoEsMedible(c));
  }
});

// ---------------------------------------------------------------------------
// El agregado
// ---------------------------------------------------------------------------

function com(id: string, p: Partial<ComunicacionAnalitica> = {}): ComunicacionAnalitica {
  return {
    id,
    nombre: `Comunicación ${id}`,
    estado: "enviada",
    modo_envio: "real",
    pasarela: "zoho",
    plantilla_id: "plantilla-1",
    plantilla_nombre: "Informe Q2",
    origen_comunicacion_id: null,
    enviada_at: "2026-10-06T10:00:00Z",
    confirmada_at: "2026-10-06T09:59:00Z",
    created_at: "2026-10-06T09:00:00Z",
    ...p,
  };
}

test("la misma plantilla enviada dos veces: cada envío con sus cifras, y las personas sin contar dos veces", () => {
  const comunicaciones = [com("original"), com("reenvio", { origen_comunicacion_id: "original" }), com("otra", { plantilla_id: "plantilla-2", plantilla_nombre: "Avance" })];
  const ana = "ana@inversor.com";
  const luis = "luis@inversor.com";
  const con = (id: string, comunicacion_id: string, email: string, p: Partial<DestinatarioAnalitica> = {}) =>
    dest(id, { comunicacion_id, cuenta_zoho_id: `cuenta-${email}`, para: [dir(email)], enviado_para: { remitente: "r", para: [email], copia: [], copiaOculta: [] }, ...p });
  const destinatarios = [
    con("1", "original", ana, { aperturas: 1 }),
    con("2", "original", luis),
    // Luis no abrió el original y sí el reenvío.
    con("3", "reenvio", luis, { aperturas: 1, clics: 1 }),
    con("4", "otra", ana),
  ];
  const filas = filasPorComunicacion(comunicaciones, destinatarios);
  assert.deepEqual(filas.map((f) => [f.comunicacion.id, f.cifras.enviados, f.cifras.abiertos, f.esReenvio]), [
    ["original", 2, 1, false],
    ["reenvio", 1, 1, true],
    ["otra", 1, 0, false],
  ]);

  const grupos = agruparPorPlantilla(filas, destinatarios);
  const informe = grupos.find((g) => g.plantillaId === "plantilla-1")!;
  assert.equal(informe.envios.length, 2);
  assert.equal(informe.personas, 2, "Ana y Luis: dos personas, no tres correos");
  assert.equal(informe.personasQueAbrieron, 2);
  assert.equal(informe.personasConClic, 1);
  assert.equal(grupos.find((g) => g.plantillaId === "plantilla-2")!.personas, 1);
});

test("la tabla por cuenta suma a través de todas las comunicaciones", () => {
  const filas = filasPorCuenta([
    dest("1", { cuenta_zoho_id: "a", cuenta_nombre: "Ana", aperturas: 1, ultima_apertura_at: "2026-10-01T10:00:00Z" }),
    dest("2", { cuenta_zoho_id: "a", cuenta_nombre: "Ana", clics: 1, ultimo_clic_at: "2026-10-05T10:00:00Z" }),
    dest("3", { cuenta_zoho_id: "a", cuenta_nombre: "Ana" }),
    dest("4", { cuenta_zoho_id: "b", cuenta_nombre: "Beto", estado_envio: "error" }),
  ]);
  assert.equal(filas.length, 1, "una cuenta a la que no le llegó nada no aparece");
  assert.deepEqual([filas[0]!.recibidas, filas[0]!.abiertas, filas[0]!.conClic, filas[0]!.ultimaActividad], [3, 2, 1, "2026-10-05T10:00:00Z"]);
});

// ---------------------------------------------------------------------------
// Reenvío
// ---------------------------------------------------------------------------

test("no se reenvía sobre «todos» ni sobre «rebotado»", () => {
  assert.equal(esFiltroDeReenvio("todos"), false);
  assert.equal(esFiltroDeReenvio("rebotado"), false);
  assert.deepEqual(cuentasParaReenvio(LISTA, "todos", null, new Map()), []);
  assert.deepEqual(cuentasParaReenvio(LISTA, "rebotado", null, new Map()), []);
});

test("el reenvío elige solo las cuentas del original que cumplen el filtro", () => {
  assert.deepEqual(cuentasParaReenvio(LISTA, "no_consta_apertura", null, new Map()), ["cuenta-nada", "cuenta-rebotado"]);
  assert.deepEqual(cuentasParaReenvio(LISTA, "abrio_sin_clic", null, new Map()), ["cuenta-abre"]);
  assert.deepEqual(cuentasParaReenvio(LISTA, "error", null, new Map()), ["cuenta-error"]);
});

function calculado(cuenta: string, emails: string[], p: Partial<DestinatarioCalculado> = {}): DestinatarioCalculado {
  return { cuentaZohoId: cuenta, cuentaNombre: `Cuenta ${cuenta}`, para: emails.map(dir), copia: [], avisos: [], excluido: false, excluidoMotivo: null, ...p };
}
const ORIGINALES = [
  { cuenta_zoho_id: "a", cuenta_nombre: "Cuenta a", para: [dir("ana@inversor.com")], copia: [dir("abogada@bufete.com")] },
  { cuenta_zoho_id: "b", cuenta_nombre: "Cuenta b", para: [dir("beto@inversor.com")], copia: [] },
  { cuenta_zoho_id: "c", cuenta_nombre: "Cuenta c", para: [dir("cris@inversor.com")], copia: [] },
];

test("un reenvío NUNCA incluye una cuenta que no estuviera en el original o que no cumpla el filtro", () => {
  const hoy = [
    calculado("a", ["ana@inversor.com"]),
    calculado("c", ["cris@inversor.com"]), // estaba en el original, pero no cumple el filtro
    calculado("z", ["intruso@otro.com"]), // no estaba en el original
  ];
  const { destinatarios } = ajustarAlOriginal(hoy, ORIGINALES, ["a", "b", "z"]);
  assert.deepEqual(destinatarios.map((d) => d.cuentaZohoId), ["a"]);
});

test("una dirección que no estaba en el original deja la cuenta excluida hasta que alguien la mire", () => {
  const hoy = [
    calculado("a", ["ana@inversor.com", "nueva@inversor.com"]),
    // Antes iba en copia y hoy va en Para: no es nueva.
    calculado("b", ["beto@inversor.com"]),
  ];
  const { destinatarios, diferencias } = ajustarAlOriginal(hoy, ORIGINALES, ["a", "b"]);
  const a = destinatarios.find((d) => d.cuentaZohoId === "a")!;
  assert.equal(a.excluido, true);
  assert.equal(a.excluidoMotivo, MOTIVO_DIRECCION_NUEVA);
  assert.ok(a.avisos.includes("direccion_nueva"));
  assert.equal(destinatarios.find((d) => d.cuentaZohoId === "b")!.excluido, false);
  assert.deepEqual(diferencias.nuevas, [{ cuenta: "Cuenta a", email: "nueva@inversor.com" }]);
});

test("pasar de copia a Para no es una dirección nueva, y las mayúsculas tampoco", () => {
  const hoy = [calculado("a", ["Abogada@Bufete.com", "ANA@inversor.com"])];
  const { destinatarios, diferencias } = ajustarAlOriginal(hoy, ORIGINALES, ["a"]);
  assert.equal(destinatarios[0]!.excluido, false);
  assert.deepEqual(diferencias.nuevas, []);
});

test("se dice quién se cae respecto al original y por qué", () => {
  const hoy = [
    calculado("a", [], { avisos: ["dado_de_baja", "sin_destinatario"] }),
    calculado("b", ["beto@inversor.com"], { excluido: true, excluidoMotivo: "El dominio de alguna de sus direcciones no recibe correo" }),
  ];
  const { diferencias } = ajustarAlOriginal(hoy, ORIGINALES, ["a", "b", "c"]);
  assert.deepEqual(diferencias.seCaen.map((s) => s.cuenta).sort(), ["Cuenta a", "Cuenta b", "Cuenta c"]);
  assert.ok(diferencias.seCaen.find((s) => s.cuenta === "Cuenta c")!.motivo.includes("Zoho"));
});

test("una cuenta ya excluida por otra causa conserva su motivo aunque además tenga una dirección nueva", () => {
  const hoy = [calculado("a", ["otra@inversor.com"], { excluido: true, excluidoMotivo: "Cuenta de prueba o técnica" })];
  const { destinatarios } = ajustarAlOriginal(hoy, ORIGINALES, ["a"]);
  assert.equal(destinatarios[0]!.excluidoMotivo, "Cuenta de prueba o técnica");
  assert.equal(destinatarios[0]!.excluido, true);
});
