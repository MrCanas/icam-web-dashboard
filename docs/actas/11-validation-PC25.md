# Validación pre-load — PC25

Generado: 2026-05-26T12:52:58.871Z

Origen: `tmp/monday-transformed/PC25.json`

## Resultado

**OK** — checks 1–10 pasados.

**Warnings:** 1

- **13_elements_without_log_entries**: 1 elemento(s) sin ninguna log_entry (_Suministros_)

## 11. Elementos mapped vs custom por categoría

| Categoría | Mapped | Custom | Total |
|-----------|-------:|-------:|------:|
| ACTIVO ACCESORIO VINCULADO | 5 | 1 | 6 |
| COMERCIAL | 4 | 0 | 4 |
| ESTADO PROYECTO | 8 | 1 | 9 |
| ESTADO PROYECTO PC25 - EAST | 11 | 1 | 12 |
| ESTADO PROYECTO PC25 - VILLAGE | 9 | 1 | 10 |
| ESTADO PROYECTO PC25 - WEST | 11 | 1 | 12 |
| FINANCIACIÓN | 11 | 1 | 12 |
| PROPERTY MANAGEMENT | 5 | 0 | 5 |
| SITUACIÓN FINANCIERA | 3 | 0 | 3 |
| SOCIETARIO | 1 | 0 | 1 |

## 12. Top 10 elementos por log_entries

| # | Elemento | Categoría | Entradas |
|---|----------|-----------|----------:|
| 1 | Marketing | COMERCIAL | 27 |
| 2 | Integración con Operador | COMERCIAL | 24 |
| 3 | Gobernanza | SOCIETARIO | 21 |
| 4 | Informe | SITUACIÓN FINANCIERA | 21 |
| 5 | Acometidas | ESTADO PROYECTO PC25 - EAST | 20 |
| 6 | Tramitación de licencias | ESTADO PROYECTO PC25 - VILLAGE | 20 |
| 7 | Flujo de caja | SITUACIÓN FINANCIERA | 19 |
| 8 | Seguros | PROPERTY MANAGEMENT | 19 |
| 9 | Tramitación de licencias | ESTADO PROYECTO PC25 - EAST | 19 |
| 10 | Tramitación de licencias | ESTADO PROYECTO PC25 - WEST | 19 |

## 13. Elementos sin log_entry

**1** elemento(s) — puede ser ruido o ítems sin columna Texto:

- Suministros (PROPERTY MANAGEMENT)

## 14. Cambios de estado por elemento

**15** elemento(s) con al menos un cambio:

### Integración con Operador

- 2025-10-02: `working_on_it` → `done`
- 2025-11-13: `done` → `working_on_it`
- 2026-05-12: `working_on_it` → `done`
- 2026-05-12: `done` → `working_on_it`
- 2026-05-12: `working_on_it` → `done`
- 2026-05-12: `done` → `working_on_it`
- 2026-05-12: `working_on_it` → `done`
- 2026-05-14: `done` → `working_on_it`

### Tasación

- 2026-05-14: `not_started` → `working_on_it`

### Acometidas

- 2025-11-27: `not_started` → `working_on_it`

### Paisajismo

- 2025-11-27: `not_started` → `working_on_it`

### Planificación

- 2026-05-14: `not_started` → `working_on_it`

### Acometidas

- 2025-11-27: `not_started` → `working_on_it`

### Paisajismo

- 2025-11-27: `not_started` → `working_on_it`

### Sostenibilidad

- 2026-02-12: `not_started` → `working_on_it`

### Planificación

- 2026-05-14: `not_started` → `working_on_it`

### Acometidas

- 2025-11-27: `not_started` → `working_on_it`

### Planificación

- 2026-05-14: `not_started` → `working_on_it`

### Reclamación deuda

- 2025-11-27: `not_started` → `working_on_it`

### Negociación compra pro indiviso

- 2025-11-27: `not_started` → `working_on_it`
- 2026-01-15: `working_on_it` → `done`

### Trámite división cosa común

- 2025-11-27: `not_started` → `working_on_it`
- 2026-01-15: `working_on_it` → `done`

### Anteproyecto

- 2026-03-19: `not_started` → `working_on_it`

## 15. Authors únicos

| author_id | log_entries |
|-----------|------------:|
| `ab3641c7-9309-49f0-bf50-674ef29bf3a0` | 322 |
| `9b278801-f806-47a2-ae0c-373a323416ca` | 85 |
| `891b61f5-7c97-4183-b3d9-5879a160d1e9` | 51 |
| `99638d20-2c0e-49b4-b2b5-e4f695d6c493` | 23 |
| `dd3b4116-f02e-4ca4-bc26-656abc7bf64e` | 22 |
| `881d130d-ac74-457e-87ab-3248d332c5ac` | 19 |
| `bb0336dc-eb63-42aa-955d-5aea684c3602` | 14 |

_Además 108 log_entry(s) con author_id null._

## 16. Distribución de log_entries por mes

| Mes | Entradas |
|-----|----------:|
| 2025-06 | 14 |
| 2025-07 | 11 |
| 2025-10 | 133 |
| 2025-11 | 60 |
| 2025-12 | 25 |
| 2026-01 | 25 |
| 2026-02 | 54 |
| 2026-03 | 66 |
| 2026-04 | 77 |
| 2026-05 | 179 |

**Huecos temporales detectados:**

- hueco entre 2025-07 y 2025-10

## Resumen transform_stats

```json
{
  "snapshots_processed": 40,
  "snapshots_discarded_stubs": 35,
  "snapshots_discarded_duplicado": 0,
  "snapshots_discarded_subelementos": 40,
  "snapshots_discarded_unparsed": 0,
  "snapshots_same_day_count": 4,
  "elements_total": 74,
  "elements_mapped": 68,
  "elements_custom": 6,
  "log_entries_total": 644,
  "log_entries_by_source": {
    "snapshot": 644,
    "monday_update": 0
  }
}
```
