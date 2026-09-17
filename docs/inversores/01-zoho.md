# Inversores · puesta en marcha y mantenimiento

La pestaña **Inversores** (`/dashboard/portfolio/inversores`) enseña quién ha puesto el dinero,
cuánto, en qué promociones y con qué flujos. El dato vive en Zoho CRM y se copia a Supabase; la
página nunca llama a Zoho.

## 1. Los cinco módulos de Zoho

| Módulo (nombre API) | Etiqueta en el CRM | Tabla espejo |
|---|---|---|
| `Cuentas_de_Inversi_n` | Cuentas de Inversión | `inv_cuentas` |
| `Inversi_n_vs_Contactos` | Inversión vs Contactos | `inv_cuenta_contacto` |
| `Inversi_n_vs_Promoci_n` | **Suscripción a proyectos** | `inv_cuenta_promocion` |
| `Aportes_Repartos` | **Movimientos - A/R** | `inv_flujos` |
| `Promociones` | Promociones | `inv_promociones` |
| `Contacts` | Contacts — solo los referenciados | `inv_contactos` |

**El CRM tiene módulos con nombres casi iguales que NO son estos.** Verificado sobre los 78
módulos accesibles: existen también `Aportes_y_Repartos` («Aportes y Repartos»),
`Promociones_Invertidas`, `Promociones_Invertidas1`, `Contacts_X_Promociones` y
`Fondos_vs_Proyectos`. Por eso los nombres están escritos en `inv_campo_catalogo` y no se eligen
a ojo.

**`Contacts` es la única fuente de los correos**, y esto costó un sync real descubrirlo:
`Inversi_n_vs_Contactos` tiene su propio campo `Email`, así que parecía que bastaba con el enlace
y no hacía falta copiar nada de la agenda. Ese campo viene **vacío en los 535 enlaces**. Que un
campo exista no quiere decir que alguien lo rellene, y el esquema de un CRM no dice cuál de sus
campos se usa de verdad.

De `Contacts` solo se copian los **referenciados desde una cuenta de inversión**: en la última
ejecución, 325 de 1.056. La agenda entera no se copia.

> **`inv_promociones` y `pm_promociones` espejan el mismo módulo de Zoho.** Están separadas a
> propósito: `pm_promociones` (migración 028) se puebla desde un export manual de Excel y es el
> ancla de Avance de obra. Se unen por `inv_promociones.zoho_id = pm_promociones.zoho_record_id`.
> Ninguna escribe en la otra.

## 2. Credenciales

Inversores usa las mismas cinco variables que Avance de obra (`ZOHO_ACCOUNTS_URL`,
`ZOHO_API_DOMAIN`, `ZOHO_CLIENT_ID`, `ZOHO_CLIENT_SECRET`, `ZOHO_REFRESH_TOKEN`) y **no** necesita
`ZOHO_MODULO_PROMOCIONES`.

El paso a paso para conseguirlas está en `docs/pm/01-avance-obra.md` § «Conectar la API de Zoho»:

```bash
npm run pm:zoho-auth -- --dc eu
```

**El centro de datos de ICAM es `eu`.** Comprobado empíricamente: contra `accounts.zoho.com` el
canje devuelve `invalid_client` (el client id/secret no existen ahí) y contra `accounts.zoho.eu`
devuelve `invalid_code` (existen, pero el refresh token no vale). Ese cambio de mensaje es el
diagnóstico: `invalid_client` = centro de datos equivocado; `invalid_code` = token caducado o
revocado, hay que generarlo otra vez.

**Ojo con el nombre de la clave.** El código lee `ZOHO_CLIENT_ID`. En `.env.local` y en Vercel
estuvo escrita como `ZOHODESK_CLIENT_ID`, y con ese nombre la integración se reporta como «no
configurada» sin más pistas. En Vercel hay que arreglarlo en **Preview y Production**:

```bash
npx vercel env ls production | grep -i zoho     # ver qué hay
npx vercel env rm ZOHODESK_CLIENT_ID production
npx vercel env add ZOHO_CLIENT_ID production
```

## 2 bis. Cómo es el modelo de verdad (y dónde engaña)

Cuatro cosas que no se deducen leyendo los nombres de los campos y que el mapeo ya esquiva:

**1. En `Promociones` las etiquetas están cruzadas respecto a los `api_name`.**
`Name` se llama «Código de Promoción» y `C_digo_de_Promoci_n` se llama «Nombre Promoción». Quien
se fíe del `api_name` pondrá el nombre en el código y al revés.

**2. `Inversi_n_vs_Promoci_n` es un EMBUDO COMERCIAL, no una lista de inversiones cerradas.**
Su campo `Status` recorre *Por contactar → Dossier + NDA → Reunión → LOI + Pack Inversor → Doc
firmada → PBC → Ganado*. **Por decisión del encargo se cuentan TODAS las filas** en los totales.

En la práctica importa menos de lo que parecía: **343 de las 354 filas no tienen `Status`** y
suman 290,4 M€ de los 303,8 M€. Lo marcado como pipeline temprano son 7 filas «Por contactar»
(8,3 M€, un 2,7 % del comprometido) y una «Dossier + NDA» de 0 €. Aun así el `Status` se guarda y
**se enseña en el detalle de cada cuenta**: si mañana la PMO empieza a rellenarlo, la cifra
cambiaría de significado sin avisar. Para filtrar, `inv_cuenta_promocion.status`.

Y ojo con el otro nombre engañoso: en ese módulo `Promociones_Invertidas_linking` **no es la
promoción**, su etiqueta es «Cuenta que invierte». La promoción es `Promociones_Invertidas_2`.

**3. El papel de un contacto no es un desplegable, son cinco casillas** (`Contacto_principal`,
`Contacto_secundario`, `Representante_legal`, `Abogado`, `Intermediario`) que pueden darse a la
vez, más `Concepto_representante`. Se guardan las cinco y el texto legible lo compone
`rolDeContacto` en `logic/inversoresModel.ts`. **No hay porcentaje de participación** por contacto
en el CRM.

**4. Lo que el CRM no tiene** y por tanto se deriva o se queda vacío:

| Columna | Por qué |
|---|---|
| `inv_cuentas.capital_comprometido` | No existe. Se deriva sumando `inv_cuenta_promocion.importe_comprometido` |
| `inv_cuentas.estado` | Solo existe `Record_Status__s` (Trash/Available/Draft), interno de Zoho |
| `inv_cuentas.fecha_alta` | `Fecha_de_nacimiento` es del titular, **no** el alta de la cuenta |
| `inv_cuenta_promocion.importe_aportado` | Se deriva de los flujos de esa cuenta en esa promoción |
| `inv_flujos.concepto` | «Movimientos - A/R» no tiene campo de concepto |

La cuenta lleva además `Total Inversión Promociones En Marcha` y `... Culminadas`, pero son campos
que alguien mantiene a mano: se dejan en `raw` y no se usan como fuente.

## 3. Resolver el mapeo de campos

Los nombres API de los campos **no están en el código**: viven en la tabla `inv_campo_catalogo`,
igual que `pm_avance_fase_catalogo` para Avance de obra. El motivo es el mismo: los nombres los
decide el CRM y congelarlos en un `const` convierte cualquier retoque en un despliegue urgente.

**La migración 040 ya los siembra resueltos**, porque el descubrimiento se hizo contra el CRM real.
Este script sirve para *revisarlos* cuando alguien toque Zoho, no para la puesta en marcha.

```bash
npm run inversores:zoho-descubrir                # módulos, estado del mapeo y propuesta
npm run inversores:zoho-descubrir -- --campos    # todos los campos de cada módulo
npm run inversores:zoho-descubrir -- --aplicar   # guarda lo que falte por resolver
npm run inversores:zoho-descubrir -- --muestra 3 # registros reales, ya mapeados
npm run inversores:zoho-descubrir -- --forzar    # reevalúa también lo ya resuelto
```

**Lo ya resuelto en la tabla no se toca sin `--forzar`.** No es una comodidad: contra el CRM real
la heurística resolvió sola `participacion` → «Sharepoint doc inversión vs promoción» (un campo de
tipo *website*, porque «Sharepoint» contiene «share») y `estado` → `Record_Status__s`. Dejarla
sobrescribir el mapeo bueno sería cambiar un dato correcto por una conjetura, en silencio.

Lee la salida así:

- `✓` un único candidato: se guarda con `--aplicar`.
- `?` varios candidatos: **no se resuelve solo**. Elegir al azar entre dos campos de dinero es
  exactamente cómo se cuela un KPI que miente. Míralo en `--campos` y ponlo a mano:
  ```sql
  UPDATE inv_campo_catalogo SET zoho_api_name = 'Importe_Comprometido'
  WHERE modulo = 'Inversi_n_vs_Promoci_n' AND destino = 'importe_comprometido';
  ```
- `✗` sin candidato: o el campo no existe en Zoho, o la pista no lo reconoce. Si la columna es
  obligatoria (marcada con `*`), el sync no arrancará.

Termina siempre con `--muestra 3`: es lo que delata un mapeo que compila pero miente (importes en
columnas de texto, lookups que llegan como `[object Object]`, fechas al revés).

### El diccionario de tipos de flujo

`Tipo_de_movimiento` tiene **siete valores** y no dos. La clasificación vive en
`inv_campo_catalogo.notas` de `Aportes_Repartos.tipo_zoho`:

**El desplegable declara siete valores, pero los datos traen diez.** `Reparto de dividendo`,
`Pago de intereses` y `Reducción de capital con/sin CDI` no aparecen en la definición del campo y
sí en los registros: alguien los quitó del desplegable sin tocar el histórico. Por eso el
diccionario los nombra a todos en lugar de fiarse de `pick_list_values`.

| Valor en el CRM | Cuenta como | Nº | Importe |
|---|---|---|---|
| Aporte de capital | `aporte` | 421 | 275,7 M€ |
| Reparto de capital | `reparto` | 462 | 109,2 M€ |
| Reparto de beneficios | `reparto` | 457 | 33,6 M€ |
| Reparto de dividendo | `reparto` | 35 | 1,6 M€ |
| **Llamada de capital** | `desconocido` | 18 | 0,8 M€ |
| **Impuesto de sociedades** | `desconocido` | 10 | 3,5 M€ |
| **Fee de éxito** | `desconocido` | 11 | 1,4 M€ |
| **Pago de intereses** | `desconocido` | 34 | 0,09 M€ |
| **Reducción de capital con CDI** | `desconocido` | 17 | 1,6 M€ |
| **Reducción de capital sin CDI** | `desconocido` | 23 | 0,004 M€ |

Los seis marcados **se sincronizan y se ven en la tabla, pero no suman en los KPIs** (unos 7,4 M€
en total). «Llamada de capital» es la petición de fondos y no el ingreso; el impuesto y el fee no
van hacia el inversor. Los tres últimos aparecieron en los datos después de decidir el criterio,
así que se quedan fuera por prudencia: **una cifra que no suma se ve y se corrige; una que suma de
más no se nota**. `Pago de intereses` y `Reducción de capital` probablemente sean repartos —
conviene confirmarlo y reclasificarlos.

Para cambiar la clasificación no hace falta desplegar:

```sql
UPDATE inv_campo_catalogo
SET notas = '{"normaliza":{"Llamada de capital":"aporte"}}'::jsonb
WHERE modulo = 'Aportes_Repartos' AND destino = 'tipo_zoho';
```

El diccionario manda sobre la heurística por raíz, y puede fijar `desconocido` explícitamente —que
es justo lo que hace falta con «Llamada de capital», porque contiene la palabra «capital» y una
heurística ingenua la contaría como aporte.

El importe es `Monto`. `Retenci_n` se guarda aparte en `inv_flujos.retencion` y **no** entra en
los KPIs: es un dato fiscal, no un flujo hacia el inversor.

## 4. Sincronizar

```bash
npm run inversores:sync -- --dry-run            # lee y cuenta, no escribe
npm run inversores:sync                         # de verdad
npm run inversores:sync -- --modulo Aportes_Repartos
```

En producción lo hace el cron `/api/cron/inversores-sync` a las **06:00 de Madrid** todos los
días (dos entradas en `vercel.json`, 04:00 y 05:00 UTC, y una puerta horaria que deja pasar la que
toca — el truco de los otros dos crones para el horario de verano). También hay un botón
«Sincronizar ahora» en la propia pestaña.

Cómo funciona, y por qué:

- **Upsert por `zoho_id`, no reemplazo.** Son seis tablas relacionadas y PostgREST no puede
  sostener una transacción entre seis llamadas HTTP; un reemplazo que fallara en la tercera
  dejaría la pestaña con cuentas y sin flujos.
- **Lo que desaparece de Zoho se marca (`borrado_at`), no se borra.** Un reparto que se esfuma es
  una pregunta que hacer, no un dato que tirar.
- **Esa marca solo se pone si la lectura del módulo terminó entera.** Es la regla más importante:
  `fetchRegistrosDeModulo` lanza al agotar las páginas en vez de devolver una lista corta,
  precisamente para que una lectura truncada no acabe marcando como borrada la cola de la tabla.
  Un módulo que devuelve cero registros tampoco barre: eso huele a permiso retirado, no a CRM
  vacío.
- **Un módulo que falla no aborta los demás**, y el resultado queda como `parcial`. La página
  avisa y enseña la última carga buena de cada módulo.
- **Una sola sincronización a la vez**, por un índice único parcial sobre `estado = 'en_curso'`.
  Dos entrelazadas se marcarían borrado la una a la otra.

Diagnóstico: `inv_sync_log` tiene una fila por ejecución, con el detalle por módulo en `modulos`
(`leidos`, `escritos`, `lapidas`, `huerfanos`, `ms`, `error`).

**`huerfanos`** cuenta los enlaces que apuntan a una cuenta que no está en el espejo. Un número
pequeño y variable es normal (alguien creó un registro en Zoho entre página y página); uno que no
baja tras un sync completo significa que el usuario del token no ve el módulo padre.

## 5. Si el mapeo resultó estar mal

No hace falta volver a bajar nada de Zoho: cada fila guarda el registro completo en `raw`.

```sql
UPDATE inv_cuentas SET capital_comprometido = (raw->>'Capital_Comprometido')::numeric;
```

Con el matiz de que `raw` es «todo lo que pedimos», no «todo lo que Zoho tiene»: la API v8 exige
enumerar los campos. Si el campo que falta no estaba mapeado, hay que añadirlo al catálogo y
volver a sincronizar.

## 6. Quién ve la pestaña

Nace **denegada para todo el mundo** y se concede una a una en `/dashboard/admin/usuarios`, donde
aparece marcada como «restringida».

El portal usa una *denylist*: una ruta nueva la ve por defecto todo el que tenga la zona. Como
Inversores cuelga de `financiero`, que ya tiene mucha gente, hacen falta dos piezas:

1. la migración 040 siembra la denegación para todos los usuarios que existían ese día;
2. `deniedByDefault: true` en el registry hace que `createAdminUserAction` la siembre también para
   los que se creen después.

Defensa en profundidad, además del corte de ruta: las tablas `inv_*` tienen RLS habilitada y **sin
política de SELECT** (ni `anon` ni `authenticated` las leen), `data/readClient.ts` lanza si se le
llama desde el navegador, y la Server Action de sync comprueba la route key y no solo la zona.

> **Los correos viajan en el payload RSC.** La página manda las cuentas con sus contactos al
> navegador para que el segundo nivel del drill-down abra sin esperar, así que son legibles en las
> herramientas de desarrollo de quien tenga acceso. Es aceptable **porque** la pestaña se concede a
> mano. Si algún día se abre a más gente, hay que cambiar el nivel 2 a carga bajo demanda con una
> Server Action que revalide el permiso.

## 7. Cambios en el cliente de Zoho

`src/lib/zoho/client.ts` es compartido con Avance de obra (que lo importa a través del re-export
`src/modules/pm/avance/data/zohoClient.ts`). Lo que añadió Inversores es aditivo:

- `zohoVariablesQueFaltan({ conModulo: false })` y `getZohoConfig({ conModulo: false })` para no
  exigir `ZOHO_MODULO_PROMOCIONES` a quien no lo usa;
- `fetchRegistrosDeModulo(modulo, campos, …)`, del que `fetchTodosLosRegistros` es ahora un
  envoltorio sobre el módulo de Promociones;
- `zohoApi` (antes el `zohoJson` privado), para poder llamar a cualquier endpoint de `/crm/v8`.

Al tocarlo, probar también «Subir a Zoho» de Avance de obra: es la única escritura del portal
hacia el CRM y está en producción.
