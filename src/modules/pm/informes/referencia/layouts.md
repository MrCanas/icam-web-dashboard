# informe.json y catálogo de layouts

El informe es un único `informe.json`. El visor lo pinta con los componentes del design system
(`design-system/project/components/bundle.js`, API en `index.d.ts`). Nunca se escribe HTML a mano.

## Estructura del fichero

```json
{
  "meta": {
    "proyecto": "Santa Engracia 84", "codigo": "SE84",
    "trimestre": "Q3 2026", "trimestreAnterior": "Q2 2026", "siguiente": "Q4 2026",
    "fechaCierre": "2026-09-30", "arquetipo": "A",
    "pie": { "variante": "cnmv", "tipo": "fondo", "fondo": "Impar Prime Alternative Investment Fund", "isin": "ES0147869004" },
    "version": "v1", "estado": "Borrador", "actualizado": "2026-09-24",
    "artifact": "https://claude.ai/artifact/…"
  },
  "slides": [ …en orden… ]
}
```

- `pie`: `{"variante":"sl","vehiculo":"…, S.L.","nif":"B…"}` para sociedades; `{"variante":"cnmv","tipo":"fondo","fondo":"…","isin":"…"}` para FICC/FCR. Se copia del informe anterior; lo aporta Legal/Finanzas, nunca se inventa.
- El visor añade solo `pie` y `pagina` (posición entre los slides visibles). No los escribas en cada slide.

## Un slide

Tres formas:

1. **Slide completo** (componente que ya es un slide):
   `{"id":"resumen-ejecutivo","c":"ResumenEjecutivo","props":{…},"origen":"actualizada","fuentes":"notas PM 15/09; KPI obra"}`
2. **Slide compuesto** (cabecera + bloques):
   `{"id":"calendario","compuesto":{"seccion":3,"titulo":"Resumen de Proyecto. Calendario","clase":"iq-cols","contenido":[nodos…],"nota":"**Nota:** …"},"origen":"…","fuentes":"…"}`
   - `clase`: `iq-cols` (dos columnas 48/48, cada hijo es una columna) o `iq-apilado` (vertical). Sin clase: flujo normal.
   - `estilo`: objeto CSS opcional (p. ej. `{"gridTemplateColumns":"1fr 270px"}` para texto + columna de mapa).
3. **Oculto**: añade `"oculto": true` para quitarlo del informe sin perderlo.

Campos de control (no se pintan en el PDF; el visor los muestra debajo del slide):
- `id`: estable, en minúsculas con guiones. Nunca se renombra (las correcciones lo referencian).
- `origen`: `heredada` (igual que el trimestre anterior), `actualizada`, `nueva`, `bloqueada` (Finanzas/Legal).
- `fuentes`: de dónde sale cada dato (p. ej. «acta obra 12/09; correo operador 03/09; informe Q2»). Obligatorio en slides con datos nuevos.

## Nodos

Un nodo es un texto o `{"c": "Componente", "props": {…}, "hijos": [nodos]}`. `c` puede ser cualquier componente
de `ImparInformes` o `div`/`span`/`p`. Dentro de `props`, cualquier objeto con `c` también se convierte en nodo
(así se pasan `izquierda`/`derecha` de `DosColumnas`). Texto enriquecido: solo `**negrita**` para el dato clave.

Bloques más usados:
- `{"c":"Subtitulo","hijos":["ESTRATEGIA DE PROYECTO"]}` — mayúsculas navy. `{"c":"Subtitulo","props":{"nivel":2},"hijos":["Novedades. Q3 2026"]}`.
- `{"c":"Texto","props":{"parrafos":["…","…"]}}`
- `{"c":"Vinetas","props":{"items":["**Inicio de obra**: enero de 2026"],"compacta":true}}`
- `{"c":"ImagenMarco","props":{"src":"fotos/fachada.jpg","ancho":348,"alto":290,"pie":"Fachada a septiembre de 2026"}}`
- `{"c":"div","props":{"style":{"marginTop":24}},"hijos":[…]}` — solo para separar; no inventes estilos de color o fuente.

## Catálogo (sección → layout → receta)

Los límites de caracteres del design system son **orientativos**: manda la medición real de `construir.py` (desborde y
relleno ≥ 85 %). Nunca se reduce la letra. Capacidad aproximada al tamaño actual (cuerpo 10,5 pt), para planificar:

| Zona | Capacidad aproximada |
|---|---|
| Columna de `DosColumnas` / columna de texto de un compuesto `iq-cols` | 1.300–1.500 caracteres (≈ 22 líneas) |
| Texto a ancho completo | ≈ 2.800–3.000 caracteres |
| Columna de texto de `TextoImagen` | 1.000–1.300 caracteres |
| Texto a ancho completo sobre una galería `2` | ≈ 450 caracteres (3 líneas) |
| Rol de `Colaboradores` (2 columnas, con logos) | 3–4 roles por columna de ~350 caracteres |

Cada subtítulo resta ≈ 1 línea; cada viñeta compacta ≈ 0,8 líneas.

| id sugerido | Sección | Forma | Contenido y límites |
|---|---|---|---|
| `portada` | — | `Portada` | `{"trimestre":"Q3 2026","proyecto":"Santa Engracia 84","imagen":"fotos/portada.jpg"}`. Foto 390×296. |
| `indice` | — | `Indice` | `{"secciones":[…]}` 5–7, nombres de sección, en el orden de los dígitos usados. |
| `resumen-ejecutivo` | 1 | `ResumenEjecutivo` | `trimestre`, `izquierda` = bloques `{icono,titulo,parrafos|vinetas}` con iconos `situacion-actual`, `compraventa-financiacion`, `operacion-cronograma`; `logros` 6/9 viñetas fechadas. Situación actual 650/900. **Se redacta el último.** |
| `resumen-financiero` | 1 | `SlideBloqueado` | `{"seccion":1,"titulo":"Resumen Ejecutivo. Financiero Q3 2026","origen":"Finanzas","version":"…","estado":"…","vista":"fotos/finanzas-p4.png"}`. Si Finanzas no la ha enviado: sin `vista`, `estado":"Pendiente de Finanzas"`. |
| `varianzas` | 2 | `SlideBloqueado` (+ `TablaVarianzas` en `hijos` si Finanzas pasa las cifras) | Nunca se calculan ni redactan cifras financieras. |
| `estrategia` | 3 | compuesto `iq-cols` con `estilo {"gridTemplateColumns":"1fr 270px"}`: col. 1 Subtitulo+Texto; col. 2 `MapaLateral {pin, rotulo, foto}` | Estrategia heredada salvo cambio. Texto ≤ 900. |
| `compraventa-financiacion` | 3 | `DosColumnas` | izquierda: Compraventa/Financiación; derecha: Seguros / Project Monitoring. 700/900 por columna. |
| `calendario` | 3 | compuesto `iq-cols`: col. 1 `AntecedentesNovedades` (anterior ≤ 400) + `HitosResenables`; col. 2 o fila inferior `Timeline` | Timeline 5–11 hitos, título ≤ 32, fecha `MM/AA`, `hecho` true/false. Un solo esquema (`slate` por defecto). Si no cabe en columna: timeline en slide aparte `calendario-timeline` (compuesto, `ancho` 820). |
| `kpis-riesgos-objetivos` | 3 | `SlideKpisRiesgosObjetivos` | `trimestre`, `siguiente`, `kpis [{indicador,actual,objetivo}]` ≤ 8, `riesgos [{riesgo,mitigacion}]` 2–5, `objetivos` 3–6. Celdas 140/220. |
| `situacion-<tema>` | 4 | `DosColumnas` (dos temas) o `TextoImagen` (un tema + foto/render) | Licencia, Arquitectura, Interiorismo, Ingeniería, Operador/Arrendaticia, Suministros, CM/PM, Desinversión, Comercialización… Un slide por 1–2 módulos. `TextoImagen`: ≤ 500 con 1 imagen; `variante":"dos-apiladas"` con 2 renders. |
| `sostenibilidad` | 4 | compuesto `iq-cols`: Texto + `BreeamRating {estrellas,calificacion,rango}` + `BarrasBreeam {categorias [{nombre,objetivo,avance}]}` o `BarraConsolidacion` | Solo con cifras BREEAM aportadas (informe del asesor). |
| `licitaciones` | 4 | compuesto con `TablaLicitaciones {titulo,columnas,filas}` | Estado de contratación por lote. |
| `calendario-timeline` | 3 | compuesto con `Subtitulo` + `Timeline` `ancho` 840 (+ texto breve) | Timelines largos o por subproyecto. |
| `obra-<n>` | 5 | compuesto `iq-cols`: Texto a la izquierda + `Galeria` a la derecha, o `Galeria` sola | `disposicion` `1`/`2`/`3`/`4`/`hero-2`; máx. 4 fotos por slide; pie «* Imágenes del estado actual de la ejecución de las obras». |
| `seguimiento-economico-obra` | 5 | `SlideBloqueado` o compuesto con `TablaFinanciera` | Cifras de certificación solo si las aporta el PM/PMo. |
| `colaboradores` / `colaboradores-2` | 6 | `Colaboradores` | **`seccion` siempre explícita** (el componente usa 5 por defecto). `intro`, `roles` 4–8 (párrafo ≤ 300, firma en negrita), `logos` 4–7 (`src` si hay logo). Si hay más roles: segundo slide. |
| `vehiculo` | 7 | `VehiculoInversion` | **`seccion` siempre explícita** (usa 6 por defecto). `detalles` (viñetas), 4 `fichas {icono,etiqueta,valor}` con iconos `vehiculo-aeat`, `vehiculo-obligacion-mercantil`, `vehiculo-inscripcion-rm`, `vehiculo-siguiente-informe`. Datos de Legal/Finanzas; actualizar «siguiente informe». |
| `consejo` | 7 | compuesto con `ConsejoAdministracion {titulo,intro,puntos}` | Solo sociedades con consejo. |
| `disclaimer` | — | `Disclaimer` | Sin `parrafos` (usa el texto vigente). Obligatorio, penúltimo. |
| `cierre` | — | `Cierre` | Obligatorio, último. |

El sello «BLOQUEADO · origen · versión» de `SlideBloqueado` solo se ve en el visor; no sale en el PDF.

Cartera / multi-activo (arquetipo E): `cartera-ocupacion` (`DonutOcupacion`), `cartera-rentas` (`TablaMensual`), `cartera-calendario` (`TimelineTrimestral`), `KpiIconosFinancieros`.

Los ids `situacion-<tema>` de la biblioteca (licencia, arquitectura, interiorismo, ingeniería, suministros, marca, marketing, comercialización, inquilinos, reformas) usan `DosColumnas` o `TextoImagen` según haya imágenes.

## Heurística de elección

- ≤ 500 caracteres + 1 imagen → `TextoImagen`. > 900 → `DosColumnas` o partir.
- 1–2 fotos → imagen grande (`Galeria` `1`/`2`); 3–4 → `Galeria` `3`/`4`/`hero-2`; > 4 → otro slide.
- Dos módulos cortos del mismo ámbito → un `DosColumnas`. Un módulo largo → su propio slide.
- Títulos: «Sección. Subtema» en tipo frase; `SlideHeader` pone las mayúsculas y parte en el primer «. ». La parte antes del «. » ≤ 38 caracteres.

## Ejemplo de slide compuesto (calendario)

```json
{"id":"calendario","origen":"actualizada","fuentes":"informe Q2; notas PM",
 "compuesto":{"seccion":3,"titulo":"Resumen de Proyecto. Calendario","contenido":[
   {"c":"div","props":{"className":"iq-cols"},"hijos":[
     {"c":"AntecedentesNovedades","props":{"titulo":"CALENDARIO",
       "anterior":{"trimestre":"Q2 2026","parrafos":["…"]},
       "actual":{"trimestre":"Q3 2026","parrafos":["…"]}}},
     {"c":"HitosResenables","props":{"intro":"A continuación, las fechas clave de la planificación del proyecto:",
       "items":[{"etiqueta":"Fin de obra","fecha":"agosto 2026"}]}}]},
   {"c":"div","props":{"style":{"marginTop":16}},"hijos":[
     {"c":"Timeline","props":{"hitos":[{"titulo":"Licencia de obra","fecha":"04/25","hecho":true}]}}]}]}}
```
