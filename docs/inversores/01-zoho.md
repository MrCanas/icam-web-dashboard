# Inversores · puesta en marcha y mantenimiento

La pestaña **Inversores** (`/dashboard/portfolio/inversores`) enseña quién ha puesto el dinero,
cuánto, en qué promociones y con qué flujos. El dato vive en Zoho CRM y se copia a Supabase; la
página nunca llama a Zoho.

## 1. Los cinco módulos de Zoho

| Módulo (nombre API) | Qué es | Tabla espejo |
|---|---|---|
| `Cuentas_de_Inversi_n` | El vehículo por el que se invierte | `inv_cuentas` |
| `Inversi_n_vs_Contactos` | Enlace cuenta ↔ persona (de aquí salen los correos) | `inv_cuenta_contacto` |
| `Inversi_n_vs_Promoci_n` | Enlace cuenta ↔ promoción | `inv_cuenta_promocion` |
| `Aportes_Repartos` | Flujos de caja | `inv_flujos` |
| `Promociones` | Las promociones | `inv_promociones` |
| `Contacts` | Solo los contactos referenciados, y **solo si hacen falta** | `inv_contactos` |

`Contacts` es condicional: si `Inversi_n_vs_Contactos` ya trae un campo de correo, no se copia
nada del módulo de contactos. Lo decide `validarMapeo`, no una constante.

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

## 3. Resolver el mapeo de campos

Los nombres API de los campos **no están en el código**: viven en la tabla `inv_campo_catalogo`,
igual que `pm_avance_fase_catalogo` para Avance de obra. El motivo es el mismo: los nombres los
decide el CRM y congelarlos en un `const` convierte cualquier retoque en un despliegue urgente.

```bash
npm run inversores:zoho-descubrir                # módulos, estado del mapeo y propuesta
npm run inversores:zoho-descubrir -- --campos    # todos los campos de cada módulo
npm run inversores:zoho-descubrir -- --aplicar   # guarda la propuesta
npm run inversores:zoho-descubrir -- --muestra 3 # registros reales, ya mapeados
```

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

`Aportes_Repartos.tipo_zoho` se normaliza a `aporte` / `reparto` con el mapa que vive en
`inv_campo_catalogo.notas`:

```sql
UPDATE inv_campo_catalogo
SET notas = '{"normaliza":{"Aportación":"aporte","Reparto":"reparto"}}'::jsonb
WHERE modulo = 'Aportes_Repartos' AND destino = 'tipo_zoho';
```

Lo que no case cae en `desconocido`: la fila **se sincroniza igual** y se ve en la tabla, pero no
suma en los KPIs. Perderla en silencio descuadraría los totales sin avisar.

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
