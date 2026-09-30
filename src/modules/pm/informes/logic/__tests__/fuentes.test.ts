import assert from "node:assert/strict";
import { test } from "node:test";

import type { PmHitoEnriched, PmPortfolioRow } from "@/modules/pm/data/pmRepository";
import type { ActasActaViewData, ActasLogEntryItem } from "@/modules/pm/actas/types";
import type { PmAvanceProyecto } from "@/modules/pm/avance/types";

import { fechaEs, formatearActas, MAX_CARACTERES_ACTAS } from "../fuentes-actas";
import { formatearPlanificacion, snapshotDeComparacion } from "../fuentes-planificacion";
import { parseTrimestre } from "../trimestre";

function entrada(over: Partial<ActasLogEntryItem> = {}): ActasLogEntryItem {
  return {
    id: "e1",
    content: "Se firma el contrato de obra con Constructora X.",
    entryDate: "2026-07-15T10:00:00.000Z",
    deletedAt: null,
    statusBefore: null,
    statusAfter: null,
    authorId: "u1",
    source: "ui",
    editedAt: null,
    author: { userId: "u1", email: "pm@impar.es", label: "pm", initials: "PM" },
    ...over,
  };
}

function vista(entries: ActasLogEntryItem[]): ActasActaViewData {
  return {
    categories: [
      {
        id: "c1",
        name: "Obra",
        displayName: "Obra",
        masterGroupId: null,
        orderIndex: 0,
        entryCount: entries.length,
        elements: [
          { id: "el1", name: "Contratación de obra", depth: 0, orderIndex: 0, entryCount: entries.length, entries },
          { id: "el2", name: "Sin actividad", depth: 0, orderIndex: 1, entryCount: 0, entries: [] },
        ],
      },
    ],
    totalEntryCount: entries.length,
    availableCategories: [],
    availableAuthors: [],
  };
}

test("formatearActas agrupa por categoría y elemento con estados al inicio y al cierre", () => {
  const texto = formatearActas({
    proyecto: { code: "SE84", name: "Santa Engracia 84" },
    trimestre: "Q3 2026",
    desde: "2026-07-01",
    hasta: "2026-09-30",
    vista: vista([
      entrada(),
      entrada({
        id: "e2",
        content: "Obra adjudicada.",
        entryDate: "2026-08-02T09:00:00.000Z",
        statusBefore: "working_on_it",
        statusAfter: "done",
      }),
    ]),
    estadoInicio: [{ elementId: "el1", nombre: "Contratación de obra", categoriaId: "c1", estado: "working_on_it" }],
    estadoCierre: [
      { elementId: "el1", nombre: "Contratación de obra", categoriaId: "c1", estado: "done" },
      { elementId: "el3", nombre: "Licencia de primera ocupación", categoriaId: "c1", estado: "stuck" },
    ],
    categorias: { c1: "Obra" },
  });

  assert.match(texto, /### ACTAS DEL PROYECTO SE84 \(Santa Engracia 84\) · Q3 2026 \(01\/07\/2026–30\/09\/2026\)/);
  assert.match(texto, /2 anotaciones en 1 elementos; 1 elementos pasan a «Hecho»; 1 elementos bloqueados/);
  assert.match(texto, /## Obra\n- Contratación de obra \[estado En curso → Hecho\]/);
  assert.match(texto, /· 15\/07\/2026 \(pm\): Se firma el contrato/);
  assert.match(texto, /· 02\/08\/2026 \(pm\): Obra adjudicada\. \[En curso → Hecho\]/);
  assert.ok(!texto.includes("Sin actividad"), "los elementos sin anotaciones no salen");
  assert.match(texto, /## Elementos bloqueados al cierre del trimestre\n- Licencia de primera ocupación \(Obra\)/);
});

test("formatearActas recorta textos largos", () => {
  const muchas = Array.from({ length: 200 }, (_, i) =>
    entrada({ id: `e${i}`, content: "x".repeat(2_000) }),
  );
  const texto = formatearActas({
    proyecto: { code: "SE84", name: "SE84" },
    trimestre: "Q3 2026",
    desde: "2026-07-01",
    hasta: "2026-09-30",
    vista: vista(muchas),
    estadoInicio: [],
    estadoCierre: [],
    categorias: {},
  });
  assert.ok(texto.length <= MAX_CARACTERES_ACTAS + 200);
  assert.match(texto, /\[recortado\]/);
  assert.match(texto, /actas recortadas por longitud/);
});

function hito(over: Partial<PmHitoEnriched>): PmHitoEnriched {
  return {
    id: "h",
    activo_id: "a1",
    hito: "Hito",
    orden_hito: 1,
    fecha_actual: null,
    desviacion_vs_anterior_dias: null,
    desviacion_vs_levantamiento_dias: null,
    snapshots: {},
    ...over,
  };
}

test("formatearPlanificacion calcula desviaciones y cambio en el trimestre", () => {
  const row: PmPortfolioRow = {
    activo: { id: "a1", id_activo: "SE84", tipo_uso_activo: "APT", nombre_display: "Santa Engracia 84" },
    hitos: [
      hito({
        hito: "Fin de obra",
        orden_hito: 2,
        fecha_actual: "2027-03-31",
        snapshots: { levantamiento: "2027-01-31", "2026_Q2": "2027-02-28" },
      }),
      hito({
        hito: "Inicio de obra",
        orden_hito: 1,
        fecha_actual: "2026-08-01",
        snapshots: { levantamiento: "2026-08-01", "2026_Q2": "2026-08-01" },
      }),
    ],
  };
  const avance = (general: number, fase: number): PmAvanceProyecto =>
    ({
      general: { fase: { id: "g", nombre: "Avance general" }, porcentaje: general },
      fases: [{ fase: { id: "f1", nombre: "Estructura" }, porcentaje: fase }],
    }) as unknown as PmAvanceProyecto;

  const texto = formatearPlanificacion({
    row,
    trimestre: parseTrimestre("Q3 2026")!,
    hasta: "2026-09-30",
    avanceCierre: avance(35, 60),
    avanceCierreAnterior: avance(10, 20),
  });

  const lineas = texto.split("\n");
  const inicio = lineas.findIndex((l) => l.startsWith("| Inicio de obra"));
  const fin = lineas.findIndex((l) => l.startsWith("| Fin de obra"));
  assert.ok(inicio > 0 && fin > inicio, "los hitos salen por orden_hito");
  assert.equal(lineas[inicio], "| Inicio de obra | 01/08/2026 | 01/08/2026 | 01/08/2026 | 0 d | 0 d | hasta el cierre |");
  assert.equal(lineas[fin], "| Fin de obra | 31/03/2027 | 28/02/2027 | 31/01/2027 | +59 d | +31 d | después del cierre |");
  assert.match(texto, /1 hitos se retrasan y 0 se adelantan/);
  assert.match(texto, /Avance general: 10 % al cierre del Q2 2026 → 35 % al cierre del Q3 2026/);
  assert.match(texto, /\| Estructura \| 20 % \| 60 % \|/);
});

test("sin snapshot del trimestre anterior se compara con el último previo y se dice cuál", () => {
  const row: PmPortfolioRow = {
    activo: { id: "a1", id_activo: "SE84", tipo_uso_activo: "APT", nombre_display: null },
    hitos: [
      hito({
        hito: "Fin de obra",
        fecha_actual: "2026-06-30",
        snapshots: {
          levantamiento: "2025-07-31",
          "2025_Q4": "2026-03-31",
          "2026_Q1": "2026-05-31",
          "2027_Q1": "2026-06-30",
        },
      }),
    ],
  };
  assert.equal(snapshotDeComparacion(row, "2026_Q2"), "2026_Q1");
  const texto = formatearPlanificacion({
    row,
    trimestre: parseTrimestre("Q3 2026")!,
    hasta: "2026-09-30",
    avanceCierre: null,
    avanceCierreAnterior: null,
  });
  assert.ok(texto.includes("| Previsto en Q1 2026 |"));
  assert.ok(
    texto.includes("| Fin de obra | 30/06/2026 | 31/05/2026 | 31/07/2025 | +334 d | +30 d | hasta el cierre |"),
  );
  assert.ok(!texto.includes("AVANCE DE OBRA"));
});

test("un elemento sin estados en uso no lleva marca de estado", () => {
  const texto = formatearActas({
    proyecto: { code: "SE84", name: "SE84" },
    trimestre: "Q3 2026",
    desde: "2026-07-01",
    hasta: "2026-09-30",
    vista: vista([entrada()]),
    estadoInicio: [{ elementId: "el1", nombre: "x", categoriaId: "c1", estado: "not_started" }],
    estadoCierre: [{ elementId: "el1", nombre: "x", categoriaId: "c1", estado: "not_started" }],
    categorias: {},
  });
  assert.ok(texto.includes("\n- Contratación de obra\n"));
});

test("fechaEs", () => {
  assert.equal(fechaEs("2026-09-30"), "30/09/2026");
  assert.equal(fechaEs("2026-07-15T10:00:00Z"), "15/07/2026");
});
