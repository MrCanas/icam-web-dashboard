# Validación pre-load — DC15

Generado: 2026-05-26T12:46:13.717Z

Origen: `tmp/monday-transformed/DC15.json`

## Resultado

**OK** — checks 1–10 pasados.

## 11. Elementos mapped vs custom por categoría

| Categoría | Mapped | Custom | Total |
|-----------|-------:|-------:|------:|
| COMERCIAL | 3 | 0 | 3 |
| DESINVERSIÓN | 7 | 0 | 7 |
| ESTADO PROYECTO | 9 | 0 | 9 |
| FINANCIACIÓN | 2 | 0 | 2 |
| PROPERTY MANAGEMENT | 16 | 0 | 16 |
| SITUACIÓN FINANCIERA | 3 | 0 | 3 |
| SOCIETARIO | 5 | 1 | 6 |

## 12. Top 10 elementos por log_entries

| # | Elemento | Categoría | Entradas |
|---|----------|-----------|----------:|
| 1 | Tramitación de licencias | ESTADO PROYECTO | 43 |
| 2 | Presupuesto obra | ESTADO PROYECTO | 37 |
| 3 | Integración con Operador | COMERCIAL | 28 |
| 4 | Proyecto Arquitectura | ESTADO PROYECTO | 27 |
| 5 | Informe | SITUACIÓN FINANCIERA | 26 |
| 6 | Ascensor | PROPERTY MANAGEMENT | 26 |
| 7 | Seguridad | Alarma | PROPERTY MANAGEMENT | 26 |
| 8 | Inicio Obra | ESTADO PROYECTO | 25 |
| 9 | Interiorismo | ESTADO PROYECTO | 23 |
| 10 | Flujo de caja | SITUACIÓN FINANCIERA | 23 |

## 13. Elementos sin log_entry

_Ninguno._

## 14. Cambios de estado por elemento

**9** elemento(s) con al menos un cambio:

### Gobernanza

- 2026-04-09: `done` → `working_on_it`
- 2026-04-09: `working_on_it` → `done`
- 2026-04-16: `done` → `working_on_it`
- 2026-05-01: `working_on_it` → `done`
- 2026-05-14: `done` → `working_on_it`
- 2026-05-14: `working_on_it` → `done`

### Aval de gestión residuos

- 2026-05-14: `working_on_it` → `done`

### Tramitación de licencias

- 2026-03-19: `working_on_it` → `done`
- 2026-05-01: `done` → `working_on_it`
- 2026-05-14: `working_on_it` → `done`
- 2026-05-14: `done` → `working_on_it`

### Proyecto Arquitectura

- 2025-02-06: `stuck` → `working_on_it`

### DD Compra

- 2025-11-27: `working_on_it` → `stuck`
- 2025-12-10: `stuck` → `working_on_it`

### Inquilino KAWAI

- 2025-11-27: `not_started` → `working_on_it`

### Situación renta - FarHome

- 2025-02-06: `done` → `working_on_it`
- 2025-05-08: `working_on_it` → `done`

### Tramo construcción

- 2025-12-10: `stuck` → `working_on_it`
- 2026-05-01: `working_on_it` → `stuck`
- 2026-05-14: `stuck` → `working_on_it`
- 2026-05-14: `working_on_it` → `stuck`

### Licencia y PBE

- 2026-03-19: `working_on_it` → `done`

## 15. Authors únicos

| author_id | log_entries |
|-----------|------------:|
| `ab3641c7-9309-49f0-bf50-674ef29bf3a0` | 241 |
| `881d130d-ac74-457e-87ab-3248d332c5ac` | 51 |
| `891b61f5-7c97-4183-b3d9-5879a160d1e9` | 49 |
| `bb0336dc-eb63-42aa-955d-5aea684c3602` | 23 |
| `dd3b4116-f02e-4ca4-bc26-656abc7bf64e` | 19 |
| `99638d20-2c0e-49b4-b2b5-e4f695d6c493` | 6 |

_Además 142 log_entry(s) con author_id null._

## 16. Distribución de log_entries por mes

| Mes | Entradas |
|-----|----------:|
| 2025-01 | 45 |
| 2025-02 | 37 |
| 2025-03 | 11 |
| 2025-04 | 23 |
| 2025-05 | 11 |
| 2025-06 | 20 |
| 2025-07 | 42 |
| 2025-09 | 43 |
| 2025-10 | 53 |
| 2025-11 | 43 |
| 2025-12 | 27 |
| 2026-01 | 23 |
| 2026-02 | 20 |
| 2026-03 | 25 |
| 2026-04 | 21 |
| 2026-05 | 87 |

**Huecos temporales detectados:**

- hueco entre 2025-07 y 2025-09

## Resumen transform_stats

```json
{
  "snapshots_processed": 51,
  "snapshots_discarded_stubs": 32,
  "snapshots_discarded_duplicado": 0,
  "snapshots_discarded_subelementos": 51,
  "snapshots_discarded_unparsed": 0,
  "snapshots_same_day_count": 1,
  "elements_total": 46,
  "elements_mapped": 45,
  "elements_custom": 1,
  "log_entries_total": 531,
  "log_entries_by_source": {
    "snapshot": 531,
    "monday_update": 0
  }
}
```
