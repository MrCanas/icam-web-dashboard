# Inversores

Subárea de `portfolio` (zona `financiero`) en `/dashboard/portfolio/inversores`. Enseña quién ha
puesto el dinero, cuánto, en qué promociones y con qué flujos, con drill-down desde cualquier
cifra hasta los contactos de una cuenta y sus correos.

Misma forma que `src/modules/pm/avance/`: subárea con su `data/`, `logic/`, `ui/` y `actions/`,
y la ruta declarada en el `module.ts` del módulo padre.

## Puesta en marcha

Está en **`docs/inversores/01-zoho.md`**: credenciales, resolución del mapeo de campos,
sincronización y diagnóstico. Lo que sigue es solo el mapa del código.

## Tablas

Migración `040_inversores`. Seis espejos (`inv_cuentas`, `inv_contactos`, `inv_cuenta_contacto`,
`inv_promociones`, `inv_cuenta_promocion`, `inv_flujos`), el catálogo de mapeo
(`inv_campo_catalogo`) y el log (`inv_sync_log`).

Todas con RLS habilitada y **sin política de SELECT**, como `corp_periodos`: son nombres, correos
y patrimonio de los inversores. El único acceso es service role desde Server Components.

## Por dónde entra cada cosa

| Fichero | Qué hace |
|---|---|
| `data/zohoSchema.ts` | La FORMA del espejo: qué columnas hay y cuáles son obligatorias |
| `data/inversoresRepository.ts` | Todas las consultas a `inv_*`. Nada de `supabase.from()` fuera de aquí |
| `data/readClient.ts` | Service role; lanza si se le llama desde el navegador |
| `logic/mapearRegistro.ts` | Registro de Zoho → fila. Puro, y donde viven las rarezas de la v8 |
| `logic/validarMapeo.ts` | La puerta: sin mapeo completo, el sync no arranca |
| `logic/inversoresSync.ts` | El orquestador: orden, lápidas, parcial, log |
| `logic/inversoresModel.ts` | Espejos → KPIs, series y resolutores del drill-down. Puro |
| `logic/loadInversoresPage.ts` | Carga en paralelo y nunca lanza |
| `ui/InversoresTablero.tsx` | La parte de cliente: un solo drill-down para toda la página |
| `ui/drilldown/` | La pila de niveles y su modal |

## Convenciones del área

- **La forma es código, la resolución es dato.** Qué columnas existen se decide en
  `zohoSchema.ts`; a qué campo de Zoho corresponde cada una, en `inv_campo_catalogo`. La frontera
  está donde está porque lo primero es contrato y lo segundo lo cambia el CRM sin avisar.
- **Solo lectura contra Zoho.** La única escritura del portal hacia el CRM sigue siendo el botón
  de Avance de obra.
- **Nada se borra.** Lo que desaparece de Zoho se marca con `borrado_at` y las lecturas lo filtran.
- **Un `null` no es un cero.** Un importe que Zoho no trae se queda a `null`; un cero afirmaría que
  no se comprometió nada.
- **Todo agregado en servidor.** Los flujos crudos no bajan al navegador; sí las cuentas con sus
  contactos, que es lo que el drill-down necesita para abrir sin esperar.
- **Un solo `<Modal>` para los dos niveles del drill-down.** Ver el comentario de
  `useInversoresDrilldown`: apilar diálogos se pelea por el scroll del fondo y por el foco.
- **Dato personal en el payload RSC.** Aceptable porque la pestaña se concede a mano; si eso
  cambia, el nivel 2 pasa a carga bajo demanda. Está razonado en `docs/inversores/01-zoho.md` §6.

## Acciones de auditoría

| Acción | Cuándo |
|---|---|
| `portfolio.inversores.sync` | Botón «Sincronizar ahora» |
| `portfolio.inversores.catalogo.resolver` | `inversores:zoho-descubrir -- --aplicar` |

## Tests

`npm test` (o `npx tsx --test "src/modules/portfolio/inversores/logic/__tests__/*.test.ts"`).
Cubren el mapeo de registros de Zoho —lookups, importes en formato español, picklists
desconocidas— y las agregaciones del modelo.
