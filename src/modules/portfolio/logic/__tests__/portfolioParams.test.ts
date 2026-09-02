import assert from "node:assert/strict";
import { test } from "node:test";

import {
  buildPortfolioHref,
  gridClassForView,
  matchesQuery,
  sanitizeQuery,
  sanitizeSituacion,
  sanitizeTipo,
  sanitizeView,
} from "../portfolioParams";
import type { Proyecto } from "@/modules/portfolio/types";

function proyecto(overrides: Partial<Proyecto> = {}): Proyecto {
  return {
    id: 1,
    proyecto: "Málaga Centro",
    situacion: "En Marcha",
    tipo_proyecto: "Promoción",
    inversion_total: null,
    total_ingresos_venta: null,
    beneficios: null,
    unidades_totales: null,
    tir_desp_is: null,
    roe_desp_is: null,
    multiplo: null,
    project_irr: null,
    bcr: null,
    ubicacion: "Málaga",
    equity: null,
    entry_yield: null,
    exit_yield: null,
    credito_total: null,
    holding_period: null,
    superficie_edificable: null,
    es_ultima_fila: 1,
    fecha_inicio: null,
    fecha_fin: null,
    ...overrides,
  };
}

test("los filtros solo admiten valores del dominio", () => {
  assert.equal(sanitizeSituacion("En Marcha"), "En Marcha");
  assert.equal(sanitizeSituacion("Culminado"), "Culminado");
  assert.equal(sanitizeSituacion("inventado"), undefined);
  assert.equal(sanitizeSituacion(undefined), undefined);

  assert.equal(sanitizeTipo("Promoción"), "Promoción");
  assert.equal(sanitizeTipo("Fondo"), "Fondo");
  assert.equal(sanitizeTipo("otro"), undefined);
});

test("sanitizeView cae al modo por defecto ante cualquier basura", () => {
  assert.equal(sanitizeView("tabla"), "tabla");
  assert.equal(sanitizeView("cols4"), "cols4");
  assert.equal(sanitizeView("cols9"), "cols2");
  assert.equal(sanitizeView(undefined), "cols2");
});

test("sanitizeQuery recorta y acota la longitud", () => {
  assert.equal(sanitizeQuery("  hola  "), "hola");
  assert.equal(sanitizeQuery(undefined), "");
  assert.equal(sanitizeQuery("x".repeat(200)).length, 80);
});

test("buildPortfolioHref omite los valores por defecto", () => {
  assert.equal(buildPortfolioHref("/p", {}), "/p");
  assert.equal(buildPortfolioHref("/p", { view: "cols2" }), "/p", "cols2 es el defecto");
  assert.equal(buildPortfolioHref("/p", { sort: "inversion" }), "/p", "inversion es el defecto");
  assert.equal(buildPortfolioHref("/p", { q: "" }), "/p");
  assert.equal(buildPortfolioHref("/p", { view: "tabla" }), "/p?view=tabla");
  assert.equal(buildPortfolioHref("/p", { sort: "tir" }), "/p?sort=tir");
});

test("buildPortfolioHref serializa el crecimiento como porcentaje entero", () => {
  assert.equal(buildPortfolioHref("/p", { crecimiento: 0.1 }), "/p?crecimiento=10");
  assert.equal(buildPortfolioHref("/p", { crecimiento: 0 }), "/p?crecimiento=0");
});

test("matchesQuery ignora mayúsculas y acentos, y busca también en ubicación", () => {
  const p = proyecto();
  assert.equal(matchesQuery(p, "malaga"), true, "sin acentos");
  assert.equal(matchesQuery(p, "MÁLAGA"), true);
  assert.equal(matchesQuery(p, "centro"), true);
  assert.equal(matchesQuery(p, "  "), true, "una búsqueda vacía no filtra");
  assert.equal(matchesQuery(p, "sevilla"), false);
  assert.equal(matchesQuery(proyecto({ ubicacion: null }), "malaga"), true, "solo por nombre");
});

test("las clases de rejilla son literales estáticos que Tailwind puede ver", () => {
  // Si alguien las construye por interpolación, Tailwind v4 no las genera.
  for (const view of ["cols2", "cols3", "cols4"] as const) {
    assert.match(gridClassForView(view), /grid-cols-\d/);
  }
});
