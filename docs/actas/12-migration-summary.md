# Resumen migración Monday → Supabase (P3.5)

**Generado:** 2026-05-26T13:34:37.304Z
**Workspace Actas:** `8115808`

## Totales

| Métrica | Valor |
| --- | --- |
| Proyectos detectados (Monday) | 11 |
| Ya existentes en BD (omitidos) | 1 |
| Pendientes al inicio | 10 |
| Staging completado (extract+transform+validate+dry-run) | 10 |
| Carga real confirmada | sí |
| Cargados en BD (esta ejecución) | 10 |
| Fallo en carga real | — |

### Códigos ya existentes (skipped)

`GQ8`

## Por proyecto (staging)

| code | snapshots | elements | log_entries | fechas | warnings validate |
| --- | ---: | ---: | ---: | --- | ---: |
| CA1 | 13 | 54 | 151 | 2025-12-11 … 2026-05-22 | 1 |
| CSP10 | 35 | 25 | 292 | 2025-12-18 … 2026-05-21 | 1 |
| DC15 | 51 | 46 | 531 | 2025-01-16 … 2026-05-14 | 0 |
| LSE84 | 49 | 17 | 191 | 2025-02-20 … 2026-05-14 | 1 |
| PC25 | 40 | 74 | 644 | 2025-06-19 … 2026-05-14 | 1 |
| SA31 | 55 | 68 | 732 | 2025-01-09 … 2026-05-14 | 1 |
| SE84 | 52 | 28 | 400 | 2025-01-09 … 2026-05-14 | 1 |
| SICC II | 0 | 0 | 0 | — | 0 |
| VBARE | 1 | 136 | 95 | 2025-01-08 … 2026-05-13 | 1 |
| VE1 | 26 | 145 | 244 | 2025-12-18 … 2026-05-26 | 1 |

### CA1

- Extract: `C:\Users\Javier Canas\Documents\icam_dashboard\tmp\monday-extracts\CA1.json`
- Transformado: `C:\Users\Javier Canas\Documents\icam_dashboard\tmp\monday-transformed\CA1.json`
- Validación: `C:\Users\Javier Canas\Documents\icam_dashboard\docs\actas\11-validation-CA1.md`
- Elementos: 44 mapped + 10 custom
- log_entry author_id NULL: 92

**Warnings validación:**

- **13_elements_without_log_entries**: 5 elemento(s) sin ninguna log_entry

**Warnings load (dry-run):**

- log_entries en JSON no venían en orden cronológico; se reordenaron por entry_date ASC al insertar.
- 5 elemento(s) sin log_entry: Levantamiento de Capital, Suministros, Tramo construcción, Bajo nfikwjnj, Operaciones

### CSP10

- Extract: `C:\Users\Javier Canas\Documents\icam_dashboard\tmp\monday-extracts\CSP10.json`
- Transformado: `C:\Users\Javier Canas\Documents\icam_dashboard\tmp\monday-transformed\CSP10.json`
- Validación: `C:\Users\Javier Canas\Documents\icam_dashboard\docs\actas\11-validation-CSP10.md`
- Elementos: 25 mapped + 0 custom
- log_entry author_id NULL: 84

**Warnings validación:**

- **13_elements_without_log_entries**: 1 elemento(s) sin ninguna log_entry

**Warnings load (dry-run):**

- log_entries en JSON no venían en orden cronológico; se reordenaron por entry_date ASC al insertar.
- 1 elemento(s) sin log_entry: Suministros

### DC15

- Extract: `C:\Users\Javier Canas\Documents\icam_dashboard\tmp\monday-extracts\DC15.json`
- Transformado: `C:\Users\Javier Canas\Documents\icam_dashboard\tmp\monday-transformed\DC15.json`
- Validación: `C:\Users\Javier Canas\Documents\icam_dashboard\docs\actas\11-validation-DC15.md`
- Elementos: 45 mapped + 1 custom
- log_entry author_id NULL: 142

**Warnings validación:**

_Ninguno._

**Warnings load (dry-run):**

- log_entries en JSON no venían en orden cronológico; se reordenaron por entry_date ASC al insertar.

### LSE84

- Extract: `C:\Users\Javier Canas\Documents\icam_dashboard\tmp\monday-extracts\LSE84.json`
- Transformado: `C:\Users\Javier Canas\Documents\icam_dashboard\tmp\monday-transformed\LSE84.json`
- Validación: `C:\Users\Javier Canas\Documents\icam_dashboard\docs\actas\11-validation-LSE84.md`
- Elementos: 16 mapped + 1 custom
- log_entry author_id NULL: 23

**Warnings validación:**

- **13_elements_without_log_entries**: 1 elemento(s) sin ninguna log_entry

**Warnings load (dry-run):**

- log_entries en JSON no venían en orden cronológico; se reordenaron por entry_date ASC al insertar.
- 1 elemento(s) sin log_entry: Suministros

### PC25

- Extract: `C:\Users\Javier Canas\Documents\icam_dashboard\tmp\monday-extracts\PC25.json`
- Transformado: `C:\Users\Javier Canas\Documents\icam_dashboard\tmp\monday-transformed\PC25.json`
- Validación: `C:\Users\Javier Canas\Documents\icam_dashboard\docs\actas\11-validation-PC25.md`
- Elementos: 68 mapped + 6 custom
- log_entry author_id NULL: 108

**Warnings validación:**

- **13_elements_without_log_entries**: 1 elemento(s) sin ninguna log_entry

**Warnings load (dry-run):**

- log_entries en JSON no venían en orden cronológico; se reordenaron por entry_date ASC al insertar.
- 1 elemento(s) sin log_entry: Suministros

### SA31

- Extract: `C:\Users\Javier Canas\Documents\icam_dashboard\tmp\monday-extracts\SA31.json`
- Transformado: `C:\Users\Javier Canas\Documents\icam_dashboard\tmp\monday-transformed\SA31.json`
- Validación: `C:\Users\Javier Canas\Documents\icam_dashboard\docs\actas\11-validation-SA31.md`
- Elementos: 61 mapped + 7 custom
- log_entry author_id NULL: 255

**Warnings validación:**

- **13_elements_without_log_entries**: 3 elemento(s) sin ninguna log_entry

**Warnings load (dry-run):**

- log_entries en JSON no venían en orden cronológico; se reordenaron por entry_date ASC al insertar.
- 3 elemento(s) sin log_entry: Suministros, Seguro de afianzamiento, Venta

### SE84

- Extract: `C:\Users\Javier Canas\Documents\icam_dashboard\tmp\monday-extracts\SE84.json`
- Transformado: `C:\Users\Javier Canas\Documents\icam_dashboard\tmp\monday-transformed\SE84.json`
- Validación: `C:\Users\Javier Canas\Documents\icam_dashboard\docs\actas\11-validation-SE84.md`
- Elementos: 26 mapped + 2 custom
- log_entry author_id NULL: 92

**Warnings validación:**

- **13_elements_without_log_entries**: 1 elemento(s) sin ninguna log_entry

**Warnings load (dry-run):**

- log_entries en JSON no venían en orden cronológico; se reordenaron por entry_date ASC al insertar.
- 1 elemento(s) sin log_entry: Suministros

### SICC II

- Extract: `C:\Users\Javier Canas\Documents\icam_dashboard\tmp\monday-extracts\SICC II.json`
- Transformado: `C:\Users\Javier Canas\Documents\icam_dashboard\tmp\monday-transformed\SICC II.json`
- Validación: `C:\Users\Javier Canas\Documents\icam_dashboard\docs\actas\11-validation-SICC II.md`
- Elementos: 0 mapped + 0 custom
- log_entry author_id NULL: 0

**Warnings validación:**

_Ninguno._

### VBARE

- Extract: `C:\Users\Javier Canas\Documents\icam_dashboard\tmp\monday-extracts\VBARE.json`
- Transformado: `C:\Users\Javier Canas\Documents\icam_dashboard\tmp\monday-transformed\VBARE.json`
- Validación: `C:\Users\Javier Canas\Documents\icam_dashboard\docs\actas\11-validation-VBARE.md`
- Elementos: 26 mapped + 110 custom
- log_entry author_id NULL: 90

**Warnings validación:**

- **13_elements_without_log_entries**: 46 elemento(s) sin ninguna log_entry

**Warnings load (dry-run):**

- log_entries en JSON no venían en orden cronológico; se reordenaron por entry_date ASC al insertar.
- 46 elemento(s) sin log_entry: Estado capex/reparaciones, Estado litigios, Venta, Estado litigios, Estado Alquiler, Estado capex/reparaciones, Estado litigios, Venta, Estado Alquiler, Estado capex/reparaciones, Estado litigios, Venta, Estado Alquiler, Estado capex/reparaciones, Estado litigios, Venta, Estado Alquiler, Estado capex/reparaciones, Estado litigios, Venta, Estado Alquiler, Estado litigios, Venta, Estado Alquiler, Estado capex/reparaciones, Estado litigios, Estado capex/reparaciones, Estado litigios, Venta, Interés, Estado Alquiler, Estado litigios, Venta, Estado Alquiler, Estado litigios, Estado litigios, Estado litigios, Estado litigios, Estado de alquiler, Estado litigios, Venta, GENERAL, IVA, Estrategia General, Resumen hitos, Problemas o tomas de decisiones a adoptar

### VE1

- Extract: `C:\Users\Javier Canas\Documents\icam_dashboard\tmp\monday-extracts\VE1.json`
- Transformado: `C:\Users\Javier Canas\Documents\icam_dashboard\tmp\monday-transformed\VE1.json`
- Validación: `C:\Users\Javier Canas\Documents\icam_dashboard\docs\actas\11-validation-VE1.md`
- Elementos: 29 mapped + 116 custom
- log_entry author_id NULL: 175

**Warnings validación:**

- **13_elements_without_log_entries**: 75 elemento(s) sin ninguna log_entry

**Warnings load (dry-run):**

- log_entries en JSON no venían en orden cronológico; se reordenaron por entry_date ASC al insertar.
- 75 elemento(s) sin log_entry: Bajo A (interior), 1ºA, 1ºB, 1ºC, 1ºE, 1ºF, 1ºG (interior), 2ºA, 2ºB, 2ºC, 2ºD, 2ºE, 2ºF, 2ºG (interior), 3ºA, 3ºB, 3ºC, 3ºD, 3ºE, 3ºF, 3ºG (interior), 4ºA, 4ºB (terraza), 4ºC, 4ºE (terraza), 1ºB, 1ºC, 1ºF, 2ºA, 2ºC, 2ºD, 2ºE, 2ºF, 2ºG (interior), 3ºA, 3ºC, 3ºD, 3ºG (interior), Bajo A (interior), 1ºA, 1ºB, 1ºC, 1ºE, 1ºF, 1ºG (interior), 2ºA, 2ºB, 2ºC, 2ºD, 2ºE, 2ºF, 2ºG (interior), 3ºA, 3ºB, 3ºC, 3ºD, 3ºE, 3ºF, 3ºG (interior), 4ºA, 4ºB (terraza), 4ºE (terraza), 1ºB, 1ºC, 1ºF, 2ºA, 2ºD, 2ºE, 2ºF, 2ºG (interior), 3ºA, 3ºD, 4ºC, 4ºE (terraza), Suministros

## Carga real (Fase 4)

| code | project.id | log_entries | fechas |
| --- | --- | ---: | --- |
| CA1 | `8d4e3b8a-a8d7-442f-babd-bda1f082b5d0` | 151 | 2025-12-11 … 2026-05-22 |
| CSP10 | `15e033af-a0e2-4669-8f2a-b3e7580c6403` | 292 | 2025-12-18 … 2026-05-21 |
| DC15 | `51d3d23e-88e7-461d-828a-31480c987124` | 531 | 2025-01-16 … 2026-05-14 |
| LSE84 | `5a876c95-18b9-423a-827d-003d18cc97df` | 191 | 2025-02-20 … 2026-05-14 |
| PC25 | `025c41d1-1fa4-4b7a-8422-84f69c34526c` | 644 | 2025-06-19 … 2026-05-14 |
| SA31 | `f2c64ed0-e6bc-4499-a5d1-27bbdb0c93ad` | 732 | 2025-01-09 … 2026-05-14 |
| SE84 | `b7eeeb50-90f7-4f36-95c5-7f90b77f4909` | 400 | 2025-01-09 … 2026-05-14 |
| SICC II | `2957b929-88fd-4f4d-8989-dd617c578aad` | 0 | — |
| VBARE | `37d5d768-8318-42ba-983a-bd46fc2d5f56` | 95 | 2025-01-08 … 2026-05-13 |
| VE1 | `095ffb55-2810-4db0-a8df-6140d4a04c70` | 244 | 2025-12-18 … 2026-05-26 |

