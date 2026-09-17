import assert from "node:assert/strict";
import { test } from "node:test";

import {
  construirAvanceActa,
  fmtDelta,
  porcentajeAFecha,
  type CambioAvance,
} from "../avance-a-fecha";
import type { PmAvanceFase, PmAvanceFaseValor } from "../../types";

const t = (iso: string) => new Date(iso).getTime();

const cambios: CambioAvance[] = [
  // Desordenados a propósito: la función no puede fiarse del orden.
  { fase_id: "A", porcentaje_anterior: 20, porcentaje_nuevo: 35, cambiado_at: "2026-03-10T09:00:00Z" },
  { fase_id: "A", porcentaje_anterior: 10, porcentaje_nuevo: 20, cambiado_at: "2026-02-01T09:00:00Z" },
  { fase_id: "A", porcentaje_anterior: 35, porcentaje_nuevo: 40, cambiado_at: "2026-03-10T18:00:00Z" },
  { fase_id: "B", porcentaje_anterior: null, porcentaje_nuevo: 0, cambiado_at: "2026-02-15T09:00:00Z" },
];

test("porcentajeAFecha: sin cambios devuelve el vigente", () => {
  assert.equal(porcentajeAFecha(cambios, "C", t("2026-01-01T00:00:00Z"), 55), 55);
  assert.equal(porcentajeAFecha(cambios, "C", t("2026-01-01T00:00:00Z"), null), null);
});

test("porcentajeAFecha: antes del primer cambio, el anterior de ese cambio", () => {
  assert.equal(porcentajeAFecha(cambios, "A", t("2026-01-15T00:00:00Z"), 40), 10);
});

test("porcentajeAFecha: entre cambios, el nuevo del último hasta el corte", () => {
  assert.equal(porcentajeAFecha(cambios, "A", t("2026-03-01T00:00:00Z"), 40), 20);
});

test("porcentajeAFecha: varios cambios el mismo día cuenta el último", () => {
  assert.equal(porcentajeAFecha(cambios, "A", t("2026-03-10T23:59:59Z"), 40), 40);
  assert.equal(porcentajeAFecha(cambios, "A", t("2026-03-10T12:00:00Z"), 40), 35);
});

test("porcentajeAFecha: el corte es inclusivo", () => {
  assert.equal(porcentajeAFecha(cambios, "A", t("2026-02-01T09:00:00Z"), 40), 20);
});

test("porcentajeAFecha: NULL y 0 no se confunden", () => {
  assert.equal(porcentajeAFecha(cambios, "B", t("2026-02-01T00:00:00Z"), 0), null);
  assert.equal(porcentajeAFecha(cambios, "B", t("2026-02-20T00:00:00Z"), 0), 0);
});

function valor(id: string, porcentaje: number | null, esGeneral = false): PmAvanceFaseValor {
  const fase: PmAvanceFase = {
    id,
    nombre: `Fase ${id}`,
    orden: 1,
    es_general: esGeneral,
    zoho_columna: null,
    zoho_api_name: null,
    activo: true,
  };
  return { fase, porcentaje, porcentajeZoho: porcentaje, origen: "app", pendiente: false };
}

test("construirAvanceActa: desde, hasta y delta por fase", () => {
  const acta = construirAvanceActa(
    { general: valor("C", 5, true), fases: [valor("A", 40), valor("B", 0)] },
    cambios,
    { desde: t("2026-01-31T23:59:59Z"), hasta: t("2026-03-10T23:59:59Z") },
  );
  assert.deepEqual(acta.general, { faseId: "C", nombre: "Fase C", desde: 5, hasta: 5, delta: 0 });
  assert.deepEqual(acta.fases[0], { faseId: "A", nombre: "Fase A", desde: 10, hasta: 40, delta: 30 });
  assert.deepEqual(acta.fases[1], { faseId: "B", nombre: "Fase B", desde: null, hasta: 0, delta: null });
});

test("fmtDelta", () => {
  assert.equal(fmtDelta(null), "—");
  assert.equal(fmtDelta(0), "=");
  assert.equal(fmtDelta(12.5), "+12,5 pp");
  assert.equal(fmtDelta(-3), "−3 pp");
});
