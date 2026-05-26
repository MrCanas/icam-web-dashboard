# Validación pre-load — CSP10

Generado: 2026-05-26T12:42:43.051Z

Origen: `tmp/monday-transformed/CSP10.json`

## Resultado

**OK** — checks 1–10 pasados.

**Warnings:** 1

- **13_elements_without_log_entries**: 1 elemento(s) sin ninguna log_entry (_Suministros_)

## 11. Elementos mapped vs custom por categoría

| Categoría | Mapped | Custom | Total |
|-----------|-------:|-------:|------:|
| COMERCIAL | 2 | 0 | 2 |
| ESTADO PROYECTO | 12 | 0 | 12 |
| FINANCIACIÓN | 1 | 0 | 1 |
| PROPERTY MANAGEMENT | 6 | 0 | 6 |
| SITUACIÓN FINANCIERA | 3 | 0 | 3 |
| SOCIETARIO | 1 | 0 | 1 |

## 12. Top 10 elementos por log_entries

| # | Elemento | Categoría | Entradas |
|---|----------|-----------|----------:|
| 1 | Tramitación de licencias | ESTADO PROYECTO | 29 |
| 2 | Antena | ESTADO PROYECTO | 23 |
| 3 | Alquiler antena | COMERCIAL | 20 |
| 4 | Proyecto Arquitectura | ESTADO PROYECTO | 18 |
| 5 | Integración con Operador | COMERCIAL | 18 |
| 6 | Presupuesto obra | ESTADO PROYECTO | 17 |
| 7 | Interiorismo | ESTADO PROYECTO | 17 |
| 8 | Trabajos previos | ESTADO PROYECTO | 17 |
| 9 | Gobernanza | SOCIETARIO | 15 |
| 10 | Cerradura | PROPERTY MANAGEMENT | 14 |

## 13. Elementos sin log_entry

**1** elemento(s) — puede ser ruido o ítems sin columna Texto:

- Suministros (PROPERTY MANAGEMENT)

## 14. Cambios de estado por elemento

**3** elemento(s) con al menos un cambio:

### Gobernanza

- 2026-05-13: `done` → `working_on_it`

### Trabajos previos

- 2025-12-18: `not_started` → `working_on_it`

### Licitación de obra

- 2026-05-13: `not_started` → `working_on_it`
- 2026-05-13: `working_on_it` → `not_started`
- 2026-05-13: `not_started` → `working_on_it`

## 15. Authors únicos

| author_id | log_entries |
|-----------|------------:|
| `1240dcf7-ce10-4beb-9ee5-7f0cbe6fe176` | 109 |
| `9b278801-f806-47a2-ae0c-373a323416ca` | 33 |
| `891b61f5-7c97-4183-b3d9-5879a160d1e9` | 22 |
| `ab3641c7-9309-49f0-bf50-674ef29bf3a0` | 18 |
| `dd3b4116-f02e-4ca4-bc26-656abc7bf64e` | 15 |
| `881d130d-ac74-457e-87ab-3248d332c5ac` | 6 |
| `bb0336dc-eb63-42aa-955d-5aea684c3602` | 5 |

_Además 84 log_entry(s) con author_id null._

## 16. Distribución de log_entries por mes

| Mes | Entradas |
|-----|----------:|
| 2025-12 | 141 |
| 2026-05 | 151 |

**Huecos temporales detectados:**

- hueco entre 2025-12 y 2026-05

## Resumen transform_stats

```json
{
  "snapshots_processed": 35,
  "snapshots_discarded_stubs": 13,
  "snapshots_discarded_duplicado": 1,
  "snapshots_discarded_subelementos": 35,
  "snapshots_discarded_unparsed": 0,
  "snapshots_same_day_count": 2,
  "elements_total": 25,
  "elements_mapped": 25,
  "elements_custom": 0,
  "log_entries_total": 292,
  "log_entries_by_source": {
    "snapshot": 292,
    "monday_update": 0
  }
}
```
