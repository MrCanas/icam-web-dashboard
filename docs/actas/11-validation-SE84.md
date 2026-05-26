# Validación pre-load — SE84

Generado: 2026-05-26T13:01:38.701Z

Origen: `tmp/monday-transformed/SE84.json`

## Resultado

**OK** — checks 1–10 pasados.

**Warnings:** 1

- **13_elements_without_log_entries**: 1 elemento(s) sin ninguna log_entry (_Suministros_)

## 11. Elementos mapped vs custom por categoría

| Categoría | Mapped | Custom | Total |
|-----------|-------:|-------:|------:|
| COMERCIAL | 4 | 1 | 5 |
| ESTADO PROYECTO | 9 | 1 | 10 |
| FINANCIACIÓN | 2 | 0 | 2 |
| PROPERTY MANAGEMENT | 7 | 0 | 7 |
| SITUACIÓN FINANCIERA | 3 | 0 | 3 |
| SOCIETARIO | 1 | 0 | 1 |

## 12. Top 10 elementos por log_entries

| # | Elemento | Categoría | Entradas |
|---|----------|-----------|----------:|
| 1 | Sostenibilidad | ESTADO PROYECTO | 32 |
| 2 | Integración con Operador | COMERCIAL | 32 |
| 3 | Afecciones | PROPERTY MANAGEMENT | 32 |
| 4 | Agua | PROPERTY MANAGEMENT | 26 |
| 5 | Obra | ESTADO PROYECTO | 26 |
| 6 | Comunidad de Propietarios | COMERCIAL | 25 |
| 7 | Monitoring | FINANCIACIÓN | 25 |
| 8 | Flujo de caja | SITUACIÓN FINANCIERA | 22 |
| 9 | Informe | SITUACIÓN FINANCIERA | 20 |
| 10 | Seguros | PROPERTY MANAGEMENT | 17 |

## 13. Elementos sin log_entry

**1** elemento(s) — puede ser ruido o ítems sin columna Texto:

- Suministros (PROPERTY MANAGEMENT)

## 14. Cambios de estado por elemento

**10** elemento(s) con al menos un cambio:

### Tramitación licencia

- 2025-04-24: `working_on_it` → `done`

### Presupuesto obra | Licitación

- 2025-04-24: `working_on_it` → `done`

### Inicio Obra

- 2025-05-22: `working_on_it` → `done`

### Interiorismo

- 2025-04-24: `working_on_it` → `done`

### Local comercial

- 2025-02-20: `working_on_it` → `done`

### Lona publicitaria

- 2026-03-19: `working_on_it` → `done`

### Inquilino

- 2026-05-14: `not_started` → `working_on_it`

### Seguros

- 2025-06-26: `working_on_it` → `done`

### Afecciones

- 2025-04-10: `not_started` → `working_on_it`
- 2025-09-17: `working_on_it` → `done`
- 2025-10-02: `done` → `working_on_it`

### Monitoring

- 2025-04-10: `not_started` → `working_on_it`

## 15. Authors únicos

| author_id | log_entries |
|-----------|------------:|
| `ab3641c7-9309-49f0-bf50-674ef29bf3a0` | 178 |
| `891b61f5-7c97-4183-b3d9-5879a160d1e9` | 45 |
| `881d130d-ac74-457e-87ab-3248d332c5ac` | 40 |
| `1240dcf7-ce10-4beb-9ee5-7f0cbe6fe176` | 16 |
| `0e9f9a42-16c3-43f5-861e-78e8448fcfa1` | 11 |
| `dd3b4116-f02e-4ca4-bc26-656abc7bf64e` | 10 |
| `bb0336dc-eb63-42aa-955d-5aea684c3602` | 8 |

_Además 92 log_entry(s) con author_id null._

## 16. Distribución de log_entries por mes

| Mes | Entradas |
|-----|----------:|
| 2025-01 | 45 |
| 2025-02 | 24 |
| 2025-03 | 14 |
| 2025-04 | 25 |
| 2025-05 | 13 |
| 2025-06 | 18 |
| 2025-07 | 20 |
| 2025-08 | 12 |
| 2025-09 | 41 |
| 2025-10 | 53 |
| 2025-11 | 26 |
| 2025-12 | 16 |
| 2026-01 | 10 |
| 2026-02 | 21 |
| 2026-03 | 16 |
| 2026-04 | 33 |
| 2026-05 | 13 |

_Serie mensual continua (sin huecos entre primer y último mes)._

## Resumen transform_stats

```json
{
  "snapshots_processed": 52,
  "snapshots_discarded_stubs": 32,
  "snapshots_discarded_duplicado": 0,
  "snapshots_discarded_subelementos": 52,
  "snapshots_discarded_unparsed": 0,
  "snapshots_same_day_count": 1,
  "elements_total": 28,
  "elements_mapped": 26,
  "elements_custom": 2,
  "log_entries_total": 400,
  "log_entries_by_source": {
    "snapshot": 400,
    "monday_update": 0
  }
}
```
