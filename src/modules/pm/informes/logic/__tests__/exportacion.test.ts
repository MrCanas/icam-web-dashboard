import assert from "node:assert/strict";
import { test } from "node:test";

import { incidenciasExportacion, resumenIncidencias } from "@/modules/pm/informes/logic/exportacion";
import type { SlideJson } from "@/modules/pm/informes/slides/tipos";

const periodo = { trimestre: "Q3 2026", trimestreAnterior: "Q2 2026", siguiente: "Q4 2026" };

test("validador de exportación: reúne revisión, coherencia, Finanzas pendiente y huecos de imagen", () => {
  const slides: SlideJson[] = [
    { id: "portada", c: "Portada", props: { trimestre: "Q3 2026", proyecto: "SE84" } },
    { id: "obra-1", compuesto: { contenido: [{ c: "Galeria", props: { disposicion: "2", imagenes: [{ src: "/api/informes/fotos/a" }] } }] } },
    { id: "varianzas", c: "SlideBloqueado", props: { titulo: "Varianzas", estado: "Pendiente de Finanzas" } },
    { id: "oculta", oculto: true, c: "SlideBloqueado", props: { titulo: "Oculta" } },
    { id: "disclaimer", c: "Disclaimer" },
  ];
  const inc = incidenciasExportacion(slides, { "obra-1": { desborde: true } }, periodo, [
    { slide: "obra-1", problema: "La fecha de entrega no coincide con el calendario", sugerencia: "revisar la slide 5" },
    { slide: "oculta", problema: "no debe salir" },
  ]);
  const textos = inc.map((x) => `${x.nivel}:${x.slide}:${x.texto}`);
  assert.ok(textos.includes("error:obra-1:El contenido desborda la slide."));
  assert.ok(textos.some((t) => t.startsWith("aviso:obra-1:Incoherencia señalada en la revisión: La fecha de entrega no coincide con el calendario (revisar la slide 5)")));
  assert.ok(textos.some((t) => t.startsWith("aviso:varianzas:«Varianzas»: la página de Finanzas no se ha aportado")));
  assert.ok(textos.includes("aviso:portada:1 hueco(s) de imagen sin foto: saldría el recuadro «Foto aportada por el PM»."));
  assert.ok(textos.includes("aviso:obra-1:1 hueco(s) de imagen sin foto: saldría el recuadro «Foto aportada por el PM»."));
  assert.ok(!textos.some((t) => t.includes(":oculta:")));
  assert.equal(resumenIncidencias(inc), `${inc.length} incidencias (1 bloqueante)`);

  const limpias: SlideJson[] = [
    { id: "portada", c: "Portada", props: { trimestre: "Q3 2026", proyecto: "SE84", imagen: "/api/informes/fotos/p" } },
    { id: "varianzas", c: "SlideBloqueado", props: { titulo: "Varianzas", estado: "Aportado", vista: "/api/informes/fotos/v" } },
    { id: "disclaimer", c: "Disclaimer" },
  ];
  assert.deepEqual(incidenciasExportacion(limpias, { varianzas: { relleno: 100 } }, periodo), []);
  assert.equal(resumenIncidencias([]), "sin incidencias");
});
