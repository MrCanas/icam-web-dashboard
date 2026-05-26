# Validación pre-load — VE1

Generado: 2026-05-26T13:10:04.951Z

Origen: `tmp/monday-transformed/VE1.json`

## Resultado

**OK** — checks 1–10 pasados.

**Warnings:** 1

- **13_elements_without_log_entries**: 75 elemento(s) sin ninguna log_entry (_Bajo A (interior), 1ºA, 1ºB, 1ºC, 1ºE_)

## 11. Elementos mapped vs custom por categoría

| Categoría | Mapped | Custom | Total |
|-----------|-------:|-------:|------:|
| COMERCIAL | 4 | 116 | 120 |
| ESTADO PROYECTO | 6 | 0 | 6 |
| FINANCIACIÓN | 1 | 0 | 1 |
| PROPERTY MANAGEMENT | 9 | 0 | 9 |
| SITUACIÓN FINANCIERA | 3 | 0 | 3 |
| SOCIETARIO | 6 | 0 | 6 |

## 12. Top 10 elementos por log_entries

| # | Elemento | Categoría | Entradas |
|---|----------|-----------|----------:|
| 1 | Inicio Obra | ESTADO PROYECTO | 14 |
| 2 | Saneamiento | PROPERTY MANAGEMENT | 13 |
| 3 | Gobernanza | SOCIETARIO | 10 |
| 4 | Interiorismo | ESTADO PROYECTO | 9 |
| 5 | Compraventa | SOCIETARIO | 7 |
| 6 | Presupuesto obra | ESTADO PROYECTO | 7 |
| 7 | Seguros | PROPERTY MANAGEMENT | 7 |
| 8 | Comercialización | COMERCIAL | 6 |
| 9 | Reforma | COMERCIAL | 6 |
| 10 | 4ºA | COMERCIAL | 6 |

## 13. Elementos sin log_entry

**75** elemento(s) — puede ser ruido o ítems sin columna Texto:

- Bajo A (interior) (COMERCIAL)
- 1ºA (COMERCIAL)
- 1ºB (COMERCIAL)
- 1ºC (COMERCIAL)
- 1ºE (COMERCIAL)
- 1ºF (COMERCIAL)
- 1ºG (interior) (COMERCIAL)
- 2ºA (COMERCIAL)
- 2ºB (COMERCIAL)
- 2ºC (COMERCIAL)
- 2ºD (COMERCIAL)
- 2ºE (COMERCIAL)
- 2ºF (COMERCIAL)
- 2ºG (interior) (COMERCIAL)
- 3ºA (COMERCIAL)
- 3ºB (COMERCIAL)
- 3ºC (COMERCIAL)
- 3ºD (COMERCIAL)
- 3ºE (COMERCIAL)
- 3ºF (COMERCIAL)
- 3ºG (interior) (COMERCIAL)
- 4ºA (COMERCIAL)
- 4ºB (terraza) (COMERCIAL)
- 4ºC (COMERCIAL)
- 4ºE (terraza) (COMERCIAL)
- 1ºB (COMERCIAL)
- 1ºC (COMERCIAL)
- 1ºF (COMERCIAL)
- 2ºA (COMERCIAL)
- 2ºC (COMERCIAL)
- 2ºD (COMERCIAL)
- 2ºE (COMERCIAL)
- 2ºF (COMERCIAL)
- 2ºG (interior) (COMERCIAL)
- 3ºA (COMERCIAL)
- 3ºC (COMERCIAL)
- 3ºD (COMERCIAL)
- 3ºG (interior) (COMERCIAL)
- Bajo A (interior) (COMERCIAL)
- 1ºA (COMERCIAL)
- 1ºB (COMERCIAL)
- 1ºC (COMERCIAL)
- 1ºE (COMERCIAL)
- 1ºF (COMERCIAL)
- 1ºG (interior) (COMERCIAL)
- 2ºA (COMERCIAL)
- 2ºB (COMERCIAL)
- 2ºC (COMERCIAL)
- 2ºD (COMERCIAL)
- 2ºE (COMERCIAL)
- 2ºF (COMERCIAL)
- 2ºG (interior) (COMERCIAL)
- 3ºA (COMERCIAL)
- 3ºB (COMERCIAL)
- 3ºC (COMERCIAL)
- 3ºD (COMERCIAL)
- 3ºE (COMERCIAL)
- 3ºF (COMERCIAL)
- 3ºG (interior) (COMERCIAL)
- 4ºA (COMERCIAL)
- 4ºB (terraza) (COMERCIAL)
- 4ºE (terraza) (COMERCIAL)
- 1ºB (COMERCIAL)
- 1ºC (COMERCIAL)
- 1ºF (COMERCIAL)
- 2ºA (COMERCIAL)
- 2ºD (COMERCIAL)
- 2ºE (COMERCIAL)
- 2ºF (COMERCIAL)
- 2ºG (interior) (COMERCIAL)
- 3ºA (COMERCIAL)
- 3ºD (COMERCIAL)
- 4ºC (COMERCIAL)
- 4ºE (terraza) (COMERCIAL)
- Suministros (PROPERTY MANAGEMENT)

## 14. Cambios de estado por elemento

**3** elemento(s) con al menos un cambio:

### Gobernanza

- 2026-01-29: `not_started` → `done`
- 2026-05-26: `done` → `not_started`

### Compraventa

- 2026-01-15: `not_started` → `done`
- 2026-05-26: `done` → `not_started`

### Tramitación de licencias

- 2026-05-22: `working_on_it` → `done`
- 2026-05-26: `done` → `working_on_it`

## 15. Authors únicos

| author_id | log_entries |
|-----------|------------:|
| `1240dcf7-ce10-4beb-9ee5-7f0cbe6fe176` | 27 |
| `dd3b4116-f02e-4ca4-bc26-656abc7bf64e` | 10 |
| `23adb385-c9bd-4429-b5a8-6acc414220ec` | 9 |
| `891b61f5-7c97-4183-b3d9-5879a160d1e9` | 9 |
| `881d130d-ac74-457e-87ab-3248d332c5ac` | 7 |
| `bb0336dc-eb63-42aa-955d-5aea684c3602` | 4 |
| `d9e72968-5e14-4a43-b49e-839614b80caf` | 3 |

_Además 175 log_entry(s) con author_id null._

## 16. Distribución de log_entries por mes

| Mes | Entradas |
|-----|----------:|
| 2025-12 | 89 |
| 2026-01 | 17 |
| 2026-02 | 22 |
| 2026-05 | 116 |

**Huecos temporales detectados:**

- hueco entre 2026-02 y 2026-05

## Resumen transform_stats

```json
{
  "snapshots_processed": 26,
  "snapshots_discarded_stubs": 10,
  "snapshots_discarded_duplicado": 0,
  "snapshots_discarded_subelementos": 26,
  "snapshots_discarded_unparsed": 0,
  "snapshots_same_day_count": 1,
  "elements_total": 145,
  "elements_mapped": 29,
  "elements_custom": 116,
  "log_entries_total": 244,
  "log_entries_by_source": {
    "snapshot": 244,
    "monday_update": 0
  }
}
```
