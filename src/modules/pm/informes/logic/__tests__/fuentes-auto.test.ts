import assert from "node:assert/strict";
import { test } from "node:test";

import { ORDEN_AUTO, previoPorDefecto, respuestaAuto } from "@/modules/pm/informes/logic/fuentes-auto";
import { rutaActasTrimestre, rutaPlanificacionProyecto } from "@/modules/pm/informes/logic/paths";
import { compararTrimestres } from "@/modules/pm/informes/logic/trimestre";
import type { Fuente, PrevioCandidato } from "@/modules/pm/informes/types";

function fuente(over: Partial<Fuente>): Fuente {
  return { id: 1, tipo: "documento", nombre: "doc", texto: "x", auto: false, orden: 100, incluida: true, actualizado: "2026-10-01T00:00:00Z", ...over };
}

function candidato(trimestre: string): PrevioCandidato {
  return { id: `SE84_${trimestre.replace(" ", "-")}`, trimestre, estado: "aprobado", version: 1, slides: 24, actualizado: "2026-07-01T00:00:00Z" };
}

test("respuestaAuto: incluida es sí, quitada es no y sin fuente del portal la pregunta sigue abierta", () => {
  const fuentes = [
    fuente({ id: 1, tipo: "actas", auto: true, incluida: true }),
    fuente({ id: 2, tipo: "planificacion", auto: true, incluida: false }),
  ];
  assert.equal(respuestaAuto(fuentes, "actas"), true);
  assert.equal(respuestaAuto(fuentes, "planificacion"), false);
  assert.equal(respuestaAuto([], "actas"), null);
  // Unas actas subidas a mano no responden a la pregunta.
  assert.equal(respuestaAuto([fuente({ tipo: "actas", auto: false })], "actas"), null);
  assert.ok(ORDEN_AUTO.planificacion < ORDEN_AUTO.actas);
});

test("previoPorDefecto: el elegido, el del trimestre anterior o el más reciente", () => {
  const candidatos = [candidato("Q2 2026"), candidato("Q1 2026"), candidato("Q4 2025")];
  assert.equal(previoPorDefecto(candidatos, null, "Q2 2026"), "SE84_Q2-2026");
  assert.equal(previoPorDefecto(candidatos, { tipo: "estructurado", id: "SE84_Q1-2026" }, "Q2 2026"), "SE84_Q1-2026");
  // El elegido ya no existe: vuelve al del trimestre anterior.
  assert.equal(previoPorDefecto(candidatos, { tipo: "estructurado", id: "SE84_Q3-2025" }, "Q2 2026"), "SE84_Q2-2026");
  // Sin informe del trimestre anterior en el portal: el más reciente.
  assert.equal(previoPorDefecto(candidatos.slice(1), { tipo: "ninguno" }, "Q2 2026"), "SE84_Q1-2026");
  assert.equal(previoPorDefecto([], null, "Q2 2026"), null);
});

test("compararTrimestres ordena por año y trimestre", () => {
  assert.ok(compararTrimestres("Q4 2025", "Q1 2026") < 0);
  assert.ok(compararTrimestres("Q3 2026", "Q2 2026") > 0);
  assert.equal(compararTrimestres("Q3 2026", "Q3 2026"), 0);
  assert.deepEqual(["Q1 2026", "Q4 2025", "Q2 2026"].sort(compararTrimestres), ["Q4 2025", "Q1 2026", "Q2 2026"]);
});

test("rutas del proyecto: las actas del trimestre natural completo y la planificación", () => {
  assert.equal(rutaActasTrimestre("CA1", "Q3 2026"), "/dashboard/pm/proyecto/CA1/actas?tab=acta&range=custom&from=2026-07-01&to=2026-09-30");
  assert.equal(rutaActasTrimestre("CSP 10", "Q1 2027"), "/dashboard/pm/proyecto/CSP%2010/actas?tab=acta&range=custom&from=2027-01-01&to=2027-03-31");
  assert.equal(rutaPlanificacionProyecto("CA1"), "/dashboard/pm/proyecto/CA1/planificacion");
});
