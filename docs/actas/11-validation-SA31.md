# Validación pre-load — SA31

Generado: 2026-05-26T12:57:08.485Z

Origen: `tmp/monday-transformed/SA31.json`

## Resultado

**OK** — checks 1–10 pasados.

**Warnings:** 1

- **13_elements_without_log_entries**: 3 elemento(s) sin ninguna log_entry (_Suministros, Seguro de afianzamiento, Ventas_)

## 11. Elementos mapped vs custom por categoría

| Categoría | Mapped | Custom | Total |
|-----------|-------:|-------:|------:|
| COMERCIAL | 4 | 5 | 9 |
| ESTADO PROYECTO | 16 | 2 | 18 |
| FINANCIACIÓN | 11 | 0 | 11 |
| OPERADOR HOTELERO | 6 | 0 | 6 |
| PROPERTY MANAGEMENT | 21 | 0 | 21 |
| SICC - SOCIETARIO | 1 | 0 | 1 |
| SITUACIÓN FINANCIERA | 2 | 0 | 2 |

## 12. Top 10 elementos por log_entries

| # | Elemento | Categoría | Entradas |
|---|----------|-----------|----------:|
| 1 | Marketing | COMERCIAL | 80 |
| 2 | Tramitación licencia | ESTADO PROYECTO | 42 |
| 3 | Proyecto de Arquitectura | ESTADO PROYECTO | 35 |
| 4 | Comercialización | COMERCIAL | 32 |
| 5 | Gobernanza | SICC - SOCIETARIO | 29 |
| 6 | Diseño | OPERADOR HOTELERO | 28 |
| 7 | Inquilino | COMERCIAL | 26 |
| 8 | Legal | OPERADOR HOTELERO | 26 |
| 9 | Marketing | OPERADOR HOTELERO | 25 |
| 10 | Interiorismo | ESTADO PROYECTO | 24 |

## 13. Elementos sin log_entry

**3** elemento(s) — puede ser ruido o ítems sin columna Texto:

- Suministros (PROPERTY MANAGEMENT)
- Seguro de afianzamiento (FINANCIACIÓN)
- Ventas (OPERADOR HOTELERO)

## 14. Cambios de estado por elemento

**11** elemento(s) con al menos un cambio:

### Peritación estructural

- 2025-01-30: `working_on_it` → `done`

### Inicio de obra

- 2025-03-06: `not_started` → `working_on_it`

### Estudio geotecnico

- 2025-02-06: `not_started` → `working_on_it`
- 2025-03-27: `working_on_it` → `done`

### Paisajismo

- 2025-02-13: `not_started` → `working_on_it`

### Domótica

- 2025-02-13: `not_started` → `working_on_it`

### Inquilino

- 2025-10-30: `working_on_it` → `done`

### Prestamo Promotor y Suelo

- 2025-09-11: `working_on_it` → `done`
- 2025-11-13: `done` → `working_on_it`

### Marketing

- 2026-04-30: `not_started` → `working_on_it`
- 2026-05-12: `working_on_it` → `not_started`
- 2026-05-14: `not_started` → `working_on_it`

### Legal

- 2026-04-30: `not_started` → `working_on_it`
- 2026-05-12: `working_on_it` → `not_started`
- 2026-05-14: `not_started` → `working_on_it`

### Diseño

- 2026-04-30: `not_started` → `working_on_it`
- 2026-05-12: `working_on_it` → `not_started`
- 2026-05-14: `not_started` → `working_on_it`

### Instalaciones

- 2026-04-30: `not_started` → `working_on_it`
- 2026-05-12: `working_on_it` → `not_started`
- 2026-05-14: `not_started` → `working_on_it`

## 15. Authors únicos

| author_id | log_entries |
|-----------|------------:|
| `9b278801-f806-47a2-ae0c-373a323416ca` | 309 |
| `dd3b4116-f02e-4ca4-bc26-656abc7bf64e` | 81 |
| `891b61f5-7c97-4183-b3d9-5879a160d1e9` | 41 |
| `bb0336dc-eb63-42aa-955d-5aea684c3602` | 26 |
| `99638d20-2c0e-49b4-b2b5-e4f695d6c493` | 13 |
| `881d130d-ac74-457e-87ab-3248d332c5ac` | 7 |

_Además 255 log_entry(s) con author_id null._

## 16. Distribución de log_entries por mes

| Mes | Entradas |
|-----|----------:|
| 2025-01 | 73 |
| 2025-02 | 94 |
| 2025-03 | 29 |
| 2025-04 | 22 |
| 2025-05 | 22 |
| 2025-06 | 25 |
| 2025-07 | 55 |
| 2025-08 | 3 |
| 2025-09 | 73 |
| 2025-10 | 72 |
| 2025-11 | 18 |
| 2025-12 | 66 |
| 2026-01 | 30 |
| 2026-02 | 20 |
| 2026-03 | 52 |
| 2026-04 | 32 |
| 2026-05 | 46 |

_Serie mensual continua (sin huecos entre primer y último mes)._

## Resumen transform_stats

```json
{
  "snapshots_processed": 55,
  "snapshots_discarded_stubs": 37,
  "snapshots_discarded_duplicado": 0,
  "snapshots_discarded_subelementos": 55,
  "snapshots_discarded_unparsed": 0,
  "snapshots_same_day_count": 6,
  "elements_total": 68,
  "elements_mapped": 61,
  "elements_custom": 7,
  "log_entries_total": 732,
  "log_entries_by_source": {
    "snapshot": 606,
    "monday_update": 126
  }
}
```
