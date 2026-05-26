# Validación pre-load — GQ8

Generado: 2026-05-26T11:45:01.168Z

Origen: `tmp/monday-transformed/GQ8.json`

## Resultado

**OK** — checks 1–10 pasados.

**Warnings:** 1

- **13_elements_without_log_entries**: 1 elemento(s) sin ninguna log_entry (_Comunidad de propietarios_)

## 11. Elementos mapped vs custom por categoría

| Categoría | Mapped | Custom | Total |
|-----------|-------:|-------:|------:|
| COMERCIAL | 4 | 0 | 4 |
| ESTADO PROYECTO | 17 | 3 | 20 |
| FINANCIACIÓN | 15 | 0 | 15 |
| PROPERTY MANAGEMENT | 12 | 2 | 14 |
| SITUACIÓN FINANCIERA | 3 | 0 | 3 |
| SOCIETARIO | 1 | 0 | 1 |

## 12. Top 10 elementos por log_entries

| # | Elemento | Categoría | Entradas |
|---|----------|-----------|----------:|
| 1 | Tramitación licencia | ESTADO PROYECTO | 37 |
| 2 | Inquilinos Oficinas | COMERCIAL | 27 |
| 3 | Licitación de Obra | ESTADO PROYECTO | 26 |
| 4 | Proyecto de Arquitectura | ESTADO PROYECTO | 24 |
| 5 | Presupuesto obra | ESTADO PROYECTO | 24 |
| 6 | Informe | SITUACIÓN FINANCIERA | 23 |
| 7 | Flujo de caja | SITUACIÓN FINANCIERA | 22 |
| 8 | Inicio Obra | ESTADO PROYECTO | 20 |
| 9 | Gobernanza | SOCIETARIO | 19 |
| 10 | Sostenibilidad | ESTADO PROYECTO | 18 |

## 13. Elementos sin log_entry

**1** elemento(s) — puede ser ruido o ítems sin columna Texto:

- Comunidad de propietarios (ESTADO PROYECTO)

## 14. Cambios de estado por elemento

**7** elemento(s) con al menos un cambio:

### Proyecto de Arquitectura

- 2026-03-19: `working_on_it` → `done`
- 2026-05-20: `done` → `working_on_it`

### CT / LGA

- 2025-09-04: `not_started` → `working_on_it`

### Saneamiento

- 2025-11-27: `not_started` → `working_on_it`

### Inicio actuaciones previas

- 2026-04-09: `not_started` → `working_on_it`
- 2026-05-20: `working_on_it` → `not_started`

### Marketing

- 2025-11-13: `not_started` → `working_on_it`

### Lona publicitaria

- 2026-03-26: `not_started` → `working_on_it`

### Afecciones

- 2026-03-19: `not_started` → `working_on_it`

## 15. Authors únicos

| author_id | log_entries |
|-----------|------------:|
| `ab3641c7-9309-49f0-bf50-674ef29bf3a0` | 159 |
| `bb0336dc-eb63-42aa-955d-5aea684c3602` | 47 |
| `891b61f5-7c97-4183-b3d9-5879a160d1e9` | 45 |
| `23adb385-c9bd-4429-b5a8-6acc414220ec` | 31 |
| `dd3b4116-f02e-4ca4-bc26-656abc7bf64e` | 19 |
| `881d130d-ac74-457e-87ab-3248d332c5ac` | 7 |

_Además 139 log_entry(s) con author_id null._

## 16. Distribución de log_entries por mes

| Mes | Entradas |
|-----|----------:|
| 2025-01 | 50 |
| 2025-02 | 11 |
| 2025-03 | 13 |
| 2025-04 | 12 |
| 2025-05 | 24 |
| 2025-06 | 14 |
| 2025-07 | 15 |
| 2025-08 | 8 |
| 2025-09 | 27 |
| 2025-10 | 48 |
| 2025-11 | 40 |
| 2025-12 | 10 |
| 2026-01 | 33 |
| 2026-02 | 21 |
| 2026-03 | 51 |
| 2026-04 | 19 |
| 2026-05 | 51 |

_Serie mensual continua (sin huecos entre primer y último mes)._

## Resumen transform_stats

```json
{
  "snapshots_processed": 51,
  "snapshots_discarded_stubs": 31,
  "snapshots_discarded_duplicado": 1,
  "snapshots_discarded_subelementos": 51,
  "snapshots_discarded_unparsed": 0,
  "snapshots_same_day_count": 5,
  "elements_total": 57,
  "elements_mapped": 52,
  "elements_custom": 5,
  "log_entries_total": 447,
  "log_entries_by_source": {
    "snapshot": 447,
    "monday_update": 0
  }
}
```
