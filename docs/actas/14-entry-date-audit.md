# Auditoría entry_date (log_entry vs tablero Monday)

Generado: 2026-06-09T14:53:59.236Z

## Procedencia y método

- **BD:** `log_entry` no tiene `snapshot_id`. La migración P3.5 (`monday-load`) insertó solo `element_id`, `content`, `status_*`, `entry_date` (sin columna `source` en el INSERT).
- **Columna `source`:** existe desde migración 007 (`snapshot` / `ui` / …) pero puede estar NULL en filas migradas.
- **Fecha esperada:** re-transform del extract (`tmp/monday-extracts/<CODE>.json`) con `monday-transform.ts` actual; cada entrada `source: snapshot` lleva `entry_date = board.parsed.snapshot_date_iso`.
- **Emparejamiento BD↔esperado:** mismo algoritmo endurecido que `reconcile-entry-dates` (elemento + content, duplicados por grupo de content).
- **Nombre snapshot:** tablero canónico del extract con esa `snapshot_date_iso`, p. ej. `CSP10 - 02/02/2026`.

## Verificación `monday-transform.ts`

✓ `buildLogEntriesFromObservations` asigna `entry_date: obs.snapshot_date_iso` (corregido). `observation_at` solo ordena observaciones.

## Resumen por proyecto

| Proyecto | log_entries | snapshot auditables | correctas | incorrectas | excluidas* | Snapshots canónicos | Estado |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | --- |
| CA1 | 190 | 134 | 134 | 0 | 56 | 13 | ✓ limpio |
| CSP10 | 306 | 292 | 292 | 0 | 14 | 35 | ✓ limpio |
| DC15 | 537 | 531 | 371 | 160 | 6 | 51 | ✗ requiere fix |
| GQ8 | 473 | 414 | 312 | 102 | 59 | 51 | ✗ requiere fix |
| LSE84 | 194 | 191 | 161 | 30 | 3 | 49 | ✗ requiere fix |
| PC25 | 681 | 642 | 642 | 0 | 39 | 40 | ✓ limpio |
| RLS-1779720803507 | 1 | — | — | — | — | — | sin extract |
| SA31 | 763 | 598 | 478 | 120 | 165 | 55 | ✗ requiere fix |
| SE84 | 413 | 366 | 306 | 60 | 47 | 52 | ✗ requiere fix |
| SICC II | 0 | — | — | — | — | 0 | sin datos BD |
| VBARE | 95 | 90 | 90 | 0 | 5 | 1 | ✓ limpio |
| VE1 | 295 | 241 | 241 | 0 | 54 | 26 | ✓ limpio |

\* Excluidas: entradas de app (`created_at >= 2026-05-27`), `monday_update`, sin par, o anomalías de match.

### Proyectos ya corregidos (rama fix/actas-entry-date)

CA1, CSP10, PC25, VBARE, VE1 — si el apply de esa rama se aplicó en BD, deberían figurar como **limpios** (0 incorrectas).

## CA1

- Total `log_entry` (elementos actuales): **190**
- Snapshot auditables (emparejadas): **134**
- Correctas: **134** · Incorrectas: **0**
- Excluidas del audit de bug: **56**
- Filas con `source='snapshot'` en BD: **0**

### Primeras discrepancias (máx. 10)

_Ninguna._

## CSP10

- Total `log_entry` (elementos actuales): **306**
- Snapshot auditables (emparejadas): **292**
- Correctas: **292** · Incorrectas: **0**
- Excluidas del audit de bug: **14**
- Filas con `source='snapshot'` en BD: **0**

### Primeras discrepancias (máx. 10)

_Ninguna._

## DC15

- Total `log_entry` (elementos actuales): **537**
- Snapshot auditables (emparejadas): **531**
- Correctas: **371** · Incorrectas: **160**
- Excluidas del audit de bug: **6**
- Filas con `source='snapshot'` en BD: **0**

### Primeras discrepancias (máx. 10)

| entry_id | fecha_actual | fecha_esperada | nombre_snapshot |
| --- | --- | --- | --- |
| `475433d7…` | 2025-09-25 | 2025-09-18 | DC15 - 18/09/2025 |
| `c8fcdac6…` | 2026-05-14 | 2025-09-11 | DC15 - 11/09/2025 |
| `d5f9db5f…` | 2026-05-01 | 2025-06-06 | DC15 - 06/06/2025 |
| `4f61a599…` | 2026-05-14 | 2025-07-31 | DC15 - 31/07/2025 |
| `8c0ec648…` | 2026-05-14 | 2025-08-14 | DC15 - 14/08/2025 |
| `9ccdb0e3…` | 2025-07-31 | 2025-09-04 | DC15 - 04/09/2025 |
| `59bd7421…` | 2026-05-14 | 2026-04-16 | DC15 - 16/04/2026 |
| `cae93939…` | 2026-04-16 | 2026-05-07 | DC15 - 07/05/2026 |
| `b8d7aadc…` | 2026-05-14 | 2026-05-07 | DC15 - 07/05/2026 |
| `8e86c2f2…` | 2026-05-14 | 2026-05-07 | DC15 - 07/05/2026 |
| … | | | _y 150 más_ |

## GQ8

- Total `log_entry` (elementos actuales): **473**
- Snapshot auditables (emparejadas): **414**
- Correctas: **312** · Incorrectas: **102**
- Excluidas del audit de bug: **59**
- Filas con `source='snapshot'` en BD: **0**

### Primeras discrepancias (máx. 10)

| entry_id | fecha_actual | fecha_esperada | nombre_snapshot |
| --- | --- | --- | --- |
| `adcf3810…` | 2025-09-17 | 2025-09-18 | GQ8 - 18/09/2025 |
| `33062af1…` | 2026-05-14 | 2026-04-30 | GQ8 - 30/04/2026 |
| `6139eeb8…` | 2026-01-15 | 2025-11-20 | GQ8 - 20/11/2025 |
| `d0a8bf18…` | 2025-11-20 | 2026-01-15 | GQ8 - 15/01/2026 |
| `2b4ebc45…` | 2026-05-20 | 2026-01-15 | GQ8 - 15/01/2026 |
| `51d020f3…` | 2026-01-15 | 2026-02-02 | GQ8 - 02/02/2026 |
| `69d9bcd0…` | 2026-05-20 | 2026-02-26 | GQ8 - 26/02/2026 |
| `898deec0…` | 2025-08-06 | 2025-08-07 | GQ8 - 07/08/2025 |
| `69924493…` | 2025-09-17 | 2025-09-18 | GQ8 - 18/09/2025 |
| `28d10a8b…` | 2025-12-10 | 2025-12-11 | GQ8 - 11/12/2025 |
| … | | | _y 92 más_ |

## LSE84

- Total `log_entry` (elementos actuales): **194**
- Snapshot auditables (emparejadas): **191**
- Correctas: **161** · Incorrectas: **30**
- Excluidas del audit de bug: **3**
- Filas con `source='snapshot'` en BD: **0**

### Primeras discrepancias (máx. 10)

| entry_id | fecha_actual | fecha_esperada | nombre_snapshot |
| --- | --- | --- | --- |
| `9eaab4af…` | 2025-08-06 | 2025-08-07 | LSE84 - 07/08/2025 |
| `9e4e0942…` | 2025-08-06 | 2025-08-07 | LSE84 - 07/08/2025 |
| `f9ce4435…` | 2025-10-16 | 2025-10-18 | LSE84 - 18/10/2025 |
| `7b51025c…` | 2026-05-07 | 2025-12-11 | LSE84 - 11/12/2025 |
| `ed397814…` | 2025-12-10 | 2026-05-07 | LSE84 - 07/05/2026 |
| `3d1d6a6f…` | 2025-10-02 | 2025-09-04 | LSE84 - 04/09/2025 |
| `45cca4e2…` | 2025-09-04 | 2025-10-02 | LSE84 - 02/10/2025 |
| `cd9f2e9e…` | 2025-09-04 | 2025-08-28 | LSE84 - 28/08/2025 |
| `4b25d348…` | 2025-12-10 | 2025-12-11 | LSE84 - 11/12/2025 |
| `936cd12b…` | 2026-05-11 | 2026-05-07 | LSE84 - 07/05/2026 |
| … | | | _y 20 más_ |

## PC25

- Total `log_entry` (elementos actuales): **681**
- Snapshot auditables (emparejadas): **642**
- Correctas: **642** · Incorrectas: **0**
- Excluidas del audit de bug: **39**
- Filas con `source='snapshot'` en BD: **0**

### Primeras discrepancias (máx. 10)

_Ninguna._

## SA31

- Total `log_entry` (elementos actuales): **763**
- Snapshot auditables (emparejadas): **598**
- Correctas: **478** · Incorrectas: **120**
- Excluidas del audit de bug: **165**
- Filas con `source='snapshot'` en BD: **0**

### Primeras discrepancias (máx. 10)

| entry_id | fecha_actual | fecha_esperada | nombre_snapshot |
| --- | --- | --- | --- |
| `f92f2dbd…` | 2025-05-08 | 2025-04-24 | SA31 - 24/04/2025 |
| `378784dc…` | 2025-07-07 | 2025-06-26 | SA31 - 26/06/2025 |
| `fcbb883c…` | 2025-09-17 | 2025-09-18 | SA31 - 18/09/2025 |
| `b28b4eb6…` | 2025-12-02 | 2025-11-27 | SA31 - 27/11/2025 |
| `9da77835…` | 2025-12-10 | 2025-12-11 | SA31 - 11/12/2025 |
| `413d25c9…` | 2026-05-12 | 2026-04-16 | SA31 - 16/04/2026 |
| `19b14609…` | 2026-05-14 | 2026-04-30 | SA31 - 30/04/2026 |
| `5a1c90e5…` | 2026-04-30 | 2026-05-07 | SA31 - 07/05/2026 |
| `28389949…` | 2025-05-08 | 2025-04-24 | SA31 - 24/04/2025 |
| `04a8a5db…` | 2025-09-04 | 2025-08-28 | SA31 - 28/08/2025 |
| … | | | _y 110 más_ |

## SE84

- Total `log_entry` (elementos actuales): **413**
- Snapshot auditables (emparejadas): **366**
- Correctas: **306** · Incorrectas: **60**
- Excluidas del audit de bug: **47**
- Filas con `source='snapshot'` en BD: **0**

### Primeras discrepancias (máx. 10)

| entry_id | fecha_actual | fecha_esperada | nombre_snapshot |
| --- | --- | --- | --- |
| `4ba0b205…` | 2025-09-17 | 2025-09-18 | SE84 - 18/09/2025 |
| `ebba68fe…` | 2025-08-06 | 2025-08-07 | SE84 - 07/08/2025 |
| `9bdde350…` | 2025-03-13 | 2025-03-06 | SE84 - 06/03/2025 |
| `17c2972c…` | 2025-08-06 | 2025-08-07 | SE84 - 07/08/2025 |
| `7a117953…` | 2025-08-06 | 2025-08-07 | SE84 - 07/08/2025 |
| `a468b0e1…` | 2025-08-06 | 2025-08-07 | SE84 - 07/08/2025 |
| `cfd1d059…` | 2025-09-17 | 2025-09-18 | SE84 - 18/09/2025 |
| `767dbe20…` | 2026-05-14 | 2026-05-07 | SE84 - 07/05/2026 |
| `107e6475…` | 2025-09-17 | 2025-09-18 | SE84 - 18/09/2025 |
| `bae8c1ab…` | 2025-12-10 | 2025-12-11 | SE84 - 11/12/2025 |
| … | | | _y 50 más_ |

## VBARE

- Total `log_entry` (elementos actuales): **95**
- Snapshot auditables (emparejadas): **90**
- Correctas: **90** · Incorrectas: **0**
- Excluidas del audit de bug: **5**
- Filas con `source='snapshot'` en BD: **0**

### Primeras discrepancias (máx. 10)

_Ninguna._

## VE1

- Total `log_entry` (elementos actuales): **295**
- Snapshot auditables (emparejadas): **241**
- Correctas: **241** · Incorrectas: **0**
- Excluidas del audit de bug: **54**
- Filas con `source='snapshot'` en BD: **0**

### Primeras discrepancias (máx. 10)

_Ninguna._

## Conclusión

Hay **472** entradas snapshot con fecha incorrecta en total. Ejecutar `npm run actas:fix-entry-dates -- --apply` (opcionalmente por `--project`).

