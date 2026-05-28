# Sanity: transform entry_date (snapshot_date_iso)

Generado: 2026-05-28T15:40:52.388Z

Comparación `tmp/monday-transformed/` (original) vs `tmp/monday-transformed-fix/` (corregido).

## Resumen

| Proyecto | log_entries | Fechas snapshot distintas (antes → después) | En `extracted_at` (después) | Fuera de rango (después) | Contenido OK |
| --- | ---: | --- | ---: | ---: | --- |
| CA1 | 151 = 151 | 5 → 11 | 0 | 0 | ✓ |
| CSP10 | 292 = 292 | 19 → 29 | 0 | 0 | ✓ |
| PC25 | 644 = 644 | 36 → 34 | 0 | 0 | ✓ |
| VBARE | 95 = 95 | 1 → 1 | 0 | 0 | ✓ |
| VE1 | 244 = 244 | 18 → 23 | 0 | 0 | ✓ |

**CSP10 (caso verificado):** entradas snapshot con `entry_date = 2026-05-13` (día del `updated_at` del tablero «CSP10 - 02/02/2026») pasan de **149 → 0**; las del snapshot del 02/02/2026 pasan a `2026-02-02` (9 entradas en esa fecha ISO).

VBARE solo tiene un tablero canónico (`2026-05-13`); el salto de «4 semanas» no aplica al recuento de fechas ISO distintas (sigue en 1), pero 90 filas normalizan el formato de fecha (`…Z` → `YYYY-MM-DD`).

## CA1

| Métrica | Original | Corregido |
| --- | ---: | ---: |
| log_entries (total) | 151 | 151 |
| log_entries snapshot (fechas distintas) | 5 | 11 |
| entradas snapshot en día extracted_at (`2026-05-26`) | 0 | 0 |
| entradas snapshot fuera de [min,max] | — | 0 |
| filas con entry_date distinta (mismo orden/content) | — | 135 |

### Contenido (debe coincidir posición a posición)

✓ Todos los elementos: mismo recuento y mismo `content` / `status_*` / `source` por posición.

### Fechas

- Rango extract: `2026-01-15` – `2026-05-21`
- Confirmación extracted_at: ✓ 0 entradas snapshot en fecha de extracción
- Confirmación rango: ✓ ninguna fuera de rango
- Ejemplos de cambio de fecha:
  - SOCIETARIO|Gobernanza [0]: 2026-01-15T12:56:26Z → 2026-01-15
  - SOCIETARIO|Gobernanza [1]: 2026-02-12T12:27:43Z → 2026-02-12
  - SOCIETARIO|Gobernanza [2]: 2026-05-22T21:26:26Z → 2026-03-05
  - SOCIETARIO|Gobernanza [3]: 2026-05-22T21:26:26Z → 2026-03-26
  - SOCIETARIO|Gobernanza [4]: 2026-05-22T21:26:26Z → 2026-04-09

## CSP10

| Métrica | Original | Corregido |
| --- | ---: | ---: |
| log_entries (total) | 292 | 292 |
| log_entries snapshot (fechas distintas) | 19 | 29 |
| entradas snapshot en día extracted_at (`2026-05-26`) | 0 | 0 |
| entradas snapshot fuera de [min,max] | — | 0 |
| filas con entry_date distinta (mismo orden/content) | — | 292 |

### Contenido (debe coincidir posición a posición)

✓ Todos los elementos: mismo recuento y mismo `content` / `status_*` / `source` por posición.

### Fechas

- Rango extract: `2025-06-26` – `2026-05-21`
- Confirmación extracted_at: ✓ 0 entradas snapshot en fecha de extracción
- Confirmación rango: ✓ ninguna fuera de rango
- Ejemplos de cambio de fecha:
  - SOCIETARIO|Gobernanza [0]: 2025-12-18T17:16:16Z → 2025-06-26
  - SOCIETARIO|Gobernanza [1]: 2025-12-18T17:16:22Z → 2025-07-17
  - SOCIETARIO|Gobernanza [2]: 2025-12-18T17:16:37Z → 2025-09-04
  - SOCIETARIO|Gobernanza [3]: 2025-12-18T17:16:39Z → 2025-09-11
  - SOCIETARIO|Gobernanza [4]: 2025-12-18T17:16:41Z → 2025-09-18

## PC25

| Métrica | Original | Corregido |
| --- | ---: | ---: |
| log_entries (total) | 644 | 644 |
| log_entries snapshot (fechas distintas) | 36 | 34 |
| entradas snapshot en día extracted_at (`2026-05-26`) | 0 | 0 |
| entradas snapshot fuera de [min,max] | — | 0 |
| filas con entry_date distinta (mismo orden/content) | — | 644 |

### Contenido (debe coincidir posición a posición)

✓ Todos los elementos: mismo recuento y mismo `content` / `status_*` / `source` por posición.

### Fechas

- Rango extract: `2025-06-06` – `2026-05-21`
- Confirmación extracted_at: ✓ 0 entradas snapshot en fecha de extracción
- Confirmación rango: ✓ ninguna fuera de rango
- Ejemplos de cambio de fecha:
  - SOCIETARIO|Gobernanza [0]: 2025-06-19T14:22:46Z → 2025-06-19
  - SOCIETARIO|Gobernanza [1]: 2025-07-03T14:47:31Z → 2025-07-03
  - SOCIETARIO|Gobernanza [2]: 2025-10-02T09:44:50Z → 2025-10-02
  - SOCIETARIO|Gobernanza [3]: 2025-10-16T11:04:05Z → 2025-10-16
  - SOCIETARIO|Gobernanza [4]: 2025-10-23T16:15:08Z → 2025-10-23

## VBARE

| Métrica | Original | Corregido |
| --- | ---: | ---: |
| log_entries (total) | 95 | 95 |
| log_entries snapshot (fechas distintas) | 1 | 1 |
| entradas snapshot en día extracted_at (`2026-05-26`) | 0 | 0 |
| entradas snapshot fuera de [min,max] | — | 0 |
| filas con entry_date distinta (mismo orden/content) | — | 90 |

### Contenido (debe coincidir posición a posición)

✓ Todos los elementos: mismo recuento y mismo `content` / `status_*` / `source` por posición.

### Fechas

- Rango extract: `2026-05-13` – `2026-05-13`
- Confirmación extracted_at: ✓ 0 entradas snapshot en fecha de extracción
- Confirmación rango: ✓ ninguna fuera de rango
- Ejemplos de cambio de fecha:
  - GOBERNANZA|Comunicaciones a mercado [0]: 2026-05-13T14:22:47Z → 2026-05-13
  - GOBERNANZA|Cambios en el OA [0]: 2026-05-13T14:22:47Z → 2026-05-13
  - GOBERNANZA|Otorgamiento de Poderes [0]: 2026-05-13T14:22:47Z → 2026-05-13
  - GOBERNANZA|Seguimiento CdA [0]: 2026-05-13T14:22:47Z → 2026-05-13
  - GOBERNANZA|Seguimiento JGA [0]: 2026-05-13T14:22:47Z → 2026-05-13

## VE1

| Métrica | Original | Corregido |
| --- | ---: | ---: |
| log_entries (total) | 244 | 244 |
| log_entries snapshot (fechas distintas) | 18 | 23 |
| entradas snapshot en día extracted_at (`2026-05-26`) | 0 | 0 |
| entradas snapshot fuera de [min,max] | — | 0 |
| filas con entry_date distinta (mismo orden/content) | — | 244 |

### Contenido (debe coincidir posición a posición)

✓ Todos los elementos: mismo recuento y mismo `content` / `status_*` / `source` por posición.

### Fechas

- Rango extract: `2025-09-18` – `2026-05-21`
- Confirmación extracted_at: ✓ 0 entradas snapshot en fecha de extracción
- Confirmación rango: ✓ ninguna fuera de rango
- Ejemplos de cambio de fecha:
  - SOCIETARIO|Gobernanza [0]: 2025-12-18T17:15:48Z → 2025-09-25
  - SOCIETARIO|Gobernanza [1]: 2025-12-18T17:15:52Z → 2025-10-09
  - SOCIETARIO|Gobernanza [2]: 2025-12-18T17:15:56Z → 2025-10-30
  - SOCIETARIO|Gobernanza [3]: 2025-12-18T17:15:59Z → 2025-11-06
  - SOCIETARIO|Gobernanza [4]: 2025-12-18T17:16:02Z → 2025-11-20

