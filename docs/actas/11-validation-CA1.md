# Validación pre-load — CA1

Generado: 2026-05-26T12:40:28.136Z

Origen: `tmp/monday-transformed/CA1.json`

## Resultado

**OK** — checks 1–10 pasados.

**Warnings:** 1

- **13_elements_without_log_entries**: 5 elemento(s) sin ninguna log_entry (_Levantamiento de Capital, Suministros, Tramo construcción (segun BP), Bajo nfikwjnj, Operaciones_)

## 11. Elementos mapped vs custom por categoría

| Categoría | Mapped | Custom | Total |
|-----------|-------:|-------:|------:|
| ESTADO PROYECTO | 6 | 0 | 6 |
| FINANCIACIÓN | 2 | 0 | 2 |
| OPERADOR HOTELERO | 5 | 0 | 5 |
| PROPERTY MANAGEMENT | 14 | 1 | 15 |
| SITUACIÓN FINANCIERA | 4 | 0 | 4 |
| SITUACIÓN INQUILINOS | 6 | 9 | 15 |
| SOCIETARIO | 7 | 0 | 7 |

## 12. Top 10 elementos por log_entries

| # | Elemento | Categoría | Entradas |
|---|----------|-----------|----------:|
| 1 | Gobernanza | SOCIETARIO | 7 |
| 2 | Interiorismo | ESTADO PROYECTO | 7 |
| 3 | Seguros | PROPERTY MANAGEMENT | 6 |
| 4 | Legal | OPERADOR HOTELERO | 6 |
| 5 | Tramitación de licencias | ESTADO PROYECTO | 5 |
| 6 | Flujo de caja | SITUACIÓN FINANCIERA | 5 |
| 7 | Seguridad | PROPERTY MANAGEMENT | 5 |
| 8 | Diseño | OPERADOR HOTELERO | 5 |
| 9 | Instalaciones | OPERADOR HOTELERO | 5 |
| 10 | Marketing | OPERADOR HOTELERO | 5 |

## 13. Elementos sin log_entry

**5** elemento(s) — puede ser ruido o ítems sin columna Texto:

- Levantamiento de Capital (SOCIETARIO)
- Suministros (PROPERTY MANAGEMENT)
- Tramo construcción (segun BP) (FINANCIACIÓN)
- Bajo nfikwjnj (SITUACIÓN INQUILINOS)
- Operaciones (OPERADOR HOTELERO)

## 14. Cambios de estado por elemento

**4** elemento(s) con al menos un cambio:

### Gobernanza

- 2026-05-22: `not_started` → `done`
- 2026-05-22: `done` → `working_on_it`

### AJD

- 2026-05-22: `working_on_it` → `done`

### IVA

- 2026-05-22: `working_on_it` → `done`

### Seguros

- 2026-01-15: `working_on_it` → `not_started`
- 2026-02-02: `not_started` → `working_on_it`

## 15. Authors únicos

| author_id | log_entries |
|-----------|------------:|
| `1240dcf7-ce10-4beb-9ee5-7f0cbe6fe176` | 19 |
| `9b278801-f806-47a2-ae0c-373a323416ca` | 16 |
| `891b61f5-7c97-4183-b3d9-5879a160d1e9` | 14 |
| `dd3b4116-f02e-4ca4-bc26-656abc7bf64e` | 7 |
| `bb0336dc-eb63-42aa-955d-5aea684c3602` | 3 |

_Además 92 log_entry(s) con author_id null._

## 16. Distribución de log_entries por mes

| Mes | Entradas |
|-----|----------:|
| 2025-12 | 12 |
| 2026-01 | 22 |
| 2026-02 | 39 |
| 2026-03 | 4 |
| 2026-05 | 74 |

**Huecos temporales detectados:**

- hueco entre 2026-03 y 2026-05

## Resumen transform_stats

```json
{
  "snapshots_processed": 13,
  "snapshots_discarded_stubs": 0,
  "snapshots_discarded_duplicado": 0,
  "snapshots_discarded_subelementos": 13,
  "snapshots_discarded_unparsed": 1,
  "snapshots_same_day_count": 0,
  "elements_total": 54,
  "elements_mapped": 44,
  "elements_custom": 10,
  "log_entries_total": 151,
  "log_entries_by_source": {
    "snapshot": 135,
    "monday_update": 16
  }
}
```
