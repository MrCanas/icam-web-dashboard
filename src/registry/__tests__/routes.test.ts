import assert from "node:assert/strict";
import { test } from "node:test";

import {
  isKnownRouteKey,
  routeKeyForPathname,
  zoneForRouteKey,
} from "@/registry/routes";

// Estos tests fijan el contrato del sistema de rutas, que es el más frágil de
// la app: el matching depende del ORDEN del array (primer match gana) y ya se
// ha parcheado dos veces con regex negativas. Si algo de esto cambia sin querer,
// un usuario acaba viendo lo que no debe. Ver docs/auditoria-2026-08.md §5.2.

test("las subpáginas de proyecto NO caen en pm.detalle (regex negativa)", () => {
  // pm.detalle va declarada antes que planificacion/actas/avance-obra; su match
  // las excluye a propósito. Si se rompe, el permiso de esas páginas se aplica mal.
  assert.equal(routeKeyForPathname("/dashboard/pm/proyecto/SE84"), "pm.detalle");
  assert.equal(routeKeyForPathname("/dashboard/pm/proyecto/SE84/planificacion"), "pm.planificacion");
  assert.equal(routeKeyForPathname("/dashboard/pm/proyecto/SE84/actas"), "pm.actas");
  assert.equal(routeKeyForPathname("/dashboard/pm/proyecto/SE84/avance-obra"), "pm.avance_obra");
});

test("monday.logs ya tiene su propia key (antes devolvía null)", () => {
  assert.equal(routeKeyForPathname("/dashboard/monday/logs"), "monday.logs");
});

test("una ruta fuera del registry devuelve null", () => {
  assert.equal(routeKeyForPathname("/dashboard/perfil"), null);
});

test("zoneForRouteKey mapea cada key a su zona", () => {
  assert.equal(zoneForRouteKey("pm.detalle"), "pm");
  assert.equal(zoneForRouteKey("pm.avance_obra"), "pm");
  assert.equal(zoneForRouteKey("monday.logs"), "adquisiciones");
  assert.equal(zoneForRouteKey("portfolio.executive"), "financiero");
  assert.equal(zoneForRouteKey("inexistente"), null);
});

test("isKnownRouteKey distingue keys vivas de huérfanas", () => {
  // Filtra los denies persistidos: una key renombrada deja denies huérfanos que
  // se descartan (y el permiso se abre). Este test evita perder de vista el caso.
  assert.equal(isKnownRouteKey("pm.detalle"), true);
  assert.equal(isKnownRouteKey("pm.overview"), false); // renombrada a portfolio.pm_overview
});
