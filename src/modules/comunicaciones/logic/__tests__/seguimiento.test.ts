import assert from "node:assert/strict";
import { test } from "node:test";

import { dominioDe, esEmailValido, posibleErrata } from "../direcciones";
import {
  baseDeSeguimientoValida,
  enlacesDe,
  esAgenteAutomatico,
  esLecturaAutomatica,
  instrumentar,
  instrumentarParaVistaPrevia,
  TOKEN_RE,
  urlDeApertura,
  urlDeEnlace,
} from "../seguimiento";

// El seguimiento toca el correo que le llega a un inversor. Lo que se fija aquí
// es que solo cambia lo que tiene que cambiar, y que cada correo lleva lo suyo.

const BASE = "https://go.imparcapital.com";
const TOKEN = "AAAAAAAAAAAAAAAAAAAAAA";
const OTRO = "BBBBBBBBBBBBBBBBBBBBBB";

test("el identificador tiene 22 caracteres de base64url y nada más", () => {
  assert.ok(TOKEN_RE.test(TOKEN));
  assert.ok(TOKEN_RE.test("a1B2c3D4e5F6g7H8i9J0_-"));
  for (const malo of ["", "corto", `${TOKEN}A`, "AAAAAAAAAAAAAAAAAAAAA/", "../../../../etc/passwd..", "AAAAAAAAAAA AAAAAAAAAA"]) {
    assert.equal(TOKEN_RE.test(malo), false, malo);
  }
});

test("las direcciones de seguimiento llevan el identificador y, los enlaces, su posición", () => {
  assert.equal(urlDeApertura(`${BASE}/`, TOKEN, "pixel"), `${BASE}/api/s/a/${TOKEN}`);
  assert.equal(urlDeApertura(BASE, TOKEN, "logo"), `${BASE}/api/s/a/${TOKEN}?v=logo`);
  assert.equal(urlDeEnlace(BASE, TOKEN, 3), `${BASE}/api/s/e/${TOKEN}/3`);
});

test("la base de seguimiento tiene que ser https y sin ruta; http solo en local", () => {
  assert.ok(baseDeSeguimientoValida("https://go.imparcapital.com"));
  assert.ok(baseDeSeguimientoValida("https://go.imparcapital.com/"));
  assert.ok(baseDeSeguimientoValida("http://localhost:3100"));
  for (const mala of [undefined, null, "", "go.imparcapital.com", "http://go.imparcapital.com", "https://go.imparcapital.com/ruta", "https://go.imparcapital.com/?a=1", "https://u:p@go.imparcapital.com", "javascript:alert(1)"]) {
    assert.equal(baseDeSeguimientoValida(mala), false, String(mala));
  }
});

const HTML =
  `<html><body><p>Hola</p>` +
  `<a href="https://www.youtube.com/@imparcapital/videos" style="color:red">Vídeos</a>` +
  `<a href='https://ejemplo.com/doc?a=1&amp;b=2'><b>Documento</b></a>` +
  `<a href="mailto:inversores@imparcapital.com">Escríbenos</a>` +
  `<a href="tel:+34910000000">Llámanos</a><a href="#arriba">Arriba</a>` +
  `<img src="https://crm.zoho.eu/crm/viewInLineImage?fileContent=abc">` +
  `</body></html>`;

test("solo se cuentan y se cambian los enlaces http(s): mailto, tel y anclas no se tocan", () => {
  assert.deepEqual(
    enlacesDe(HTML).map((e) => [e.posicion, e.url, e.texto]),
    [
      [0, "https://www.youtube.com/@imparcapital/videos", "Vídeos"],
      [1, "https://ejemplo.com/doc?a=1&b=2", "Documento"],
    ],
  );
  const r = instrumentar(HTML, BASE, TOKEN);
  assert.deepEqual(r.enlaces, ["https://www.youtube.com/@imparcapital/videos", "https://ejemplo.com/doc?a=1&b=2"]);
  assert.ok(r.html.includes(`href="${BASE}/api/s/e/${TOKEN}/0" style="color:red">Vídeos</a>`));
  assert.ok(r.html.includes(`href='${BASE}/api/s/e/${TOKEN}/1'><b>Documento</b></a>`));
  assert.ok(r.html.includes(`<a href="mailto:inversores@imparcapital.com">Escríbenos</a>`));
  assert.ok(r.html.includes(`<a href="tel:+34910000000">Llámanos</a>`));
  assert.ok(r.html.includes(`<a href="#arriba">Arriba</a>`));
  // El destino de verdad ya no aparece en el correo: está guardado aparte.
  assert.equal(r.html.includes("youtube.com"), false);
});

test("un botón de Zoho es un enlace dentro de otro: los dos se cuentan y los dos se rastrean", () => {
  // Así construye Zoho sus botones: `buttonOuterLink` envolviendo una tabla que
  // lleva dentro `buttonInnerLink`, los dos al mismo destino. La plantilla
  // ZU5 del 2026-10-07 no pasaba la validación porque el interior quedaba sin
  // rastrear.
  const destino = "https://inversion.imparcapital.es/link/validando-invitacion/f8ffa6bf";
  const boton =
    `<html><body><img src="x.png">` +
    `<a class="buttonOuterLink" href="${destino}" style="text-decoration:none;" target="_blank">\n` +
    `<table><tbody><tr><td><p>\n` +
    `<a class="buttonInnerLink" href="${destino}" style="color:#fff" target="_blank">Documentación</a>\n` +
    `</p></td></tr></tbody></table></a>` +
    `<a href="https://ejemplo.com/otro">Otro</a>` +
    `</body></html>`;
  assert.deepEqual(
    enlacesDe(boton).map((e) => [e.posicion, e.url, e.texto]),
    [
      [0, destino, "Documentación"],
      [1, destino, "Documentación"],
      [2, "https://ejemplo.com/otro", "Otro"],
    ],
  );
  const r = instrumentar(boton, BASE, TOKEN);
  assert.deepEqual(r.enlaces, [destino, destino, "https://ejemplo.com/otro"]);
  assert.ok(r.html.includes(`<a class="buttonOuterLink" href="${BASE}/api/s/e/${TOKEN}/0" style="text-decoration:none;" target="_blank">`));
  assert.ok(r.html.includes(`<a class="buttonInnerLink" href="${BASE}/api/s/e/${TOKEN}/1" style="color:#fff" target="_blank">Documentación</a>`));
  assert.ok(r.html.includes(`<a href="${BASE}/api/s/e/${TOKEN}/2">Otro</a>`));
  // Ni un href sin rastrear: es lo que comprueba después `validarCorreo`.
  assert.equal(r.html.includes(destino), false);
  assert.equal((r.html.match(/<a\b/g) ?? []).length, 3);
  assert.equal((r.html.match(/<\/a\s*>/g) ?? []).length, 3);
});

test("si el correo ya trae imágenes se añade una invisible, y las suyas no se tocan", () => {
  const r = instrumentar(HTML, BASE, TOKEN);
  assert.equal(r.imagen, "pixel");
  assert.ok(r.html.includes(`<img src="https://crm.zoho.eu/crm/viewInLineImage?fileContent=abc">`));
  assert.equal((r.html.match(new RegExp(`${BASE}/api/s/a/${TOKEN}"`, "g")) ?? []).length, 1);
  assert.ok(r.html.includes(`width="1" height="1"`));
  assert.ok(r.html.endsWith("</body></html>"), "la imagen va dentro del body");
});

test("un enlace que envuelve una imagen se nombra por la imagen, no queda sin nombre", () => {
  const html =
    `<a href="https://ejemplo.com/a"><img src="x.png" alt="Ver vídeos &amp; fotos"></a>` +
    `<a href="https://ejemplo.com/b"><img src="y.png"></a>` +
    `<a href="https://ejemplo.com/c"><img src="z.png" alt="icono"> Con texto</a>` +
    `<a href="https://ejemplo.com/d"></a>`;
  assert.deepEqual(
    enlacesDe(html).map((e) => e.texto),
    ["Imagen: Ver vídeos & fotos", "(imagen)", "Con texto", ""],
  );
});

test("si el correo no trae ninguna imagen se le añade el logotipo, a la vista", () => {
  const sinImagen = `<html><body><p>Solo texto</p><a href="https://ejemplo.com">x</a></body></html>`;
  const r = instrumentar(sinImagen, BASE, TOKEN);
  assert.equal(r.imagen, "logo");
  assert.ok(r.html.includes(`${BASE}/api/s/a/${TOKEN}?v=logo`));
  assert.ok(r.html.includes(`alt="Impar Capital"`));
  assert.equal(r.html.includes(`width="1" height="1"`), false);
  assert.equal((r.html.match(/<img\b/g) ?? []).length, 1);
});

test("un HTML sin body ni html también queda instrumentado", () => {
  const r = instrumentar(`<p>Hola</p>`, BASE, TOKEN);
  assert.ok(r.html.startsWith("<p>Hola</p>"));
  assert.ok(r.html.includes(`${BASE}/api/s/a/${TOKEN}`));
});

test("la misma plantilla enviada dos veces lleva identificadores distintos en todo", () => {
  const a = instrumentar(HTML, BASE, TOKEN);
  const b = instrumentar(HTML, BASE, OTRO);
  assert.notEqual(a.html, b.html);
  assert.equal(a.html.includes(OTRO), false);
  assert.equal(b.html.includes(TOKEN), false);
  // Mismos destinos, distinto seguimiento.
  assert.deepEqual(a.enlaces, b.enlaces);
});

test("la vista previa no lleva ningún identificador ni cambia los enlaces", () => {
  const conImagen = instrumentarParaVistaPrevia(HTML);
  assert.equal(conImagen.html, HTML);
  const sinImagen = instrumentarParaVistaPrevia(`<html><body><a href="https://ejemplo.com">x</a></body></html>`);
  assert.equal(sinImagen.imagen, "logo");
  assert.ok(sinImagen.html.includes(`href="https://ejemplo.com"`));
  assert.equal(sinImagen.html.includes("/api/s/"), false);
});

test("los filtros de correo y los robots no son una persona; los proxies de Gmail y Apple sí cuentan", () => {
  for (const automatico of [
    "",
    null,
    "Mozilla/5.0 (compatible; Googlebot/2.1)",
    "python-requests/2.31",
    "curl/8.4.0",
    "Barracuda Sentinel (EE)",
    "Mozilla/5.0 Proofpoint URL Defense",
    "Mimecast-URL-Protect",
    "Mozilla/5.0 (X11) HeadlessChrome/120",
  ]) {
    assert.equal(esAgenteAutomatico(automatico), true, String(automatico));
  }
  for (const persona of [
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36",
    "Mozilla/5.0 (Windows NT 5.1; rv:11.0) Gecko Firefox/11.0 (via ggpht.com GoogleImageProxy)",
    "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148",
    "Microsoft Office/16.0 (Windows NT 10.0; Microsoft Outlook 16.0)",
  ]) {
    assert.equal(esAgenteAutomatico(persona), false, persona);
  }
  assert.equal(esLecturaAutomatica("HEAD", "Mozilla/5.0 Chrome/120"), true);
  assert.equal(esLecturaAutomatica("GET", "Mozilla/5.0 Chrome/120"), false);
});

// ---------------------------------------------------------------------------
// Direcciones
// ---------------------------------------------------------------------------

test("una dirección bien escrita pasa; las raras no", () => {
  for (const buena of ["javiercanas@imparcapital.com", "j.canas+test@impar-capital.co.uk", "A_B%c@Sub.Dominio.es", " ana@ejemplo.com "]) {
    assert.equal(esEmailValido(buena), true, buena);
  }
  for (const mala of [
    "",
    "sinarroba.com",
    "dos@@ejemplo.com",
    "a@b@c.com",
    "espacio en@ejemplo.com",
    "ana@ejemplo",
    "ana@.com",
    "ana@ejemplo..com",
    "ana..b@ejemplo.com",
    ".ana@ejemplo.com",
    "ana.@ejemplo.com",
    "ana@-ejemplo.com",
    "ana@ejemplo.c",
    "ana@ejemplo.com,luis@ejemplo.com",
    "ana@ejemplo.com;",
    "<ana@ejemplo.com>",
    "ana@ejemplo.com\nbcc:otro@ejemplo.com",
  ]) {
    assert.equal(esEmailValido(mala), false, JSON.stringify(mala));
  }
});

test("las erratas de dominio conocidas se señalan, y los dominios buenos no", () => {
  assert.equal(posibleErrata("ana@gmial.com"), "gmail.com");
  assert.equal(posibleErrata("ana@hotmal.com"), "hotmail.com");
  assert.equal(posibleErrata("ANA@GMAIL.CON"), "gmail.com");
  assert.equal(posibleErrata("ana@gmail.com"), null);
  assert.equal(posibleErrata("ana@imparcapital.com"), null);
  assert.equal(dominioDe(" Ana@Ejemplo.COM "), "ejemplo.com");
});
