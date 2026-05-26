# Validación pre-load — VBARE

Generado: 2026-05-26T13:07:35.348Z

Origen: `tmp/monday-transformed/VBARE.json`

## Resultado

**OK** — checks 1–10 pasados.

**Warnings:** 1

- **13_elements_without_log_entries**: 46 elemento(s) sin ninguna log_entry (_Estado capex/reparaciones, Estado litigios, Estado venta/desinversión, Estado litigios, Estado Alquiler_)

## 11. Elementos mapped vs custom por categoría

| Categoría | Mapped | Custom | Total |
|-----------|-------:|-------:|------:|
| BUSINESS PLAN - EDIFICIOS | 21 | 81 | 102 |
| CUMPLIMIENTO NORMATIVO Y FISCAL | 1 | 2 | 3 |
| GOBERNANZA | 0 | 16 | 16 |
| PERSONAL | 0 | 3 | 3 |
| PROPERTY MANAGEMENT | 1 | 0 | 1 |
| SITUACIÓN FINANCIERA | 3 | 5 | 8 |
| VBARE - Conclusiones | 0 | 3 | 3 |

## 12. Top 10 elementos por log_entries

| # | Elemento | Categoría | Entradas |
|---|----------|-----------|----------:|
| 1 | Otorgamiento de Poderes | GOBERNANZA | 2 |
| 2 | Seguimiento CdA | GOBERNANZA | 2 |
| 3 | Seguimiento JGA | GOBERNANZA | 2 |
| 4 | VALLEHERMOSO | BUSINESS PLAN - EDIFICIOS | 2 |
| 5 | SEPBLAC | PBC | CUMPLIMIENTO NORMATIVO Y FISCAL | 2 |
| 6 | Comunicaciones a mercado | GOBERNANZA | 1 |
| 7 | Cambios en el OA | GOBERNANZA | 1 |
| 8 | Cambio ScaleUP | GOBERNANZA | 1 |
| 9 | Cuentas Anuales | GOBERNANZA | 1 |
| 10 | Cambio CNAE en SS | GOBERNANZA | 1 |

## 13. Elementos sin log_entry

**46** elemento(s) — puede ser ruido o ítems sin columna Texto:

- Estado capex/reparaciones (BUSINESS PLAN - EDIFICIOS)
- Estado litigios (BUSINESS PLAN - EDIFICIOS)
- Estado venta/desinversión (BUSINESS PLAN - EDIFICIOS)
- Estado litigios (BUSINESS PLAN - EDIFICIOS)
- Estado Alquiler (BUSINESS PLAN - EDIFICIOS)
- Estado capex/reparaciones (BUSINESS PLAN - EDIFICIOS)
- Estado litigios (BUSINESS PLAN - EDIFICIOS)
- Estado venta/desinversión (BUSINESS PLAN - EDIFICIOS)
- Estado Alquiler (BUSINESS PLAN - EDIFICIOS)
- Estado capex/reparaciones (BUSINESS PLAN - EDIFICIOS)
- Estado litigios (BUSINESS PLAN - EDIFICIOS)
- Estado venta/desinversión (BUSINESS PLAN - EDIFICIOS)
- Estado Alquiler (BUSINESS PLAN - EDIFICIOS)
- Estado capex/reparaciones (BUSINESS PLAN - EDIFICIOS)
- Estado litigios (BUSINESS PLAN - EDIFICIOS)
- Estado venta/desinversión (BUSINESS PLAN - EDIFICIOS)
- Estado Alquiler (BUSINESS PLAN - EDIFICIOS)
- Estado capex/reparaciones (BUSINESS PLAN - EDIFICIOS)
- Estado litigios (BUSINESS PLAN - EDIFICIOS)
- Estado venta/desinversión (BUSINESS PLAN - EDIFICIOS)
- Estado Alquiler (BUSINESS PLAN - EDIFICIOS)
- Estado litigios (BUSINESS PLAN - EDIFICIOS)
- Estado venta/desinversión (BUSINESS PLAN - EDIFICIOS)
- Estado Alquiler (BUSINESS PLAN - EDIFICIOS)
- Estado capex/reparaciones (BUSINESS PLAN - EDIFICIOS)
- Estado litigios (BUSINESS PLAN - EDIFICIOS)
- Estado capex/reparaciones (BUSINESS PLAN - EDIFICIOS)
- Estado litigios (BUSINESS PLAN - EDIFICIOS)
- Estado venta/desinversión (BUSINESS PLAN - EDIFICIOS)
- Interes (BUSINESS PLAN - EDIFICIOS)
- Estado Alquiler (BUSINESS PLAN - EDIFICIOS)
- Estado litigios (BUSINESS PLAN - EDIFICIOS)
- Estado venta/desinversión (BUSINESS PLAN - EDIFICIOS)
- Estado Alquiler (BUSINESS PLAN - EDIFICIOS)
- Estado litigios (BUSINESS PLAN - EDIFICIOS)
- Estado litigios (BUSINESS PLAN - EDIFICIOS)
- Estado litigios (BUSINESS PLAN - EDIFICIOS)
- Estado litigios (BUSINESS PLAN - EDIFICIOS)
- Estado de alquiler (BUSINESS PLAN - EDIFICIOS)
- Estado litigios (BUSINESS PLAN - EDIFICIOS)
- Estado venta/desinversión (BUSINESS PLAN - EDIFICIOS)
- GENERAL (BUSINESS PLAN - EDIFICIOS)
- Cumplimiento de la normativa SOCIMI (CUMPLIMIENTO NORMATIVO Y FISCAL)
- Estrategia General (VBARE - Conclusiones)
- Resumen hitos (VBARE - Conclusiones)
- Problemas o tomas de decisiones a adoptar (VBARE - Conclusiones)

## 14. Cambios de estado por elemento

_Ningún cambio de estado registrado en log_entries._
## 15. Authors únicos

| author_id | log_entries |
|-----------|------------:|
| `dd3b4116-f02e-4ca4-bc26-656abc7bf64e` | 5 |

_Además 90 log_entry(s) con author_id null._

## 16. Distribución de log_entries por mes

| Mes | Entradas |
|-----|----------:|
| 2025-01 | 5 |
| 2026-05 | 90 |

**Huecos temporales detectados:**

- hueco entre 2025-01 y 2026-05

## Resumen transform_stats

```json
{
  "snapshots_processed": 1,
  "snapshots_discarded_stubs": 1,
  "snapshots_discarded_duplicado": 0,
  "snapshots_discarded_subelementos": 1,
  "snapshots_discarded_unparsed": 0,
  "snapshots_same_day_count": 0,
  "elements_total": 136,
  "elements_mapped": 26,
  "elements_custom": 110,
  "log_entries_total": 95,
  "log_entries_by_source": {
    "snapshot": 90,
    "monday_update": 5
  }
}
```
