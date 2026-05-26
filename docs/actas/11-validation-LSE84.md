# Validación pre-load — LSE84

Generado: 2026-05-26T12:49:42.827Z

Origen: `tmp/monday-transformed/LSE84.json`

## Resultado

**OK** — checks 1–10 pasados.

**Warnings:** 1

- **13_elements_without_log_entries**: 1 elemento(s) sin ninguna log_entry (_Suministros_)

## 11. Elementos mapped vs custom por categoría

| Categoría | Mapped | Custom | Total |
|-----------|-------:|-------:|------:|
| COMERCIAL | 2 | 0 | 2 |
| FINANCIACIÓN | 1 | 0 | 1 |
| PROPERTY MANAGEMENT | 8 | 1 | 9 |
| SITUACIÓN FINANCIERA | 3 | 0 | 3 |
| SL - SOCIETARIO | 1 | 0 | 1 |
| SOCIETARIO | 1 | 0 | 1 |

## 12. Top 10 elementos por log_entries

| # | Elemento | Categoría | Entradas |
|---|----------|-----------|----------:|
| 1 | Estado arrendamiento PS | COMERCIAL | 32 |
| 2 | Estado arrendamiento PB | COMERCIAL | 31 |
| 3 | Afecciones de obra | PROPERTY MANAGEMENT | 30 |
| 4 | Informe | SITUACIÓN FINANCIERA | 16 |
| 5 | Flujo de caja | SITUACIÓN FINANCIERA | 16 |
| 6 | Comunidad de propietarios | PROPERTY MANAGEMENT | 16 |
| 7 | Gobernanza | SL - SOCIETARIO | 13 |
| 8 | Agua | PROPERTY MANAGEMENT | 10 |
| 9 | Reparto intereses | SITUACIÓN FINANCIERA | 7 |
| 10 | Fianza | PROPERTY MANAGEMENT | 6 |

## 13. Elementos sin log_entry

**1** elemento(s) — puede ser ruido o ítems sin columna Texto:

- Suministros (PROPERTY MANAGEMENT)

## 14. Cambios de estado por elemento

**6** elemento(s) con al menos un cambio:

### Reparto intereses

- 2025-09-04: `not_started` → `working_on_it`

### Estado arrendamiento PB

- 2025-07-31: `working_on_it` → `stuck`

### Estado arrendamiento PS

- 2025-07-23: `working_on_it` → `stuck`

### Fianza

- 2025-12-10: `working_on_it` → `done`

### Documentación inquilino

- 2025-07-23: `not_started` → `working_on_it`
- 2025-09-04: `working_on_it` → `done`

### Contrato con LALALA

- 2026-05-14: `not_started` → `working_on_it`

## 15. Authors únicos

| author_id | log_entries |
|-----------|------------:|
| `9eeb84ac-c8f9-4473-b03d-34bdb873c3e7` | 69 |
| `891b61f5-7c97-4183-b3d9-5879a160d1e9` | 38 |
| `881d130d-ac74-457e-87ab-3248d332c5ac` | 30 |
| `92a807f9-6f77-4a7d-954c-6132d8ea84ae` | 16 |
| `dd3b4116-f02e-4ca4-bc26-656abc7bf64e` | 14 |
| `bb0336dc-eb63-42aa-955d-5aea684c3602` | 1 |

_Además 23 log_entry(s) con author_id null._

## 16. Distribución de log_entries por mes

| Mes | Entradas |
|-----|----------:|
| 2025-02 | 18 |
| 2025-03 | 9 |
| 2025-04 | 8 |
| 2025-05 | 3 |
| 2025-06 | 15 |
| 2025-07 | 21 |
| 2025-08 | 3 |
| 2025-09 | 23 |
| 2025-10 | 21 |
| 2025-11 | 7 |
| 2025-12 | 14 |
| 2026-01 | 7 |
| 2026-02 | 10 |
| 2026-03 | 8 |
| 2026-04 | 9 |
| 2026-05 | 15 |

_Serie mensual continua (sin huecos entre primer y último mes)._

## Resumen transform_stats

```json
{
  "snapshots_processed": 49,
  "snapshots_discarded_stubs": 35,
  "snapshots_discarded_duplicado": 0,
  "snapshots_discarded_subelementos": 49,
  "snapshots_discarded_unparsed": 0,
  "snapshots_same_day_count": 7,
  "elements_total": 17,
  "elements_mapped": 16,
  "elements_custom": 1,
  "log_entries_total": 191,
  "log_entries_by_source": {
    "snapshot": 191,
    "monday_update": 0
  }
}
```
