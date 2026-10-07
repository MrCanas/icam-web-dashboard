import assert from "node:assert/strict";
import { test } from "node:test";

import { MODULO_CUENTAS } from "../candado";
import { adjuntosDePlantilla, adjuntosSinIdentificador, componerCorreo, type ComponerEntrada } from "../composicion";
import type { CorreoSaliente } from "../envio";
import { huellaDeCorreo, sinClavesDeImagen } from "../huella";
import { TIPOS_DE_CAMPO_ADMITIDOS, renderizarPlantilla } from "../plantilla";
import { validarCorreo, type Esperado } from "../validarCorreo";

// Lo que se envía lo monta ahora el portal. Estas pruebas fijan que un correo
// mal montado no sale, y que lo que sale es lo que se ensayó.

const BASE = "https://go.imparcapital.com";
const TOKEN = "AAAAAAAAAAAAAAAAAAAAAA";
const OTRO = "BBBBBBBBBBBBBBBBBBBBBB";
const CUENTA = "261199000045049119";

const TIPOS = new Map<string, string>([
  ["Nombre", "text"],
  ["Name", "text"],
  ["CIF_Empresa", "text"],
  ["Monto", "currency"],
  ["Fecha_Alta", "date"],
  ["Recibi_URL", "website"],
]);

const HTML =
  `<html><body><p>Buenas tardes \${!Cuentas_de_Inversi_n.Nombre},</p>` +
  `<a href="https://www.youtube.com/@imparcapital/videos">Vídeos</a>` +
  `<a href="https://ejemplo.com/informe">Informe</a>` +
  `<img src="https://crm.zoho.eu/crm/viewInLineImage?fileContent=abc"></body></html>`;

function entrada(p: Partial<ComponerEntrada> = {}): ComponerEntrada {
  return {
    plantilla: {
      id: "plantilla-1",
      asunto: "Informe de ${!Cuentas_de_Inversi_n.Name}",
      html: HTML,
      adjuntos: [{ id: "fichero-1", nombre: "informe.pdf" }],
    },
    modulo: MODULO_CUENTAS,
    registro: { Nombre: "Javier", Name: "TEST CUENTA JCV", CIF_Empresa: "", Monto: 1234.5, Fecha_Alta: "2026-01-02" },
    tipos: TIPOS,
    base: BASE,
    token: TOKEN,
    ...p,
  };
}

function correoDe(e: ComponerEntrada = entrada()): { correo: CorreoSaliente; esperado: Esperado } {
  const c = componerCorreo(e);
  if (!c.ok) throw new Error(c.motivo);
  return {
    correo: {
      registro: { modulo: MODULO_CUENTAS, id: CUENTA },
      remitente: "javiercanas@imparcapital.com",
      para: ["javiercanas@imparcapital.com"],
      copia: [],
      copiaOculta: [],
      plantillaId: e.plantilla.id,
      contenido: c.contenido,
    },
    esperado: {
      token: e.token,
      registro: { modulo: MODULO_CUENTAS, id: CUENTA },
      enlaces: c.enlaces,
      enlacesDePlantilla: 2,
      adjuntosDePlantilla: e.plantilla.adjuntos.length,
      base: e.base,
    },
  };
}

// ---------------------------------------------------------------------------
// Montaje
// ---------------------------------------------------------------------------

test("el correo se monta con los campos resueltos, los enlaces rastreados y los adjuntos de la plantilla", () => {
  const c = componerCorreo(entrada());
  assert.equal(c.ok, true);
  if (!c.ok) return;
  assert.equal(c.contenido.asunto, "Informe de TEST CUENTA JCV");
  assert.ok(c.contenido.html.includes("Buenas tardes Javier,"));
  assert.deepEqual(c.enlaces, ["https://www.youtube.com/@imparcapital/videos", "https://ejemplo.com/informe"]);
  assert.deepEqual(c.contenido.adjuntos, ["fichero-1"]);
  assert.equal(c.imagen, "pixel");
  assert.deepEqual(c.vacios, []);
});

test("un campo vacío se monta y se avisa: no es un fallo, pero hay que verlo", () => {
  const c = componerCorreo(entrada({ registro: { Nombre: "", Name: "CUENTA MASTER" } }));
  assert.equal(c.ok, true);
  if (!c.ok) return;
  assert.ok(c.contenido.html.includes("Buenas tardes ,"));
  assert.deepEqual(c.vacios, ["${!Cuentas_de_Inversi_n.Nombre}"]);
});

test("un correo con un campo sin resolver NO se monta", () => {
  const casos: [string, string][] = [
    ["un campo que el registro no trae", "Hola ${!Cuentas_de_Inversi_n.Campo_Que_No_Existe}"],
    ["un campo de otro módulo", "Hola ${!Contacts.First_Name}"],
    ["un campo del usuario", "Saludos, ${!users.first_name}"],
    ["la firma del usuario", "Saludos, ${!userSignature}"],
    ["un importe, que Zoho formatea a su manera", "Has aportado ${!Cuentas_de_Inversi_n.Monto}"],
    ["una fecha", "Alta el ${!Cuentas_de_Inversi_n.Fecha_Alta}"],
    ["un campo que no está en la lista de tipos", "CIF ${!Cuentas_de_Inversi_n.Otro}"],
  ];
  for (const [nombre, texto] of casos) {
    const enCuerpo = componerCorreo(entrada({ plantilla: { id: "p", asunto: "Asunto", html: `<p>${texto}</p>`, adjuntos: [] }, registro: { Monto: 1, Fecha_Alta: "x", Otro: "y" } }));
    assert.equal(enCuerpo.ok, false, `${nombre} (cuerpo)`);
    const enAsunto = componerCorreo(entrada({ plantilla: { id: "p", asunto: texto, html: "<p>Hola</p>", adjuntos: [] }, registro: { Monto: 1, Fecha_Alta: "x", Otro: "y" } }));
    assert.equal(enAsunto.ok, false, `${nombre} (asunto)`);
  }
});

test("solo se resuelven los tipos de campo que Zoho escribe tal cual", () => {
  assert.deepEqual([...TIPOS_DE_CAMPO_ADMITIDOS].sort(), ["autonumber", "email", "phone", "picklist", "text", "textarea", "website"]);
  const r = renderizarPlantilla(
    { asunto: null, html: "${!Cuentas_de_Inversi_n.Recibi_URL} ${!Cuentas_de_Inversi_n.Monto}" },
    MODULO_CUENTAS,
    { Recibi_URL: "https://ejemplo.com/r", Monto: 10 },
    TIPOS,
  );
  assert.deepEqual(r.sinResolver, ["${!Cuentas_de_Inversi_n.Monto}"]);
  assert.ok(r.html.includes("https://ejemplo.com/r"));
});

test("un valor con HTML dentro no se cuela como HTML en el correo", () => {
  const c = componerCorreo(entrada({ registro: { Nombre: `<script>alert(1)</script><a href="https://malo.com">x</a>`, Name: "X" } }));
  assert.equal(c.ok, true);
  if (!c.ok) return;
  assert.equal(c.contenido.html.includes("<script>"), false);
  // No aparece un enlace que la plantilla no tenía.
  assert.equal(c.enlaces.length, 2);
});

test("sin cuerpo o sin asunto no hay correo", () => {
  assert.equal(componerCorreo(entrada({ plantilla: { id: "p", asunto: "A", html: "  ", adjuntos: [] } })).ok, false);
  assert.equal(componerCorreo(entrada({ plantilla: { id: "p", asunto: "   ", html: "<p>x</p>", adjuntos: [] } })).ok, false);
  assert.equal(componerCorreo(entrada({ plantilla: { id: "p", asunto: null, html: "<p>x</p>", adjuntos: [] } })).ok, false);
});

test("los adjuntos de la plantilla se leen por su identificador de fichero, y se sabe si falta alguno", () => {
  const crudo = { attachments: [{ file_id: "f1", file_name: "a.pdf", id: "1" }, { file_name: "sin-id.pdf", id: "2" }, "basura"] };
  assert.deepEqual(adjuntosDePlantilla(crudo), [{ id: "f1", nombre: "a.pdf" }]);
  assert.equal(adjuntosSinIdentificador(crudo), 2);
  assert.deepEqual(adjuntosDePlantilla({ attachments: null }), []);
  assert.equal(adjuntosSinIdentificador({}), 0);
});

// ---------------------------------------------------------------------------
// Validación
// ---------------------------------------------------------------------------

test("un correo bien montado no tiene ningún problema", () => {
  const { correo, esperado } = correoDe();
  assert.deepEqual(validarCorreo(correo, esperado), []);
});

test("un correo que no viene montado por el portal no pasa", () => {
  const { correo, esperado } = correoDe();
  assert.equal(validarCorreo({ ...correo, contenido: undefined }, esperado).length, 1);
});

/** Cambia el contenido de un correo bueno y dice cuántos problemas salen. */
function conContenido(cambio: (html: string, asunto: string) => { html?: string; asunto?: string; adjuntos?: string[] }): string[] {
  const { correo, esperado } = correoDe();
  const c = correo.contenido!;
  return validarCorreo({ ...correo, contenido: { ...c, ...cambio(c.html, c.asunto) } }, esperado);
}

test("cada cosa mal hecha en el cuerpo o el asunto se detecta", () => {
  const casos: [string, string[]][] = [
    ["resto de campo combinado en el cuerpo", conContenido((h) => ({ html: h.replace("Javier", "${!Cuentas_de_Inversi_n.Nombre}") }))],
    ["resto de campo combinado en el asunto", conContenido(() => ({ asunto: "Informe ${!userSignature}" }))],
    ["asunto vacío", conContenido(() => ({ asunto: "  " }))],
    ["asunto con salto de línea", conContenido(() => ({ asunto: "Informe\nBcc: otro@ejemplo.com" }))],
    ["cuerpo vacío", conContenido(() => ({ html: "" }))],
    ["cuerpo enorme", conContenido((h) => ({ html: h + "x".repeat(500_000) }))],
    ["un enlace sin rastrear", conContenido((h) => ({ html: h.replace("</body>", `<a href="https://sin-rastrear.com">x</a></body>`) }))],
    ["un enlace con el identificador de otro correo", conContenido((h) => ({ html: h.replace(`/api/s/e/${TOKEN}/1`, `/api/s/e/${OTRO}/1`) }))],
    ["la imagen de apertura de otro correo", conContenido((h) => ({ html: h.replace(`/api/s/a/${TOKEN}`, `/api/s/a/${OTRO}`) }))],
    ["sin imagen de apertura", conContenido((h) => ({ html: h.replace(/<img src="https:\/\/go[^>]*>/, "") }))],
    ["dos imágenes de apertura", conContenido((h) => ({ html: h.replace("</body>", `<img src="${BASE}/api/s/a/${TOKEN}"></body>`) }))],
    ["posiciones de enlace repetidas", conContenido((h) => ({ html: h.replace(`/api/s/e/${TOKEN}/1`, `/api/s/e/${TOKEN}/0`) }))],
    ["un enlace de menos", conContenido((h) => ({ html: h.replace(/<a href="https:\/\/go[^>]*>Informe<\/a>/, "") }))],
    ["un adjunto de menos", conContenido(() => ({ adjuntos: [] }))],
    ["un adjunto de más", conContenido(() => ({ adjuntos: ["fichero-1", "fichero-2"] }))],
    ["un adjunto sin identificador", conContenido(() => ({ adjuntos: [" "] }))],
  ];
  for (const [nombre, problemas] of casos) assert.ok(problemas.length > 0, nombre);
});

test("las direcciones, el registro y el identificador también se comprueban", () => {
  const { correo, esperado } = correoDe();
  assert.ok(validarCorreo({ ...correo, para: ["no-es-un-correo"] }, esperado).length > 0);
  assert.ok(validarCorreo({ ...correo, para: [] }, esperado).length > 0);
  assert.ok(validarCorreo({ ...correo, copia: ["a@b"] }, esperado).length > 0);
  assert.ok(validarCorreo({ ...correo, remitente: "sin arroba" }, esperado).length > 0);
  assert.ok(validarCorreo({ ...correo, registro: { modulo: MODULO_CUENTAS, id: "otra-cuenta" } }, esperado).length > 0);
  assert.ok(validarCorreo(correo, { ...esperado, token: "corto" }).length > 0);
  assert.ok(validarCorreo(correo, { ...esperado, enlaces: [esperado.enlaces[0]!] }).length > 0, "falta un destino guardado");
  assert.ok(validarCorreo(correo, { ...esperado, enlaces: ["javascript:alert(1)", esperado.enlaces[1]!] }).length > 0);
  // El correo de un destinatario no vale como el de otro.
  assert.ok(validarCorreo(correo, { ...esperado, token: OTRO }).length > 0);
});

// ---------------------------------------------------------------------------
// La huella: lo que se envía es lo que se ensayó
// ---------------------------------------------------------------------------

test("el mismo correo da la misma huella, aunque cambie el orden o las mayúsculas de las direcciones", async () => {
  const { correo } = correoDe();
  const a = await huellaDeCorreo({ ...correo, para: ["Javiercanas@imparcapital.com", "iranzuvicente@imparcapital.com"] });
  const b = await huellaDeCorreo({ ...correo, para: ["iranzuvicente@imparcapital.com", " javiercanas@imparcapital.com"] });
  assert.equal(a, b);
  assert.match(a, /^[0-9a-f]{64}$/);
});

test("cualquier cambio respecto a lo ensayado cambia la huella", async () => {
  const { correo } = correoDe();
  const ensayada = await huellaDeCorreo(correo);
  const c = correo.contenido!;
  const cambiados: [string, CorreoSaliente][] = [
    ["una dirección más en Para", { ...correo, para: [...correo.para, "otro@ejemplo.com"] }],
    ["otra dirección en Para", { ...correo, para: ["otro@ejemplo.com"] }],
    ["alguien en copia", { ...correo, copia: ["otro@ejemplo.com"] }],
    ["alguien en copia oculta", { ...correo, copiaOculta: ["otro@ejemplo.com"] }],
    ["otro remitente", { ...correo, remitente: "otro@imparcapital.com" }],
    ["otro registro", { ...correo, registro: { modulo: MODULO_CUENTAS, id: "otra" } }],
    ["otro asunto", { ...correo, contenido: { ...c, asunto: `${c.asunto}.` } }],
    ["el nombre del saludo", { ...correo, contenido: { ...c, html: c.html.replace("Javier", "Xavier") } }],
    ["un adjunto distinto", { ...correo, contenido: { ...c, adjuntos: ["fichero-2"] } }],
    ["otra plantilla", { ...correo, plantillaId: "plantilla-2" }],
  ];
  for (const [nombre, cambiado] of cambiados) {
    assert.notEqual(await huellaDeCorreo(cambiado), ensayada, nombre);
  }
});

test("la clave de imagen que Zoho cambia en cada lectura no entra en la huella, y solo ella", async () => {
  const { correo } = correoDe();
  const c = correo.contenido!;
  const conImagen = (clave: string, ancho = "600") =>
    ({
      ...correo,
      contenido: {
        ...c,
        html: `<img width="${ancho}" src="https://crm.zoho.eu/crm/viewInLineImage?fileContent=${clave}">${c.html}`,
      },
    }) satisfies CorreoSaliente;

  // La misma plantilla leída dos veces: misma imagen, otra clave.
  const ensayada = await huellaDeCorreo(conImagen("26ca7abd0e9a6d77a09a24"));
  assert.equal(await huellaDeCorreo(conImagen("bb2342e6243e73b7600976")), ensayada);
  // Todo lo demás de la imagen sigue contando.
  assert.notEqual(await huellaDeCorreo(conImagen("26ca7abd0e9a6d77a09a24", "300")), ensayada);
  assert.notEqual(await huellaDeCorreo(correo), ensayada, "quitar la imagen cambia la huella");
  // Y no abre la mano con nada que no sea esa clave.
  assert.equal(sinClavesDeImagen('<a href="https://ejemplo.com/?fileContent=abc123">x</a>'), '<a href="https://ejemplo.com/?fileContent=abc123">x</a>');
  assert.equal(
    sinClavesDeImagen('src="https://crm.zoho.eu/crm/viewInLineImage?fileContent=ABCDEF0123&x=1"'),
    'src="https://crm.zoho.eu/crm/viewInLineImage?fileContent=*&x=1"',
  );
});

test("dos destinatarios distintos nunca comparten huella: cada uno lleva su identificador", async () => {
  const a = correoDe(entrada({ token: TOKEN })).correo;
  const b = correoDe(entrada({ token: OTRO })).correo;
  assert.notEqual(await huellaDeCorreo(a), await huellaDeCorreo(b));
});
