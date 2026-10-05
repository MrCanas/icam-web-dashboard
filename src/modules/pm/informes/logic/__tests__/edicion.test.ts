import assert from "node:assert/strict";
import { test } from "node:test";

import { renderToStaticMarkup } from "react-dom/server";

import {
  altoDeImagen,
  arbolBloques,
  cambiarFoto,
  camposTexto,
  columnaComoPila,
  desplegar,
  disposicionGaleria,
  etiquetaRuta,
  esDesplegable,
  gruposDeImagenes,
  insertarBloque,
  intercambiarColumnas,
  intercambiarFotos,
  leerRuta,
  localizarCampo,
  moverBloque,
  nodoImagen,
  nodosDe,
  normalizar,
  ponerTexto,
  proporcionActual,
  proporcionColumnas,
  quitarBloque,
  reencuadrar,
  rejillaDe,
  srcDeImagen,
  vaciarFoto,
} from "@/modules/pm/informes/logic/edicion";
import { elemento } from "@/modules/pm/informes/slides/elemento";
import type { SlideJson } from "@/modules/pm/informes/slides/tipos";

const obra: SlideJson = {
  id: "obra-1",
  origen: "actualizada",
  fuentes: "actas",
  compuesto: {
    seccion: 5,
    titulo: "Obra. Avance del trimestre",
    clase: "iq-cols",
    contenido: [
      {
        c: "div",
        hijos: [
          { c: "Subtitulo", hijos: ["Estructura"] },
          { c: "Texto", props: { parrafos: ["Se ha **completado** la estructura.", "Queda la cubierta."] } },
          { c: "Vinetas", props: { items: ["Forjados terminados", "Fachada al 40 %"] } },
        ],
      },
      { c: "Galeria", props: { disposicion: "2", imagenes: [{ src: "/api/informes/fotos/a", pie: "Fachada" }, { src: "/api/informes/fotos/b" }] } },
    ],
    nota: "**Nota:** imágenes de septiembre.",
  },
};

const dosColumnas: SlideJson = {
  id: "estrategia",
  c: "DosColumnas",
  props: {
    seccion: 3,
    titulo: "Resumen de Proyecto. Estrategia",
    izquierda: { c: "Texto", props: { parrafos: ["Texto de la izquierda."] } },
    derecha: [{ c: "Subtitulo", hijos: ["Mercado"] }, { c: "Texto", props: { parrafos: ["Texto de la derecha."] } }],
  },
};

test("camposTexto: los textos que se leen en la slide, sin rutas de foto ni configuración", () => {
  const campos = camposTexto(obra);
  assert.deepEqual(
    campos.map((c) => c.valor),
    [
      "Obra. Avance del trimestre",
      "Estructura",
      "Se ha **completado** la estructura.",
      "Queda la cubierta.",
      "Forjados terminados",
      "Fachada al 40 %",
      "Fachada",
      "**Nota:** imágenes de septiembre.",
    ],
  );
  assert.equal(etiquetaRuta(campos[2]!.ruta), "párrafo 1");
  assert.equal(etiquetaRuta(["props", "izquierda", 0, "props", "parrafos", 1]), "izquierda 1 · párrafo 2");
});

test("localizarCampo: por el bloque, por lo pulsado o por las partes de un texto compuesto", () => {
  const campos = camposTexto(obra);
  // El párrafo pintado no lleva los asteriscos de la negrita.
  assert.deepEqual(localizarCampo(campos, "completado", "Se ha completado la estructura.").map((c) => c.valor), ["Se ha **completado** la estructura."]);
  // Título partido en dos líneas por la plantilla: lo pulsado es un trozo.
  assert.deepEqual(localizarCampo(campos, "Avance del trimestre", "5Obra.Avance del trimestre").map((c) => c.valor), ["Obra. Avance del trimestre"]);
  // Texto compuesto por la plantilla: salen sus partes, la más larga primero.
  const compuestos = [{ ruta: ["props", "anterior", "trimestre"], valor: "Q2 2026" }];
  assert.deepEqual(localizarCampo(compuestos, "Antecedentes. Q2 2026", "Antecedentes. Q2 2026"), compuestos);
  assert.deepEqual(localizarCampo(campos, "Texto que no existe", "Texto que no existe"), []);
});

test("ponerTexto: sustituye, parte un párrafo en dos y quita el que se deja vacío, sin tocar el original", () => {
  const parrafos = ["compuesto", "contenido", 0, "hijos", 1, "props", "parrafos"];
  const cambiado = ponerTexto(obra, [...parrafos, 1], "Queda la cubierta y la fachada.");
  assert.deepEqual(leerRuta(cambiado, parrafos), ["Se ha **completado** la estructura.", "Queda la cubierta y la fachada."]);
  const partido = ponerTexto(obra, [...parrafos, 0], "Primera parte.\n\nSegunda\nparte.");
  assert.deepEqual(leerRuta(partido, parrafos), ["Primera parte.", "Segunda parte.", "Queda la cubierta."]);
  const borrado = ponerTexto(obra, [...parrafos, 1], "  ");
  assert.deepEqual(leerRuta(borrado, parrafos), ["Se ha **completado** la estructura."]);
  assert.equal(ponerTexto(obra, ["compuesto", "titulo"], "Obra. Estado").compuesto?.titulo, "Obra. Estado");
  assert.deepEqual(leerRuta(obra, parrafos), ["Se ha **completado** la estructura.", "Queda la cubierta."]);
});

test("arbolBloques: columnas y pilas de un compuesto, y DosColumnas con sus dos lados", () => {
  const arbol = arbolBloques(normalizar(obra))!;
  assert.equal(arbol.contenedor?.orientacion, "columnas");
  assert.deepEqual(arbol.contenedor?.hijos.map((h) => h.c), ["div", "Galeria"]);
  assert.deepEqual(arbol.contenedor?.hijos[0]!.contenedor?.hijos.map((h) => h.c), ["Subtitulo", "Texto", "Vinetas"]);
  assert.equal(nodosDe(arbol).length, 6);
  const texto = ["compuesto", "contenido", 0, "hijos", 1];
  assert.equal(rejillaDe(arbol, texto)?.columna, 0);
  assert.equal(rejillaDe(arbol, ["compuesto", "contenido", 1])?.columna, 1);

  const dos = arbolBloques(normalizar(dosColumnas))!;
  assert.deepEqual(dos.contenedor?.hijos.map((h) => h.contenedor?.hijos.map((x) => x.c)), [["Texto"], ["Subtitulo", "Texto"]]);
  // Plantilla fija: sin bloques que mover.
  assert.equal(arbolBloques({ id: "resumen-ejecutivo", c: "ResumenEjecutivo", props: {} }), null);
  // Texto suelto entre los bloques: ese contenedor no se reordena.
  const mixto = arbolBloques({ id: "x", compuesto: { contenido: ["texto suelto", { c: "Texto" }] } })!;
  assert.equal(mixto.contenedor?.mixto, true);
});

test("moverBloque: dentro de su columna, a otra columna y a una columna que era un componente suelto", () => {
  const pila = ["compuesto", "contenido", 0, "hijos"];
  const cs = (s: SlideJson, r: (string | number)[]) => (leerRuta(s, r) as { c: string }[]).map((x) => x.c);
  // Bajar el subtítulo una posición: el destino cuenta con el hueco que deja.
  assert.deepEqual(cs(moverBloque(obra, [...pila, 0], { contenedor: pila, indice: 2 }), pila), ["Texto", "Subtitulo", "Vinetas"]);
  assert.deepEqual(cs(moverBloque(obra, [...pila, 2], { contenedor: pila, indice: 0 }), pila), ["Vinetas", "Subtitulo", "Texto"]);
  // Las viñetas pasan a la columna de la galería, que se convierte en pila.
  const { slide: conPila, contenedor } = columnaComoPila(obra, ["compuesto", "contenido", 1]);
  assert.deepEqual(contenedor, ["compuesto", "contenido", 1, "hijos"]);
  const movido = moverBloque(conPila, [...pila, 2], { contenedor, indice: 1 });
  assert.deepEqual(cs(movido, pila), ["Subtitulo", "Texto"]);
  assert.deepEqual(cs(movido, contenedor), ["Galeria", "Vinetas"]);
  // DosColumnas: de la derecha a la izquierda.
  const dos = moverBloque(dosColumnas, ["props", "derecha", 0], { contenedor: ["props", "izquierda"], indice: 0 });
  assert.deepEqual(cs(dos, ["props", "izquierda"]), ["Subtitulo", "Texto"]);
  assert.deepEqual(cs(dos, ["props", "derecha"]), ["Texto"]);
  assert.throws(() => moverBloque(obra, ["compuesto", "contenido", 0], { contenedor: pila, indice: 0 }));
});

test("columnas: intercambio y reparto del ancho", () => {
  const rejilla = ["compuesto", "contenido"];
  const cambiadas = intercambiarColumnas(obra, rejilla);
  assert.deepEqual((leerRuta(cambiadas, rejilla) as { c: string }[]).map((x) => x.c), ["Galeria", "div"]);
  const dos = intercambiarColumnas(dosColumnas, ["props"]);
  assert.equal((leerRuta(dos, ["props", "izquierda"]) as unknown[]).length, 2);

  assert.equal(proporcionActual(obra, rejilla), "1fr 1fr");
  const ancha = proporcionColumnas(obra, rejilla, "3fr 2fr");
  assert.equal(ancha.compuesto?.estilo?.gridTemplateColumns, "3fr 2fr");
  assert.equal(proporcionColumnas(ancha, rejilla, "1fr 1fr").compuesto?.estilo?.gridTemplateColumns, undefined);
  // Rejilla interior: el reparto va en el style del div.
  const interior: SlideJson = { id: "x", compuesto: { contenido: [{ c: "div", props: { className: "iq-cols" }, hijos: [{ c: "Texto" }, { c: "Texto" }] }] } };
  const r = ["compuesto", "contenido", 0, "hijos"];
  assert.deepEqual(leerRuta(proporcionColumnas(interior, r, "2fr 3fr"), ["compuesto", "contenido", 0, "props", "style"]), { gridTemplateColumns: "2fr 3fr" });
  assert.throws(() => proporcionColumnas(dosColumnas, ["props"], "3fr 2fr"));
});

test("imágenes: grupos, cambio de foto, reencuadre, orden y disposición de la galería", () => {
  const galeria = ["compuesto", "contenido", 1];
  const grupos = gruposDeImagenes(obra);
  assert.equal(grupos.length, 1);
  assert.deepEqual(grupos[0]!.imagenes, [[...galeria, "props", "imagenes", 0], [...galeria, "props", "imagenes", 1]]);

  const im0 = [...galeria, "props", "imagenes", 0];
  const reencuadrada = reencuadrar(obra, im0, 0.253, 1.4);
  assert.deepEqual(leerRuta(reencuadrada, im0), { src: "/api/informes/fotos/a", pie: "Fachada", focalX: 0.25, focalY: 1 });
  // Cambiar la foto conserva el pie y devuelve el encuadre al centro.
  assert.deepEqual(leerRuta(cambiarFoto(reencuadrada, grupos[0]!, im0, "/api/informes/fotos/c"), im0), { src: "/api/informes/fotos/c", pie: "Fachada" });
  const cambiadas = intercambiarFotos(obra, im0, [...galeria, "props", "imagenes", 1]);
  assert.deepEqual((leerRuta(cambiadas, [...galeria, "props", "imagenes"]) as { src: string }[]).map((x) => x.src), ["/api/informes/fotos/b", "/api/informes/fotos/a"]);

  // Al pasar a 4 fotos aparecen dos huecos más, que se pueden rellenar aunque la lista fuera más corta.
  const cuatro = disposicionGaleria(obra, galeria, "4");
  assert.equal(gruposDeImagenes(cuatro)[0]!.imagenes.length, 4);
  const rellena = cambiarFoto(cuatro, gruposDeImagenes(cuatro)[0]!, [...galeria, "props", "imagenes", 3], "/api/informes/fotos/d");
  assert.deepEqual((leerRuta(rellena, [...galeria, "props", "imagenes"]) as { src?: string }[]).map((x) => x.src ?? null), [
    "/api/informes/fotos/a",
    "/api/informes/fotos/b",
    null,
    "/api/informes/fotos/d",
  ]);
  assert.throws(() => disposicionGaleria(obra, galeria, "9"));

  const marco: SlideJson = { id: "x", compuesto: { contenido: [{ c: "ImagenMarco", props: { ancho: 300, alto: 200 } }] } };
  assert.deepEqual(gruposDeImagenes(marco)[0]!.imagenes, [["compuesto", "contenido", 0, "props"]]);
  assert.equal(
    (leerRuta(cambiarFoto(marco, gruposDeImagenes(marco)[0]!, ["compuesto", "contenido", 0, "props"], "/api/informes/fotos/z"), ["compuesto", "contenido", 0, "props"]) as { src: string }).src,
    "/api/informes/fotos/z",
  );
});

test("imágenes que la plantilla guarda solo como dirección: portada, ubicación y página de Finanzas", () => {
  const portada: SlideJson = { id: "portada", c: "Portada", props: { trimestre: "Q3 2026", proyecto: "Santa Engracia 84" } };
  const gp = gruposDeImagenes(portada)[0]!;
  assert.deepEqual([gp.tipo, gp.objetos, gp.imagenes], ["Portada", false, [["props", "imagen"]]]);
  assert.equal(srcDeImagen(portada, gp, gp.imagenes[0]!), null);
  const conFoto = cambiarFoto(portada, gp, gp.imagenes[0]!, "/api/informes/fotos/p");
  assert.equal(conFoto.props?.imagen, "/api/informes/fotos/p");
  assert.equal(srcDeImagen(conFoto, gp, gp.imagenes[0]!), "/api/informes/fotos/p");

  const estrategia: SlideJson = {
    id: "estrategia",
    compuesto: { clase: "iq-cols", contenido: [{ c: "Texto", props: { parrafos: ["p"] } }, { c: "MapaLateral", props: { rotulo: "Chamberí", mapa: "/api/informes/fotos/m" } }] },
  };
  const gm = gruposDeImagenes(estrategia)[0]!;
  const nodo = ["compuesto", "contenido", 1];
  assert.deepEqual(gm.imagenes, [[...nodo, "props", "mapa"], [...nodo, "props", "foto"]]);
  assert.deepEqual(leerRuta(cambiarFoto(estrategia, gm, gm.imagenes[1]!, "/api/informes/fotos/f"), [...nodo, "props"]), {
    rotulo: "Chamberí",
    mapa: "/api/informes/fotos/m",
    foto: "/api/informes/fotos/f",
  });

  // Página de Finanzas: al aportarla a mano, la slide deja de estar pendiente.
  const bloqueada: SlideJson = { id: "varianzas", c: "SlideBloqueado", origen: "bloqueada", fuentes: "", props: { titulo: "Varianzas", estado: "Pendiente de Finanzas" } };
  const gb = gruposDeImagenes(bloqueada)[0]!;
  const aportada = cambiarFoto(bloqueada, gb, gb.imagenes[0]!, "/api/informes/fotos/v");
  assert.deepEqual(aportada.props, { titulo: "Varianzas", estado: "Aportado", vista: "/api/informes/fotos/v" });
  assert.equal(aportada.fuentes, "Página aportada a mano");
  assert.equal(bloqueada.props?.vista, undefined);
  // Con contenido propio no lleva página.
  assert.equal(gruposDeImagenes({ id: "x", c: "SlideBloqueado", hijos: [{ c: "Texto" }] }).length, 0);
});

const meta = { proyecto: "Santa Engracia 84", codigo: "SE84", trimestre: "Q3 2026", pie: { variante: "sl" as const, vehiculo: "Vehículo, S.L.", nif: "B00000000" } };
const pintar = (slide: SlideJson) => renderToStaticMarkup(elemento(slide, 7, meta));

const resumen: SlideJson = {
  id: "resumen-ejecutivo",
  c: "ResumenEjecutivo",
  origen: "actualizada",
  fuentes: "actas",
  props: {
    trimestre: "Q3 2026",
    seccion: 1,
    izquierda: [
      { icono: "situacion-actual", titulo: "SITUACIÓN ACTUAL", parrafos: ["El activo está **terminado**.", "Se entrega en octubre."] },
      { icono: "operacion-cronograma", titulo: "OPERACIÓN", vinetas: ["Contrato firmado"] },
    ],
    logros: ["Fin de obra el **11/08**", "Tasación recibida"],
    derecha: [{ icono: "compraventa-financiacion", titulo: "FINANCIACIÓN", parrafos: ["Préstamo dispuesto."] }],
  },
};

const kpis: SlideJson = {
  id: "kpis-riesgos-objetivos",
  c: "SlideKpisRiesgosObjetivos",
  props: {
    trimestre: "Q3 2026",
    siguiente: "Q4 2026",
    seccion: 3,
    kpis: [{ kpi: "% Avance técnico", objetivo: "100 %", real: "100 %", estado: "ok" }],
    riesgos: [{ riesgo: "Retraso del ascensor", mitigacion: "Seguimiento semanal con OTIS" }],
    objetivos: ["Entrega al operador", "Obtener la **licencia** de primera ocupación"],
  },
};

const textoImagen: SlideJson = {
  id: "situacion-operador",
  c: "TextoImagen",
  props: {
    seccion: 4,
    titulo: "Situación de Proyecto. Operador",
    subtitulo: "Entrega",
    parrafos: ["El operador recibe el edificio en **octubre**."],
    nota: "**Nota:** fecha sujeta a la licencia.",
    variante: "dos-apiladas",
    imagenes: [{ src: "/api/informes/fotos/a", pie: "Fachada", focalY: 0.2 }, { src: "/api/informes/fotos/b" }],
  },
};

const colaboradores: SlideJson = {
  id: "colaboradores",
  c: "Colaboradores",
  origen: "heredada",
  props: {
    intro: "Equipo que interviene en el **proyecto**.",
    roles: [
      { rol: "Arquitectura", parrafos: ["Estudio A, responsable del proyecto."] },
      { rol: "Constructora", vinetas: ["Contrato llave en mano", "Fin de obra en agosto"] },
      { rol: "Operador", parrafos: ["Operador B."], vinetas: ["Contrato firmado"] },
    ],
    logos: [{ src: "/api/informes/fotos/l1", nombre: "Estudio A", pie: "Arquitectura" }, { nombre: "Operador B" }],
  },
};

const vehiculo: SlideJson = {
  id: "vehiculo",
  c: "VehiculoInversion",
  props: {
    detalles: ["Fondo de capital riesgo **cerrado**", "Plazo de 5 años"],
    fichas: [
      { icono: "kpi-tir", etiqueta: "TIR objetivo", valor: "12 %" },
      { icono: "kpi-plazo", etiqueta: "Plazo", valor: "5 años" },
    ],
    nota: "**Nota:** datos del folleto.",
  },
};

test("desplegar: una plantilla cerrada pasa a compuesto y se pinta exactamente igual", () => {
  const variantes = [
    resumen,
    kpis,
    textoImagen,
    { ...textoImagen, props: { titulo: "Sin imágenes", parrafos: ["p"] } } as SlideJson,
    colaboradores,
    { id: "colaboradores-2", c: "Colaboradores", props: { roles: [{ rol: "Único" }] } } as SlideJson,
    vehiculo,
    { id: "vehiculo-2", c: "VehiculoInversion", props: { titulo: "Vehículo. Otro título", detalles: ["a"], fichas: [] } } as SlideJson,
  ];
  for (const slide of variantes) {
    assert.ok(esDesplegable(slide), slide.c);
    const abierta = desplegar(slide);
    assert.equal(abierta.c, undefined);
    assert.ok(abierta.compuesto, slide.c);
    assert.deepEqual([abierta.id, abierta.origen, abierta.fuentes], [slide.id, slide.origen, slide.fuentes]);
    assert.equal(pintar(abierta), pintar(slide), `${slide.c} no se pinta igual desplegada`);
    assert.ok(arbolBloques(abierta), slide.c);
  }
  // El original no cambia y lo que ya es compuesto o no se puede abrir se deja como está.
  assert.equal(resumen.c, "ResumenEjecutivo");
  assert.equal(esDesplegable({ id: "portada", c: "Portada", props: {} }), false);
  // Colaboradores: cada rol es un grupo que se mueve entero; los logos quedan fuera del área de bloques.
  const col = arbolBloques(desplegar(colaboradores))!;
  const rejilla = col.contenedor!.hijos[1]!;
  assert.equal(rejilla.contenedor?.orientacion, "columnas");
  assert.deepEqual(rejilla.contenedor?.hijos.map((c) => c.contenedor?.hijos.length), [2, 1]);
  assert.deepEqual(desplegar(obra), obra);
});

test("una plantilla desplegada se reorganiza como cualquier compuesto, sin trimestres que confundan a la revisión", () => {
  const abierta = desplegar(resumen);
  const arbol = arbolBloques(abierta)!;
  assert.deepEqual(arbol.contenedor?.hijos.map((c) => c.contenedor?.hijos.map((b) => b.c)), [["BloqueIcono", "BloqueIcono"], ["BloqueIcono", "BloqueIcono"]]);
  // Los logros (primero de la derecha) pasan a la izquierda.
  const movida = moverBloque(abierta, ["compuesto", "contenido", 1, "hijos", 0], { contenedor: ["compuesto", "contenido", 0, "hijos"], indice: 0 });
  assert.equal((leerRuta(movida, ["compuesto", "contenido", 0, "hijos", 0, "props", "titulo"]) as string), "LOGROS Q3 2026");
  // KPIs: el bloque de objetivos lleva el trimestre siguiente en su rótulo, no en una prop «trimestre».
  const k = desplegar(kpis);
  assert.equal(JSON.stringify(k).includes('"trimestre":"Q4 2026"'), false);
  assert.ok(JSON.stringify(k).includes("OBJETIVOS Q4 2026"));
  // La nota de «texto e imagen» es un bloque de texto, no un contenedor.
  const ti = arbolBloques(desplegar(textoImagen))!;
  assert.deepEqual(ti.contenedor?.hijos.map((c) => c.contenedor?.hijos.map((b) => [b.c, !!b.contenedor])), [
    [["Subtitulo", false], ["Texto", false], ["div", false]],
    [["ImagenMarco", false], ["ImagenMarco", false]],
  ]);
  assert.equal(gruposDeImagenes(desplegar(textoImagen)).length, 2);
});

test("imágenes nuevas: añadir, cambiar de tamaño, vaciar y quitar", () => {
  const abierta = desplegar(resumen);
  const columna = ["compuesto", "contenido", 0, "hijos"];
  const conImagen = insertarBloque(abierta, { contenedor: columna, indice: 99 }, nodoImagen("/api/informes/fotos/n", 395.4, 237.2));
  const ruta = [...columna, 2];
  assert.deepEqual(leerRuta(conImagen, ruta), { c: "ImagenMarco", props: { src: "/api/informes/fotos/n", ancho: 395, alto: 237 } });
  assert.equal((leerRuta(abierta, columna) as unknown[]).length, 2);

  assert.equal((leerRuta(altoDeImagen(conImagen, ruta, 30), [...ruta, "props", "alto"]) as number), 267);
  assert.equal((leerRuta(altoDeImagen(conImagen, ruta, -500), [...ruta, "props", "alto"]) as number), 60);
  assert.equal((leerRuta(altoDeImagen(conImagen, ruta, 500), [...ruta, "props", "alto"]) as number), 400);
  assert.throws(() => altoDeImagen(conImagen, [...columna, 0], 30));

  const grupo = gruposDeImagenes(conImagen)[0]!;
  assert.deepEqual(leerRuta(vaciarFoto(conImagen, grupo, grupo.imagenes[0]!), [...ruta, "props"]), { ancho: 395, alto: 237 });
  const portada: SlideJson = { id: "portada", c: "Portada", props: { trimestre: "Q3 2026", proyecto: "SE84", imagen: "/api/informes/fotos/p" } };
  const gp = gruposDeImagenes(portada)[0]!;
  assert.deepEqual(vaciarFoto(portada, gp, gp.imagenes[0]!).props, { trimestre: "Q3 2026", proyecto: "SE84" });

  assert.deepEqual(quitarBloque(conImagen, ruta), abierta);
  assert.throws(() => quitarBloque(conImagen, ["compuesto"]));
});
