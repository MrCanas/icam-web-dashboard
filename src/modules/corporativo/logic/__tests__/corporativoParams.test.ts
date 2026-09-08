import assert from "node:assert/strict";
import { test } from "node:test";

import {
  buildCorporativoHref,
  sanitizeDesde,
  sanitizeGranularidad,
  sanitizePrevision,
  sanitizeSociedad,
  tipoPeriodoDe,
} from "../corporativoParams";

/**
 * Los filtros del tab viajan en la query string, así que llegan como texto
 * arbitrario: cualquiera puede escribir `?sociedad=loquesea` en la barra. Lo que
 * se comprueba aquí es que nada de lo que salga de estos saneadores pueda llegar
 * a una consulta sin pertenecer al vocabulario del maestro.
 */

test("sanitizeSociedad solo admite las tres del maestro", () => {
  assert.equal(sanitizeSociedad("GIIC"), "GIIC");
  assert.equal(sanitizeSociedad("ICI+ICAM"), "ICI+ICAM");
  assert.equal(sanitizeSociedad("GRUPO"), "GRUPO");
  // Cualquier otra cosa cae al valor por defecto en vez de propagarse.
  assert.equal(sanitizeSociedad("ICAM"), "GRUPO");
  assert.equal(sanitizeSociedad("'; drop table corp_periodos; --"), "GRUPO");
  assert.equal(sanitizeSociedad(undefined), "GRUPO");
});

test("sanitizeGranularidad cae a trimestre ante cualquier cosa rara", () => {
  assert.equal(sanitizeGranularidad("anio"), "anio");
  assert.equal(sanitizeGranularidad("trimestre"), "trimestre");
  assert.equal(sanitizeGranularidad("mensual"), "trimestre");
  assert.equal(sanitizeGranularidad(undefined), "trimestre");
});

test("tipoPeriodoDe traduce al vocabulario de la tabla", () => {
  assert.equal(tipoPeriodoDe("trimestre"), "TRIMESTRE");
  assert.equal(tipoPeriodoDe("anio"), "AÑO");
});

test("sanitizeDesde acepta años del rango y descarta el resto", () => {
  assert.equal(sanitizeDesde("2024"), 2024);
  assert.equal(sanitizeDesde("2026"), 2026);
  // 2021 es el principio del maestro: recortar ahí es no recortar.
  assert.equal(sanitizeDesde("2021"), undefined);
  assert.equal(sanitizeDesde("1999"), undefined);
  assert.equal(sanitizeDesde("2024.5"), undefined);
  assert.equal(sanitizeDesde("hola"), undefined);
  assert.equal(sanitizeDesde(undefined), undefined);
});

test("la previsión se muestra salvo que se pida apagarla explícitamente", () => {
  assert.equal(sanitizePrevision(undefined), true);
  assert.equal(sanitizePrevision("1"), true);
  assert.equal(sanitizePrevision("0"), false);
});

test("el href omite todo lo que ya es el valor por defecto", () => {
  // La URL limpia tiene que ser la del estado sin filtrar, para que compartir
  // «el tab» y compartir «el tab con filtros» se distingan de un vistazo.
  assert.equal(
    buildCorporativoHref("/dashboard/corporativo", {
      sociedad: "GRUPO",
      granularidad: "trimestre",
      desde: undefined,
      prevision: true,
    }),
    "/dashboard/corporativo",
  );
});

test("el href escribe solo lo que se aparta del valor por defecto", () => {
  assert.equal(
    buildCorporativoHref("/dashboard/corporativo", { sociedad: "GIIC", prevision: true }),
    "/dashboard/corporativo?sociedad=GIIC",
  );
  assert.equal(
    buildCorporativoHref("/dashboard/corporativo/detalle", {
      sociedad: "ICI+ICAM",
      granularidad: "anio",
      desde: 2024,
      prevision: false,
    }),
    "/dashboard/corporativo/detalle?sociedad=ICI%2BICAM&granularidad=anio&desde=2024&prevision=0",
  );
});

test("el href sobrevive al viaje de ida y vuelta", () => {
  const href = buildCorporativoHref("/dashboard/corporativo", {
    sociedad: "ICI+ICAM",
    granularidad: "anio",
    desde: 2025,
    prevision: false,
  });
  const q = new URL(href, "https://ejemplo.test").searchParams;

  // El «+» de ICI+ICAM es el caso que rompería una serialización ingenua:
  // sin codificar, se leería como un espacio al volver.
  assert.equal(sanitizeSociedad(q.get("sociedad") ?? undefined), "ICI+ICAM");
  assert.equal(sanitizeGranularidad(q.get("granularidad") ?? undefined), "anio");
  assert.equal(sanitizeDesde(q.get("desde") ?? undefined), 2025);
  assert.equal(sanitizePrevision(q.get("prevision") ?? undefined), false);
});
