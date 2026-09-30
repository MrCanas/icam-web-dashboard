# Arquetipos y estructura por defecto

Si hay informe anterior, **su estructura manda** (se duplica y se ajusta). Esta tabla solo se usa para un proyecto
sin informe previo, o para sugerir slides que faltan.

## Orden canónico de secciones

| Nº | Sección (índice) | Slides habituales (ids de `layouts.md`) |
|---|---|---|
| — | Portada, Índice | `portada`, `indice` |
| 1 | Resumen Ejecutivo | `resumen-ejecutivo`, `resumen-financiero` (bloqueado) |
| 2 | Análisis de Varianzas | `varianzas` (bloqueado) |
| 3 | Resumen de Proyecto | `estrategia`, `compraventa-financiacion`, `calendario`, `kpis-riesgos-objetivos` |
| 4 | Situación de Proyecto | `situacion-*`, `sostenibilidad`, `licitaciones`, `situacion-desinversion` |
| 5 | Obra | `obra-1`…, `seguimiento-economico-obra` |
| 6 | Colaboradores | `colaboradores`, `colaboradores-2` |
| 7 | Vehículo de Inversión | `vehiculo`, `consejo` |
| — | Disclaimer, Cierre | `disclaimer`, `cierre` (obligatorios) |

Si una sección desaparece (p. ej. no hay Obra), se renumeran índice y dígitos de título.

## Arquetipos → módulos de «Situación de Proyecto»

| Arquetipo | Ejemplos | Módulos típicos |
|---|---|---|
| A · Hospitality / apartamentos con servicios | Santa Engracia 84, Costanilla, Glorieta de Quevedo | Licencia, Arquitectura, Ingeniería, Obra, Operador/Arrendaticia, FF&E, Suministros, BREEAM, CFO/LPO, CM/PM, Desinversión |
| B · Branded residences | Sagasta 31-33, Camino 1 | Arquitectura + Interiorismo (renders), aprobaciones de marca (Marriott), Licencia, Marco legal, Marketing, Showroom, Preventas, BREEAM |
| C · Mixto residencial + hotelero | Padre Claret 25 | Un `calendario` por subproyecto, licencias por parcela, ventas residenciales, operador hotelero, paquetes de obra, BREEAM |
| D · Value-add residencial | Velarde 1 | Gestión de inquilinos, unidades liberadas, reformas por unidad, comercialización, ventas, CAPEX, calendario por fases |
| E · Cartera / multi-activo | Singular Prime II | Ocupación (`DonutOcupacion`), rentas (`TablaMensual`), estado por activo, estratégicos vs no estratégicos, desinversiones, deuda, gobierno (`TimelineTrimestral`) |

## Sugerencias de la biblioteca por arquetipo

Números de `biblioteca.md` que suelen aplicar (entre ellos se eligen las 3 ★ del paso 3 según el material del trimestre):

| Arquetipo | Números habituales |
|---|---|
| A · Hospitality | 13, 16, 17, 18, 19, 21, 22, 28, 30, 31, 32 |
| B · Branded residences | 13, 14, 15, 21, 23, 24, 25, 30, 31 |
| C · Mixto | 11 (uno por subproyecto), 13, 17, 20, 21, 25, 30 |
| D · Value-add | 25, 26, 27, 28, 31 |
| E · Cartera | 37, 38, 39, 28 |

## Cuándo sugerir un slide que no estaba

- Aparece un tema nuevo con peso en las notas (p. ej. inicio de desinversión, incidencia técnica, nuevo operador) → `situacion-<tema>`.
- Hay ≥ 3 fotos nuevas de obra → `obra-n` adicional.
- El informe del asesor BREEAM trae puntuaciones → `sostenibilidad` con barras.
- Cambia un colaborador (nueva constructora, nuevo asesor) → actualizar `colaboradores`.
- Hito cumplido que cierra una fase (CFO, LPO, entrega, venta) → valorar retirar slides de la fase cerrada o reducirlos.

## Cuándo sugerir quitar u ocultar

- Módulo sin cambios materiales y sin contenido persistente útil.
- Contenido de una fase ya cerrada que el inversor ya conoce (p. ej. licitaciones adjudicadas hace dos trimestres).
- Nunca: `disclaimer`, `cierre`, ni slides bloqueados de Finanzas sin su permiso.
