import assert from "node:assert/strict";
import { test } from "node:test";

import {
  actualizarPeriodo,
  normalizarEstructura,
  ordenar,
  qaMecanico,
  renumerar,
  slideDeterminista,
  validarSlide,
} from "@/modules/pm/informes/logic/informe";
import { idInforme, qAnt, qSig, trimestrePorDefecto } from "@/modules/pm/informes/logic/trimestre";
import type { SlideJson } from "@/modules/pm/informes/slides/tipos";

const periodo = { trimestre: "Q3 2026", trimestreAnterior: "Q2 2026", siguiente: "Q4 2026" };

test("trimestres: anterior, siguiente, id y el que se informa por defecto", () => {
  assert.equal(qSig("Q4 2026"), "Q1 2027");
  assert.equal(qAnt("Q1 2027"), "Q4 2026");
  assert.equal(idInforme("SE84", "Q3 2026"), "SE84_Q3-2026");
  // Último mes del trimestre: el que está cerrando. Primer mes: el que acaba de cerrar.
  assert.equal(trimestrePorDefecto(new Date(2026, 8, 30)), "Q3 2026");
  assert.equal(trimestrePorDefecto(new Date(2026, 9, 10)), "Q3 2026");
  assert.equal(trimestrePorDefecto(new Date(2026, 10, 10)), "Q3 2026");
});

test("normalizarEstructura: sin repetidos, con obligatorias y con todo el informe anterior", () => {
  const est = normalizarEstructura(
    [
      { id: "calendario", accion: "actualizar" },
      { id: "calendario", accion: "ocultar" },
      { id: "obra-1", accion: "rara" },
    ],
    { id: "X", version: 1, meta: { proyecto: "", codigo: "", trimestre: "" }, slides: [{ id: "consejo", oculto: true }] },
  );
  assert.deepEqual(
    est.map((e) => [e.id, e.accion]),
    [
      ["portada", "nueva"],
      ["indice", "nueva"],
      ["resumen-ejecutivo", "nueva"],
      ["calendario", "actualizar"],
      ["obra-1", "actualizar"],
      ["consejo", "ocultar"],
      ["disclaimer", "mantener"],
      ["cierre", "mantener"],
    ],
  );
});

test("ordenar y renumerar: secciones por su posición e índice rehecho", () => {
  const slides: SlideJson[] = ordenar([
    { id: "cierre", c: "Cierre" },
    { id: "colaboradores", c: "Colaboradores", props: {} },
    { id: "portada", c: "Portada" },
    { id: "obra-1", compuesto: { titulo: "Obra" } },
    { id: "indice", c: "Indice" },
    { id: "resumen-ejecutivo", c: "ResumenEjecutivo", props: {} },
    { id: "disclaimer", c: "Disclaimer" },
  ]);
  renumerar(slides);
  assert.deepEqual(
    slides.map((s) => s.id),
    ["portada", "indice", "resumen-ejecutivo", "obra-1", "colaboradores", "disclaimer", "cierre"],
  );
  assert.equal(slides[3]!.compuesto!.seccion, 2);
  assert.equal((slides[4]!.props as { seccion: number }).seccion, 3);
  assert.deepEqual((slides[1]!.props as { secciones: string[] }).secciones, ["Resumen Ejecutivo", "Obra", "Colaboradores"]);
});

test("actualizarPeriodo fija trimestre y siguiente, salvo en «anterior»", () => {
  const s = actualizarPeriodo(
    {
      id: "calendario",
      props: {
        titulo: "Calendario. Q2 2026",
        trimestre: "Q2 2026",
        siguiente: "Q3 2026",
        anterior: { trimestre: "Q1 2026" },
      },
    },
    periodo,
  );
  assert.deepEqual(s.props, { titulo: "Calendario. Q3 2026", trimestre: "Q3 2026", siguiente: "Q4 2026", anterior: { trimestre: "Q1 2026" } });
});

test("validarSlide: acepta {slide}, fija el id y rechaza componentes y rutas inventadas", () => {
  const permitidos = ["DosColumnas", "Texto", "div"];
  const s = validarSlide({ slide: { id: "otro", c: "DosColumnas", props: { izquierda: { c: "Texto" } } } }, "calendario", permitidos);
  assert.equal(s.id, "calendario");
  assert.throws(() => validarSlide({ c: "DosColumnas", props: { izquierda: { c: "Inventado" } } }, "x", permitidos), /Inventado/);
  assert.throws(() => validarSlide({ c: "DosColumnas", props: { src: "fotos/a.jpg" } }, "x", permitidos), /ruta de foto/);
  assert.throws(() => validarSlide([1, 2], "x", permitidos), /no es un slide/);
});

test("slides deterministas: portada con su foto, financieras bloqueadas y las mantenidas con su periodo", () => {
  const url = (id: string) => `/api/informes/fotos/${id}`;
  const fotos = [
    { id: "f1", categoria: "Portada" as const, para: null, pie: null, nombre: null, ancho: 10, alto: 5 },
    { id: "f2", categoria: "Página de Finanzas" as const, para: "varianzas", pie: null, nombre: null, ancho: 10, alto: 5 },
  ];
  const d = { ...periodo, proyecto: "Santa Engracia 84" };
  assert.equal((slideDeterminista({ id: "portada", accion: "actualizar" }, { id: "portada" }, d, fotos, url)!.props as { imagen: string }).imagen, "/api/informes/fotos/f1");
  const v = slideDeterminista({ id: "varianzas", accion: "actualizar" }, { id: "varianzas" }, d, fotos, url)!;
  assert.equal(v.c, "SlideBloqueado");
  assert.equal((v.props as { estado: string }).estado, "Aportado");
  const r = slideDeterminista({ id: "resumen-financiero", accion: "actualizar" }, { id: "resumen-financiero" }, d, fotos, url)!;
  assert.equal((r.props as { estado: string }).estado, "Pendiente de Finanzas");
  const m = slideDeterminista({ id: "colaboradores", accion: "mantener" }, { id: "colaboradores", c: "Colaboradores", props: { titulo: "Colaboradores Q2 2026" } }, d, fotos, url)!;
  assert.equal(m.origen, "heredada");
  assert.equal(slideDeterminista({ id: "calendario", accion: "actualizar" }, { id: "calendario" }, d, fotos, url), null);
});

test("QA mecánico: bloquea desbordes, pendientes, trimestres mal y falta de disclaimer", () => {
  const slides: SlideJson[] = [
    { id: "calendario", c: "DosColumnas", props: { trimestre: "Q2 2026" } },
    { id: "kpis", c: "SlideKpisRiesgosObjetivos", props: { siguiente: "Q4 2026", anterior: { trimestre: "Q2 2026" } } },
    { id: "obra", compuesto: {} },
  ];
  const qa = qaMecanico(slides, { calendario: { pendientes: 2 }, obra: { desborde: true }, kpis: { relleno: 70 } }, periodo);
  const textos = qa.map((x) => `${x.nivel}:${x.slide}:${x.texto}`);
  assert.ok(textos.includes("error::Falta el Disclaimer."));
  assert.ok(textos.includes("error:calendario:2 dato(s) [pendiente] sin resolver."));
  assert.ok(textos.includes("error:calendario:Trimestre Q2 2026 en lugar de Q3 2026."));
  assert.ok(textos.includes("error:obra:El contenido desborda la slide."));
  assert.ok(textos.includes("aviso:kpis:Relleno 70 %: queda hueco."));
  assert.equal(textos.length, 5);
});
