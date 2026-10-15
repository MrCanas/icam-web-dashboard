# Biblioteca de slides

Catálogo que se enseña al usuario en el paso 3 (antes del GO). Los números son estables: el usuario puede
responder «añade 14 y 22». La receta técnica de cada una está en `layouts.md` (columna «id»).

Leyenda de «Sugerir cuando»: condición que, si aparece en el material del trimestre, hace que la propongas
entre las 3 recomendadas.

Estructura fija (logic/estructuraFija.ts): estas slides salen SIEMPRE, en este orden y con los mismos bloques
cada trimestre (solo cambia el texto): portada, indice, resumen-ejecutivo, resumen-financiero, varianzas,
estrategia-compraventa, calendario, calendario-timeline, kpis-riesgos-objetivos, situacion-cm-pm (una o dos
slides), sostenibilidad, sostenibilidad-seguimiento, colaboradores, vehiculo, disclaimer y cierre. Las demás son
opcionales y van en su sección.

## Estructura (siempre presentes)

| Nº | Slide | Para qué sirve | id |
|---|---|---|---|
| 1 | Portada | Trimestre, proyecto y foto del edificio | `portada` |
| 2 | Índice | Secciones del informe | `indice` |
| 3 | Resumen ejecutivo del proyecto | Situación actual, logros, compraventa/financiación, operación y cronograma | `resumen-ejecutivo` |
| 4 | Disclaimer | Texto legal vigente (obligatorio) | `disclaimer` |
| 5 | Cierre | Contraportada (obligatoria) | `cierre` |

## Finanzas (bloqueadas; las aporta Finanzas)

| Nº | Slide | Para qué sirve | Sugerir cuando | id |
|---|---|---|---|---|
| 6 | Resumen financiero | Datos del fondo e indicadores (TIR, ROE, LTV, NOI…) | Siempre en vehículos CNMV | `resumen-financiero` |
| 7 | Análisis de varianzas | Comparativa Q-1 vs Q de las proyecciones | Siempre que Finanzas la envíe | `varianzas` |

## Resumen de proyecto

| Nº | Slide | Para qué sirve | Sugerir cuando | id |
|---|---|---|---|---|
| 40 | Estrategia, compraventa y financiación | Estrategia de proyecto, compraventa del inmueble y financiación, con 2 imágenes | Siempre (estructura fija) | `estrategia-compraventa` |
| 8 | Estrategia y descripción (informes anteriores; sustituida por nº 40) | Estrategia, programa del edificio, mapa y foto | No se propone | `estrategia` |
| 9 | Compraventa y financiación (informes anteriores; sustituida por nº 40) | Préstamo, disposiciones, seguros, monitoring/VIO | No se propone | `compraventa-financiacion` |
| 10 | Calendario | Antecedentes del trimestre anterior y Novedades del actual (texto) | Siempre (estructura fija) | `calendario` |
| 11 | Calendario · hitos reseñables | Texto del calendario, hitos reseñables y timeline del proyecto | Siempre (estructura fija) | `calendario-timeline` |
| 12 | KPIs, riesgos y objetivos | Indicadores, riesgos-mitigaciones y objetivos Q+1 | Siempre | `kpis-riesgos-objetivos` |

## Situación de proyecto (módulos)

| Nº | Slide | Para qué sirve | Sugerir cuando | id |
|---|---|---|---|---|
| 13 | Licencia y tramitación | Estado de licencias, requerimientos, CFO/LPO/DR | Hay novedad administrativa | `situacion-licencia` |
| 14 | Arquitectura | Fase de diseño, decisiones, renders | Diseño aún en curso | `situacion-arquitectura` |
| 15 | Interiorismo | Concepto, materiales, aprobaciones, renders | Proyectos branded / hospitality en diseño | `situacion-interiorismo` |
| 16 | Ingeniería e instalaciones | Estructura, MEP, estudios técnicos | Incidencia o hito técnico | `situacion-ingenieria` |
| 17 | Arrendaticia / operador | Contrato con operador, condiciones, coordinación | Hay operador | `situacion-arrendaticia` |
| 18 | Suministros y mantenimiento | Acometidas, contratos, ascensor, legalizaciones | Fase final de obra o explotación | `situacion-suministros` |
| 19 | Construction & Project Management | Construction management y project management (una slide, o dos si hay mucho contenido) | Siempre (estructura fija) | `situacion-cm-pm` |
| 20 | Licitaciones y contratación | Estado por lote/paquete | Adjudicaciones en el trimestre | `licitaciones` |
| 21 | Sostenibilidad BREEAM | Estrategia de sostenibilidad, calificación objetivo y puntuación por categorías | Siempre (estructura fija) | `sostenibilidad` |
| 22 | Cronograma BREEAM | Seguimiento y timeline de la certificación | Siempre (estructura fija) | `sostenibilidad-seguimiento` |
| 23 | Marca y aprobaciones | Aprobaciones del brand (p. ej. Marriott) | Branded residences | `situacion-marca` |
| 24 | Marketing | Posicionamiento, materiales, lanzamiento | Pre-lanzamiento comercial | `situacion-marketing` |
| 25 | Comercialización / preventas | Reservas, ventas, precios, canales | Hay ventas o reservas | `situacion-comercializacion` |
| 26 | Gestión de inquilinos | Unidades liberadas, indemnizaciones, ocupación | Value-add residencial | `situacion-inquilinos` |
| 27 | Reformas por unidad | Unidades terminadas/en curso, CAPEX | Value-add residencial | `situacion-reformas` |
| 28 | Desinversión | Proceso de venta, inversores, NBO/DD, cierre | Proceso de venta iniciado | `situacion-desinversion` |
| 29 | Slide libre | Cualquier tema excepcional (texto + imagen/tabla) | Tema nuevo relevante sin slide propia | `situacion-<tema>` |

## Obra

| Nº | Slide | Para qué sirve | Sugerir cuando | id |
|---|---|---|---|---|
| 30 | Situación de obra (texto + fotos) | Avance por plantas/lotes con 1–2 fotos | Obra en curso | `obra-1` |
| 31 | Galería de obra | 2–4 fotos grandes con breve texto | ≥ 3 fotos nuevas | `obra-n` |
| 32 | Seguimiento económico de obra | Contratación y producción ligada a certificación | Lo aporta el PM/PMo | `seguimiento-economico-obra` |

## Colaboradores y vehículo

| Nº | Slide | Para qué sirve | Sugerir cuando | id |
|---|---|---|---|---|
| 33 | Colaboradores | Roles y firmas con logos | Siempre | `colaboradores` |
| 34 | Colaboradores (continuación) | Resto de roles | > 4 roles | `colaboradores-2` |
| 35 | Vehículo de inversión | Datos registrales y fichas de estado | Siempre | `vehiculo` |
| 36 | Consejo de administración | Puntos tratados en consejo/junta | Sociedades con consejo en el trimestre | `consejo` |

## Cartera / multi-activo

| Nº | Slide | Para qué sirve | Sugerir cuando | id |
|---|---|---|---|---|
| 37 | Ocupación de la cartera | Donut de ocupación por activo | Arquetipo E | `cartera-ocupacion` |
| 38 | Rentas mensuales | Tabla de ingresos por activo y mes | Arquetipo E | `cartera-rentas` |
| 39 | Calendario trimestral de hitos | Eventos agrupados por trimestre | Arquetipo E | `cartera-calendario` |
