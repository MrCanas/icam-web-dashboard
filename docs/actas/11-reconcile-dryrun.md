# Dry-run reconciliación entry_date

Generado: 2026-05-28T15:56:21.745Z

Solo SELECT en Postgres. Fuente de fechas: `tmp/monday-transformed-fix/{code}.json`.

## Esquema `public.log_entry`

| Columna | Tipo | Nullable |
| --- | --- | --- |
| id | uuid | NO |
| element_id | uuid | NO |
| author_id | uuid | YES |
| content | text | NO |
| status_before | text | YES |
| status_after | text | YES |
| entry_date | timestamp with time zone | NO |
| created_at | timestamp with time zone | NO |
| edited_at | timestamp with time zone | YES |
| deleted_at | timestamp with time zone | YES |
| source | text | YES |
| search_vector | tsvector | YES |

**created_at:** presente (orden de desempate en duplicados)
**source:** presente (no usada en match; no existe en migración P3.5)

Ventana migración Monday: entradas con `created_at >= 2026-05-27T00:00:00.000Z` sin match → reales/posteriores.

## CA1

| Métrica | Valor |
| --- | ---: |
| log_entries (elementos actuales, DB) | 169 |
| A actualizar (entry_date distinta) | 88 |
| Sin cambio | 62 |
| Reales / posteriores (sin match, fuera del update) | 19 |
| Anomalías (sin match, revisión) | 0 |
| JSON sin par en DB | 1 |
| Cuadre (actualizar+sin cambio+reales+anomalías=total) | ✓ |
| Elementos con entradas (JSON / DB / ambos) | 54 / 52 / 50 |

### Muestra de cambios propuestos (máx. 15)

- `bbc09ec2…` · SOCIETARIO|Gobernanza · «Inscrita.» · 2026-05-22 → **2026-03-05**
- `2fe8aec5…` · SOCIETARIO|Gobernanza · «Pendiente disminución y aumento de capital.» · 2026-05-22 → **2026-03-26**
- `b5bbf477…` · SOCIETARIO|Gobernanza · «Pendiente disminución y aumento de capital. Pendiente revis…» · 2026-05-22 → **2026-04-09**
- `f5c8ddf3…` · SOCIETARIO|Gobernanza · «Pendiente de inscripción disminución y aumento de capital. …» · 2026-05-22 → **2026-04-30**
- `6260e0be…` · SOCIETARIO|Gobernanza · «Pendiente de inscripción disminución y aumento de capital. …» · 2026-05-22 → **2026-05-14**
- `3106b6dd…` · SOCIETARIO|Levantamiento de Capital|Proceso comercialización · «Finalizado. Pendiente 1/2 cupo de Impar» · 2026-02-02 → **2026-01-29**
- `782d00e1…` · SOCIETARIO|Levantamiento de Capital|Proceso firma · «Packs firmado por 10 inversores. Seguimiento a ultimas inco…» · 2026-02-02 → **2026-01-29**
- `fde7e203…` · SOCIETARIO|Levantamiento de Capital|Capital Call · «Se envia 03/02.» · 2026-02-02 → **2026-01-29**
- `d0e93595…` · SOCIETARIO|Compraventa · «Adquirido 29/12/25 con condición suspensiva por pago aplaza…» · 2026-02-02 → **2026-01-29**
- `aa6eef15…` · SOCIETARIO|Viaje inversores · «Pendiente de cerrar fecha posterior a la firma de los contr…» · 2026-05-22 → **2026-04-30**
- `7b475b29…` · ESTADO PROYECTO|Tramitación de licencias · «Primeras reuniones con Marriott. Se esta trabajando en un e…» · 2026-02-02 → **2026-01-29**
- `4daa6c7c…` · ESTADO PROYECTO|Tramitación de licencias · «Primeras reuniones con Marriott. Se esta trabajando en un e…» · 2026-05-22 → **2026-03-19**
- `79e4b1ca…` · ESTADO PROYECTO|Tramitación de licencias · «Trabajando en el proyecto para solicitar licencia con proye…» · 2026-05-22 → **2026-03-26**
- `780e1e45…` · ESTADO PROYECTO|Tramitación de licencias · «Trabajando en el proyecto para solicitar licencia con proye…» · 2026-05-22 → **2026-04-30**
- `cd9c16e1…` · ESTADO PROYECTO|Presupuesto obra · «Con las medidas de PCI solicitadas por Marriott la estimaci…» · 2026-05-22 → **2026-05-14**
- … y 73 más

### Reales / posteriores (respetadas)

- `7f94170b…` · SOCIETARIO|Gobernanza · created_at=2026-05-28 14:35:31 · entry_date=2026-05-28
- `320d7d37…` · ESTADO PROYECTO|Tramitación de licencias · created_at=2026-05-28 07:50:39 · entry_date=2026-05-28
- `f53fbba2…` · ESTADO PROYECTO|Tramitación de licencias · created_at=2026-05-28 13:40:11 · entry_date=2026-05-28
- `41146363…` · ESTADO PROYECTO|Interiorismo · created_at=2026-05-28 13:46:53 · entry_date=2026-05-28
- `42b5bb60…` · ESTADO PROYECTO|Interiorismo · created_at=2026-05-28 13:55:40 · entry_date=2026-05-28
- `56efad57…` · ESTADO PROYECTO|Proyecto Arquitectura · created_at=2026-05-28 13:55:10 · entry_date=2026-05-28
- `265ee5d6…` · ESTADO PROYECTO|Contrataciones · created_at=2026-05-28 13:57:07 · entry_date=2026-05-28
- `83ab5777…` · SITUACIÓN FINANCIERA|Flujo de caja · created_at=2026-05-28 13:59:54 · entry_date=2026-05-28
- `c1041b3e…` · PROPERTY MANAGEMENT|Seguros · created_at=2026-05-28 09:35:05 · entry_date=2026-05-28
- `88bf24b2…` · PROPERTY MANAGEMENT|Seguros · created_at=2026-05-28 14:00:38 · entry_date=2026-05-28
- … y 9 más

### JSON sin par en DB

- SITUACIÓN INQUILINOS|Vaciado de pisos|Antena · «Enviado burofax de vencimiento para el 10/12/2026» · 2026-05-14

## CSP10

| Métrica | Valor |
| --- | ---: |
| log_entries (elementos actuales, DB) | 302 |
| A actualizar (entry_date distinta) | 289 |
| Sin cambio | 3 |
| Reales / posteriores (sin match, fuera del update) | 10 |
| Anomalías (sin match, revisión) | 0 |
| JSON sin par en DB | 0 |
| Cuadre (actualizar+sin cambio+reales+anomalías=total) | ✓ |
| Elementos con entradas (JSON / DB / ambos) | 25 / 25 / 25 |

### Muestra de cambios propuestos (máx. 15)

- `fef8ff49…` · SOCIETARIO|Gobernanza · «Adquirido el activo y ampliación de capital de General Real…» · 2025-12-18 → **2025-06-26**
- `5045f104…` · SOCIETARIO|Gobernanza · «Adquirido el activo y ampliación de capital de General Real…» · 2025-12-18 → **2025-07-17**
- `f7bed7e4…` · SOCIETARIO|Gobernanza · «Adquirido el activo y ampliación de capital de General Real…» · 2025-12-18 → **2025-09-04**
- `9ba99d19…` · SOCIETARIO|Gobernanza · «Adquirido el activo y ampliación de capital de General Real…» · 2025-12-18 → **2025-09-11**
- `b45ac751…` · SOCIETARIO|Gobernanza · «Adquirido el activo y ampliación de capital de General Real…» · 2025-12-18 → **2025-09-18**
- `a079e34d…` · SOCIETARIO|Gobernanza · «Adquirido el activo y ampliación de capital de General Real…» · 2025-12-18 → **2025-10-16**
- `bc415163…` · SOCIETARIO|Gobernanza · «Adquirido el activo y ampliación de capital de General Real…» · 2026-05-13 → **2025-11-27**
- `80ea2a64…` · SOCIETARIO|Gobernanza · «Adquirido el activo y pendiente inscripción RM aumento de c…» · 2026-05-13 → **2026-01-15**
- `be64c02c…` · SOCIETARIO|Gobernanza · «Adquirido el activo y inscrito aumento de capital General R…» · 2026-05-13 → **2026-02-02**
- `279f242b…` · SOCIETARIO|Gobernanza · «Siguiente hito CCAA junio 2026» · 2026-05-13 → **2026-04-30**
- `6687d88e…` · SOCIETARIO|Gobernanza · «Siguiente hito aprobación CCAA junio 2026» · 2026-05-13 → **2026-05-07**
- `2d45aff0…` · SOCIETARIO|Gobernanza · «En proceso de cambio OA.» · 2026-05-13 → **2025-11-13**
- `3ed4ecd0…` · SOCIETARIO|Gobernanza · «En proceso de cambio OA.» · 2026-05-13 → **2026-02-12**
- `5b9a2e3a…` · SOCIETARIO|Gobernanza · «Adquirido el activo y ampliación de capital de General Real…» · 2025-12-18 → **2026-04-16**
- `83bb4de5…` · SOCIETARIO|Gobernanza · «Adquirido el activo y ampliación de capital de General Real…» · 2026-05-13 → **2026-04-16**
- … y 274 más

### Reales / posteriores (respetadas)

- `2517dd2f…` · SOCIETARIO|Gobernanza · created_at=2026-05-28 14:30:00 · entry_date=2026-05-28
- `89cde0c7…` · ESTADO PROYECTO|Tramitación de licencias · created_at=2026-05-28 15:14:09 · entry_date=2026-05-28
- `bcd53797…` · ESTADO PROYECTO|Proyecto Arquitectura · created_at=2026-05-28 15:14:57 · entry_date=2026-05-28
- `a0149ebe…` · ESTADO PROYECTO|Presupuesto obra · created_at=2026-05-28 15:15:58 · entry_date=2026-05-28
- `f8c751e2…` · ESTADO PROYECTO|Inicio Obra · created_at=2026-05-28 15:16:17 · entry_date=2026-05-28
- `f0d747ff…` · ESTADO PROYECTO|Antena · created_at=2026-05-28 15:20:27 · entry_date=2026-05-28
- `de3f0777…` · ESTADO PROYECTO|Operador (técnico) · created_at=2026-05-28 15:22:02 · entry_date=2026-05-28
- `e86f45ab…` · ESTADO PROYECTO|Trabajos previos · created_at=2026-05-28 15:23:30 · entry_date=2026-05-28
- `61d99b4b…` · ESTADO PROYECTO|Centro de Transformación (CT) · created_at=2026-05-28 15:24:35 · entry_date=2026-05-28
- `a41c0022…` · COMERCIAL|Integración con Operador · created_at=2026-05-28 15:25:30 · entry_date=2026-05-28

**CSP10:** 149 cambios propuestos desde `entry_date` 2026-05-13 (bug updated_at).

## PC25

| Métrica | Valor |
| --- | ---: |
| log_entries (elementos actuales, DB) | 644 |
| A actualizar (entry_date distinta) | 203 |
| Sin cambio | 441 |
| Reales / posteriores (sin match, fuera del update) | 0 |
| Anomalías (sin match, revisión) | 0 |
| JSON sin par en DB | 0 |
| Cuadre (actualizar+sin cambio+reales+anomalías=total) | ✓ |
| Elementos con entradas (JSON / DB / ambos) | 74 / 74 / 67 |

### Muestra de cambios propuestos (máx. 15)

- `074a1730…` · SOCIETARIO|Gobernanza · «Sociedad constituida. Aportes de capital hechos. Pendientes…» · 2026-05-12 → **2025-06-06**
- `12ca82f3…` · SOCIETARIO|Gobernanza · «Sociedad constituida. Aportes de capital hechos, pendientes…» · 2026-05-12 → **2025-06-12**
- `6c37a942…` · SOCIETARIO|Gobernanza · «Terrenos adquiridos y aumentado el capital social Pendiente…» · 2026-05-12 → **2025-06-26**
- `f04f1bef…` · SOCIETARIO|Gobernanza · «Terrenos adquiridos y aumentado el capital social Pendiente…» · 2026-05-12 → **2025-09-11**
- `ae9a34b7…` · SOCIETARIO|Gobernanza · «Terrenos adquiridos y aumentado el capital social Pendiente…» · 2026-05-12 → **2025-09-04**
- `02c13c90…` · SOCIETARIO|Gobernanza · «Terrenos adquiridos y aumentado el capital social Pendiente…» · 2026-05-12 → **2025-10-02**
- `352e4f45…` · SOCIETARIO|Gobernanza · «Terrenos adquiridos y aumentado el capital social Pendiente…» · 2026-05-12 → **2026-04-30**
- `7795ddd2…` · SOCIETARIO|Gobernanza · «Terrenos adquiridos y aumentado el capital social Pendiente…» · 2025-10-02 → **2025-07-17**
- `a38573ec…` · SOCIETARIO|Gobernanza · «Inscrito cambio de domicilio y OA. Siguiente hito aprobació…» · 2026-05-14 → **2025-07-23**
- `ab415a57…` · SOCIETARIO|Gobernanza · «Terrenos adquiridos y aumentado el capital social Pendiente…» · 2026-05-12 → **2025-09-18**
- `d53865d5…` · SOCIETARIO|Gobernanza · «Inscrito cambio de domicilio y OA. Siguiente hito aprobació…» · 2026-04-30 → **2025-08-28**
- `fdd00033…` · SOCIETARIO|Gobernanza · «Terrenos adquiridos y aumentado el capital social Pendiente…» · 2026-05-12 → **2026-05-14**
- `0f5eb8ae…` · ESTADO PROYECTO|Tramitación de licencias · «Prevista entrega contestación de requerimiento 23/07 Solici…» · 2026-05-12 → **2025-07-17**
- `e830b2c0…` · ESTADO PROYECTO|Tramitación de licencias · «Preparando respuesta de requerimiento» · 2026-05-12 → **2025-06-06**
- `24d73885…` · ESTADO PROYECTO|Tramitación de licencias · «Prevista entrega contestación de requerimiento 08/07» · 2026-05-12 → **2025-06-12**
- … y 188 más

## VBARE

| Métrica | Valor |
| --- | ---: |
| log_entries (elementos actuales, DB) | 95 |
| A actualizar (entry_date distinta) | 0 |
| Sin cambio | 95 |
| Reales / posteriores (sin match, fuera del update) | 0 |
| Anomalías (sin match, revisión) | 0 |
| JSON sin par en DB | 0 |
| Cuadre (actualizar+sin cambio+reales+anomalías=total) | ✓ |
| Elementos con entradas (JSON / DB / ambos) | 136 / 136 / 136 |

### Muestra de cambios propuestos (máx. 15)

_Ninguno._

## VE1

| Métrica | Valor |
| --- | ---: |
| log_entries (elementos actuales, DB) | 281 |
| A actualizar (entry_date distinta) | 202 |
| Sin cambio | 39 |
| Reales / posteriores (sin match, fuera del update) | 40 |
| Anomalías (sin match, revisión) | 0 |
| JSON sin par en DB | 3 |
| Cuadre (actualizar+sin cambio+reales+anomalías=total) | ✓ |
| Elementos con entradas (JSON / DB / ambos) | 145 / 142 / 142 |

### Muestra de cambios propuestos (máx. 15)

- `5836b400…` · SOCIETARIO|Gobernanza · «En proceso de constitución de vehículo Impar interno. A la …» · 2025-12-18 → **2025-09-25**
- `c8899525…` · SOCIETARIO|Gobernanza · «Folleto inscrito.» · 2025-12-18 → **2025-10-09**
- `0b07c207…` · SOCIETARIO|Gobernanza · «Se solicita modificación de folleto. Pendiente de redacción…» · 2025-12-18 → **2025-10-30**
- `2f4daeb9…` · SOCIETARIO|Gobernanza · «En proceso de modificación de folleto. Operativa la cuenta …» · 2025-12-18 → **2025-11-06**
- `7029fb83…` · SOCIETARIO|Gobernanza · «En proceso de modificación de folleto. Pendiente cambio OA …» · 2025-12-18 → **2025-11-20**
- `24e9420f…` · SOCIETARIO|Gobernanza · «En proceso de modificación de folleto. Aumento de capital e…» · 2025-12-18 → **2025-11-27**
- `e0767495…` · SOCIETARIO|Gobernanza · «Folleto inscrito. Aumento de capital elevado a público. En …» · 2026-05-22 → **2026-04-30**
- `a703df81…` · SOCIETARIO|Gobernanza · «En proceso de constitución de vehículo RP» · 2026-05-26 → **2025-09-18**
- `f6f4fb13…` · SOCIETARIO|Levantamiento de Capital · «CapTable cerrado.» · 2025-12-18 → **2025-10-09**
- `aabd4909…` · SOCIETARIO|Levantamiento de Capital · «En proceso de levantamiento desde 15/09. Gran éxito.» · 2025-12-18 → **2025-09-25**
- `e99f16c8…` · SOCIETARIO|Levantamiento de Capital · «En proceso de levantamiento desde 15/09. Gran éxito.» · 2026-05-26 → **2025-09-18**
- `e8b65f94…` · SOCIETARIO|Levantamiento de Capital|Proceso comercialización · «Hay 20 intenciones de cupo. Previsto cerrar CapTable en 2 s…» · 2025-12-18 → **2025-09-25**
- `a1eb0b92…` · SOCIETARIO|Levantamiento de Capital|Proceso comercialización · «CapTable cerrado. Enviado VDR para inversores y Pack 08/10.» · 2025-12-18 → **2025-10-09**
- `6fe7f5c2…` · SOCIETARIO|Levantamiento de Capital|Proceso comercialización · «Hay 15 precomercializado, expresados su intención de entrar.» · 2026-05-26 → **2025-09-18**
- `bb40113d…` · SOCIETARIO|Levantamiento de Capital|Proceso firma · «Pack Cerrado. Firmados 2.» · 2025-12-18 → **2025-10-09**
- … y 187 más

### Reales / posteriores (respetadas)

- `017b388d…` · SOCIETARIO|Gobernanza · created_at=2026-05-28 14:33:56 · entry_date=2026-05-28
- `e3328842…` · ESTADO PROYECTO|Tramitación de licencias · created_at=2026-05-28 14:21:09 · entry_date=2026-05-28
- `07cc9c8c…` · ESTADO PROYECTO|Presupuesto obra · created_at=2026-05-28 14:22:53 · entry_date=2026-05-28
- `35016566…` · ESTADO PROYECTO|Presupuesto obra · created_at=2026-05-28 14:25:05 · entry_date=2026-05-28
- `017f2a67…` · ESTADO PROYECTO|Inicio Obra · created_at=2026-05-28 14:24:50 · entry_date=2026-05-28
- `1a9bbce5…` · ESTADO PROYECTO|Interiorismo · created_at=2026-05-28 14:25:29 · entry_date=2026-05-28
- `372a7c9f…` · ESTADO PROYECTO|Interiorismo · created_at=2026-05-28 14:25:39 · entry_date=2026-05-28
- `805fbbc4…` · ESTADO PROYECTO|Plazo · created_at=2026-05-28 14:26:24 · entry_date=2026-05-28
- `3a988348…` · ESTADO PROYECTO|Plazo · created_at=2026-05-28 14:26:27 · entry_date=2026-05-28
- `4a3492ad…` · ESTADO PROYECTO|Proyecto Arquitectura · created_at=2026-05-28 14:26:53 · entry_date=2026-05-28
- … y 30 más

### JSON sin par en DB

- COMERCIAL|Reforma|4ºF · «Libre: 16/02 Pendiente Inicio Obra» · 2026-05-07
- COMERCIAL|Reforma|4ºD (terraza) · «Iniciadas obras de mejora» · 2026-05-07
- COMERCIAL|Reforma|4ºE (interior) · «Finalizado» · 2026-05-07

## Resumen global

| Proyecto | Total DB | Actualizar | Sin cambio | Reales | Anomalías | Cuadre |
| --- | ---: | ---: | ---: | ---: | ---: | --- |
| CA1 | 169 | 88 | 62 | 19 | 0 | ✓ |
| CSP10 | 302 | 289 | 3 | 10 | 0 | ✓ |
| PC25 | 644 | 203 | 441 | 0 | 0 | ✓ |
| VBARE | 95 | 0 | 95 | 0 | 0 | ✓ |
| VE1 | 281 | 202 | 39 | 40 | 0 | ✓ |

