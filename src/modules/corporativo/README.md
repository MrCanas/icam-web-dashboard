# Módulo `corporativo` — tab «Corporativas»

La foto económica del **grupo Impar**: facturación, EBITDA, márgenes, capital bajo gestión, caja
y cuentas depositadas de GIIC, ICI e ICAM. Es la otra mitad de lo que cuenta `portfolio`, que
mira a los activos inmobiliarios.

## Qué hace

Dos pantallas alimentadas por `20260810_MAESTRO_CORPORATIVO.xlsx`, que se sincroniza cada
semana desde SharePoint:

| Ruta | Route key | Contenido |
|---|---|---|
| `/dashboard/corporativo` | `corporativo.executive` | 5 KPI + facturación/EBITDA, comparativa por sociedad, puente de EBITDA, mix de facturación, AUM y caja |
| `/dashboard/corporativo/detalle` | `corporativo.detalle` | Estructura de gastos, variación interanual, estacionalidad, cuentas oficiales de GIIC, tabla completa y metodología |

Ambas comparten la barra flotante (`CorporativoToolbar`) y sus parámetros de URL: **sociedad**,
**granularidad** (trimestre/año), **desde** (año) y **previsión** (incluir/ocultar).

## Modelo de datos

Migración `supabase/migrations/20260908120000_038_corporativo.sql`.

- **`corp_periodos`** — una fila por fila de la hoja `DATOS`, 46 columnas. `id` (`GIIC|20211T`) es
  la clave del propio Excel. `CHECK` sobre `sociedad`, `tipo_periodo` y `naturaleza`.
- **`corp_diccionario`** — hoja `DICCIONARIO`: qué es cada campo y de dónde sale.
- **`corp_notas`** — hoja `NOTAS`: origen de los datos y avisos metodológicos.

**RLS: sin política de SELECT.** A diferencia del resto de tablas de negocio (que llevan
`<tabla>_auth_read TO authenticated` desde la 030), estas tres solo las lee el `service_role`.
Son la cuenta de resultados del grupo y el tab entero se sirve desde Server Components. Por eso
`data/readClient.ts` **no tiene variante de navegador** y lanza si se le llama desde el cliente.

## Las cuatro reglas del maestro

Están en la hoja `NOTAS` del Excel y son el contrato de `logic/calculations.ts`. Los tests de
`logic/__tests__/calculations.test.ts` existen para que ninguna se rompa en silencio:

1. **`TRIMESTRE`, `AÑO` y `ACUMULADO` conviven en la misma tabla.** Sumar sin filtrar antes por
   `tipo_periodo` duplica cifras. Todo pasa por `serieDe()`, que aísla uno solo.
2. **Caja, banco, AUM y nº de vehículos son SALDOS.** No se suman entre periodos: se toma el
   valor del último.
3. **Los KPI de cabecera solo miran `REAL`.** 2026 3T y 4T son previsión; los años que las
   contienen son `MIXTO`. Ocultar la previsión se lleva también los `MIXTO`, porque un año con
   dos trimestres de plan no es un cierre.
4. **`es_ultima_fila = 1`** marca el último trimestre cerrado de cada sociedad. Es el ancla de
   los KPI.

Además: `GRUPO` es la suma de `GIIC` + `ICI+ICAM` **sin eliminaciones**, y el desglose
variables/estructura solo viene relleno cuando cuadra con el total (GIIC 2021-2023 no lo tiene).

## Sincronización

| Vía | Qué es |
|---|---|
| `/api/cron/corporativo-sync` | Cron semanal. Dos entradas en `vercel.json` (miércoles 08:00 y 09:00 UTC) y puerta horaria que deja pasar la de las 10:00 de Madrid |
| `/api/upload-corporativo-excel` | Subida manual en dos pasos (analizar → confirmar), desde la pestaña Datos |
| `npm run corporativo:sync-maestro` | Carga desde el Excel local. `--dry-run` parsea sin tocar la BD |
| `npm run corporativo:check-sharepoint -- --list` | Diagnóstico: enseña cómo se reparten los Excel de la carpeta entre los dos patrones de nombre |

Los tres caminos comparten `logic/commitCorporativoUpload.ts`, así que un cambio en el parser
afecta a todos.

**Los dos maestros viven en la misma carpeta de SharePoint** y comparten `SHAREPOINT_DRIVE_ID` y
`SHAREPOINT_FOLDER_ITEM_ID`. Lo único que los separa es el patrón de nombre, y desde `ab541ac`
`findMaestroInFolder` **aborta si casa con más de un fichero**: `SHAREPOINT_CORPORATIVO_NAME_MATCH`
tiene que ser `MAESTRO_CORPORATIVO`, no `MAESTRO`.

`upload_logs` es compartida con portfolio; la columna `fuente` (añadida por la 038) distingue
quién escribió cada línea. `NULL` cuenta como `portfolio`.

## Acciones definidas

| Clave (`module.ts`) | Uso |
|---|---|
| `corporativo.read` | Ver el tab |
| `corporativo.write` | Cargar el maestro |

Auditoría (`audit_log`):

| Acción | Uso |
|---|---|
| `corporativo.periodo.replace` | Reemplazo del snapshot de periodos |
| `corporativo.diccionario.replace` | Reemplazo del glosario |
| `corporativo.nota.replace` | Reemplazo de las notas |
| `corporativo.upload_log.create` | Traza de una carga |

## Paleta de las gráficas

En `ui/charts/tokens.ts`, con el resultado del validador escrito al lado. Son los **mismos
colores que el tab Dashboard**: navy `#1E2A56` y oro `#B89660` de los tokens de marca, más
`#6E7BB0` de la paleta del gráfico de sectores de portfolio cuando hace falta un tercer tono.
Las dos zonas se miran seguidas y tienen que parecer el mismo producto.

Separación entre series: peor par ΔE 17,4 bajo daltonismo y 19,1 en visión normal, sobre
mínimos de 8 y 15. El oro se queda en 2,77:1 de contraste contra el blanco, y por eso ninguna
gráfica confía solo en el color: todas llevan leyenda con la cifra al lado y la pantalla de
Detalle repite todo en una tabla.

**Tope de tres series categóricas.** Ninguna gráfica pinta más a la vez; si hicieran falta, se
agrupa en «Otros» o se parte la gráfica, nunca se inventa un cuarto color.

Ninguna gráfica lleva doble eje Y. Donde hacían falta dos escalas (margen, nº de vehículos,
gastos sobre facturación) hay una **tira de apoyo** debajo que comparte ancho de eje y márgenes
con la principal, y por tanto alineación en el eje X.

La previsión se distingue por **trama diagonal**, no por color: el color ya está ocupado
identificando la serie, y la trama sobrevive a la escala de grises y al daltonismo.

## Estructura interna

- `data/` — parser del Excel, repositorio y clientes Supabase; `ctx` primer parámetro,
  `withAudit` en toda mutación
- `logic/` — cálculos puros, view models, parámetros de URL y el pipeline de carga
- `ui/` — componentes y `ui/pages/`
- `module.ts` — metadatos para el registry
