# Avance de obra

Pestaña de proyecto que responde **cuánto llevamos construido**, con origen en el módulo
Promociones de Zoho CRM. Planificación responde el *cuándo* (fechas de hito); esto responde
el *cuánto*.

- Pestaña del proyecto: `/dashboard/pm/proyecto/<id_activo>/avance-obra`
- Hub y bandeja de salida hacia Zoho: `/dashboard/pm/avance-obra` (rueda de Configuración)
- Emparejamiento activo ↔ promoción: `/dashboard/pm/proyectos`, columna «Promoción (Zoho)»
- Route key de permisos: `pm.avance_obra`
- Esquema: migración **028** (`supabase/migrations/20260819120000_028_pm_avance_obra.sql`)

## Las tres trampas de estos datos

**1. `NULL` no es `0`.** En el export conviven celdas vacías (Zoho no tiene valor) y ceros
reportados: GA91 trae las 6 fases vacías, DC15 las trae a cero. Si se colapsan, el día que se
comuniquen los cambios se sobrescriben campos vacíos de Zoho con ceros. Toda comparación usa
`IS DISTINCT FROM` en SQL y `hayCambioVsZoho()` en TypeScript, que son espejo la una de la otra
(hay test). En la interfaz, «—» es sin dato y «0,0 %» es cero.

**2. «Avance general» no es la media de las fases.** Lo calcula Zoho por su cuenta y **no se
recalcula aquí**. En los datos reales la diferencia es enorme: SE84 va al 1,35 % general con
«Actuaciones previas» al 45,38 %, y PS7 al 0 % con la estructura al 75 %. La pestaña avisa de la
discrepancia cuando pasa de 5 puntos, pero solo como nota: el valor que manda es el de Zoho.

**3. Los códigos no coinciden entre sistemas.** Zoho usa `T123`/`FC149` donde el maestro
financiero usa `TO123`/`FU149`, y PM usa `DC-15` donde Zoho usa `DC15`. Además hay 30
promociones para 9 proyectos de PM. **No hay ningún emparejamiento por código en tiempo de
ejecución**: 4 pares están escritos a mano en
`src/modules/pm/avance/logic/avance-autolink.ts` y se siembran en la carga; el resto lo decide la
PMO en Mapeo maestro. No existe regla que lleve `SA-33-31` a `SA31`, y `LDH171` convive con
`LDH171-V1`, así que cualquier heurística acabaría emparejando mal.

## Cargar o refrescar los datos de Zoho

```bash
npm run pm:apply-migration-028 -- --apply     # solo la primera vez
npm run pm:seed-avance-obra                   # dry-run
npm run pm:seed-avance-obra -- --apply
```

El fichero `.xlsx` no vive en el repositorio; lo versionado es el dato ya parseado en
`scripts/pm/data/avance-obra-promociones.ts`. Para actualizarlo con una descarga nueva:

```bash
npm run pm:seed-avance-obra -- --xlsx "C:/ruta/KPI_AvanceProyectos_Promociones.xlsx"
```

Eso **no escribe en la base**: imprime el diff contra el fichero versionado para que se revise
antes de tocarlo.

> El export de Zoho Analytics trae parte del texto doble codificado («RamÃ³n») y algún guion
> blando suelto («Gran Ví­a 61»). Tanto el generador del fixture como el modo `--xlsx` lo
> reparan; si aparece un nombre raro nuevo, es esto.

**Reimportar no pisa el trabajo de la PMO.** `pm_avance_importar_zoho` refresca siempre
`porcentaje_zoho` (la línea base del diff) pero solo toca `porcentaje` si el valor vigente venía
del propio Zoho. Y si Zoho ya trae el valor que la PMO había propuesto, el cambio pendiente se
cierra como `descartado` en vez de quedarse encallado.

## Editar y comunicar a Zoho

Editar un porcentaje escribe tres cosas en una sola transacción (`pm_avance_registrar_cambio`):
el valor vigente, una fila de histórico y una entrada en la bandeja de salida.

**Nada se envía a Zoho automáticamente.** El flujo es:

```
editar → pendiente → (admin de PM) aprobado → «Subir a Zoho» → enviado
```

Con la conexión configurada, el botón **Subir a Zoho** del hub escribe los cambios aprobados en
el CRM. Sin ella, el mismo flujo se cierra a mano descargando el CSV/JSON y subiéndolo desde
Zoho («Marcar como enviado»). La escritura la dispara siempre una persona: no hay cron, ni
webhook, ni escritura al editar.

- La bandeja es **estado deseado** por (promoción, fase), no un log: editar tres veces la misma
  celda deja una sola entrada que aprobar, y volver al valor de Zoho la borra sola.
- Editar necesita permiso de escritura en PM; **aprobar o descartar es solo para el rol admin**.
- «Descartar» no revierte la edición: el valor sigue siendo el de la PMO, simplemente no viaja
  a Zoho.
- El endpoint de descarga (`/api/pm/avance-obra/export`) es un `GET` y **no muta nada**: cerrar
  el cambio es un botón aparte. Un GET que cambia estado se dispararía solo con el prefetch del
  navegador.
- El JSON de descarga es **el cuerpo exacto** del `PUT` que manda el botón, para que el camino
  manual y el automático hagan lo mismo: `{"data":[{"id":"…","Campo":valor}],"trigger":[]}`,
  con los campos al nivel del registro.
- Si Zoho acepta unos registros y rechaza otros (responde 207), solo se marcan como enviados los
  que llegaron; los demás **se quedan en «aprobado»** con el error guardado, para poder
  reintentar sin volver a aprobarlos.
- Solo viajan las fases con cambio aprobado. El resto de campos de la promoción no se tocan.

## Conectar la API de Zoho

El cliente está escrito (`src/modules/pm/avance/data/zohoClient.ts`) y **descubre por sí mismo
el módulo y los nombres API de los campos**: nadie tiene que averiguarlos a mano. Lo único que
falta son las credenciales.

### 1. Crear un Self Client en Zoho

En la consola de API de vuestro centro de datos (`https://api-console.zoho.eu/` si sois `.eu`,
`https://api-console.zoho.com/` si sois `.com`) → **Self Client** → *Create*. Copia el
**Client ID** y el **Client Secret**.

Después, pestaña **Generate Code**:

- Scope: `ZohoCRM.settings.READ,ZohoCRM.modules.ALL`
- Duración: 10 minutos
- Copia el **grant code** que sale (caduca enseguida)

**`ZohoCRM.modules.ALL` ya incluye la escritura.** El `ALL` son las operaciones (leer, crear,
actualizar, borrar), no «todos los módulos en solo lectura»: con ese scope el botón «Subir a
Zoho» funciona. `settings.READ` es lo que permite el autodescubrimiento de módulo y campos.

### 2. Canjear el código y guardarlo, en un solo comando

**Ejecútalo en tu terminal, no a través del asistente**: los argumentos llevan el client secret.

```bash
npm run pm:zoho-auth -- --dc eu --client-id 1000.XXX --client-secret YYY --code ZZZ
```

`--dc` es el dominio donde abres el CRM: `crm.zoho.eu` → `eu`, `crm.zoho.com` → `com` (también
admite `in`, `com.au`, `jp`, `ca`).

Canjea el código, escribe las variables en `.env.local` respetando el resto del fichero y **no
imprime ni el secret ni el refresh token**. Si Zoho falla no toca nada, y traduce los tres
errores de siempre:

| error | qué pasó |
|---|---|
| `invalid_code` | el código caducó (dura 10 min) o ya se había usado — genera otro |
| `invalid_client` | el `--dc` no coincide con el dominio donde generaste el código |
| `invalid_client_secret` | el secret no corresponde a ese client id |

Para que el secret no quede en el historial del shell, se pueden pasar por entorno
(`ZOHO_CLIENT_ID`, `ZOHO_CLIENT_SECRET`, `ZOHO_GRANT_CODE`) en vez de por argumento.

<details>
<summary>Hacerlo a mano con curl</summary>

```bash
curl -X POST "https://accounts.zoho.eu/oauth/v2/token" \
  -d "grant_type=authorization_code" \
  -d "client_id=TU_CLIENT_ID" \
  -d "client_secret=TU_CLIENT_SECRET" \
  -d "code=EL_GRANT_CODE"
```

La respuesta trae `refresh_token` (no caduca) y `api_domain`, que hay que copiar a `.env.local`.
</details>

### 3. Comprobar que ha quedado

```bash
grep -c "^ZOHO" .env.local     # tiene que dar 6
```

### 4. Descubrir el módulo y los campos

```bash
npm run pm:zoho-explore              # lista los módulos y señala el candidato
# pon ZOHO_MODULO_PROMOCIONES en .env.local
npm run pm:zoho-explore -- --campos  # campos, mapeo propuesto y valores de Tipología
npm run pm:zoho-explore -- --muestra 3
```

Solo lee; no escribe nada ni en Zoho ni en la base. `--campos` propone el mapeo contra
`pm_avance_fase_catalogo` y, si «Tipología» es un desplegable, lista sus valores — que es
justo lo que dirá si el export de Excel venía filtrado.

### 5. Rellenar los nombres API de los campos

Con el mapeo del paso 4 confirmado, se escribe en `pm_avance_fase_catalogo.zoho_api_name` el
`api_name` de cada fase. Hasta entonces el botón «Subir a Zoho» **se niega a enviar** y dice qué
fases le faltan: adivinar un nombre escribiría en el campo equivocado del CRM.

A partir de ahí el botón funciona. La escritura (`pushAvance`) no la invoca ningún cron ni
ninguna ruta automática: solo la acción del botón, y solo sobre cambios ya aprobados. Envía con
`trigger: []` para no encadenar workflows del CRM — esto es una corrección de dato, no un evento
de negocio.

### Alternativa recomendada: mínimo privilegio

`modules.ALL` concede también **borrado** y acceso a **todos** los módulos del CRM, y aquí solo
hace falta leer y actualizar Promociones. Una vez que el paso 4 diga el nombre API del módulo,
merece la pena regenerar el token con:

```
ZohoCRM.settings.modules.READ,ZohoCRM.settings.fields.READ,ZohoCRM.modules.<Modulo>.READ,ZohoCRM.modules.<Modulo>.UPDATE
```

Sin `CREATE` ni `DELETE`: el portal nunca crea ni borra promociones, solo corrige porcentajes.
Es el mismo trámite (Generate Code → canjear) y el token viejo se puede revocar.

### El scope no es lo único que puede bloquear la escritura

Dos cosas más tienen que cumplirse, y ninguna se arregla con permisos de OAuth:

1. **El usuario que generó el Self Client** necesita permiso de edición sobre el módulo y sobre
   esos campos, en su perfil y en el diseño de página. Si el campo es de solo lectura para él,
   la API devuelve un error de permisos aunque el scope sea correcto.
2. **Los campos de fórmula o de resumen no se pueden escribir.** Zoho los calcula. Si «Avance
   general» resultara ser una fórmula, habría que dejarlo fuera del envío y mandar solo las 6
   fases.

`npm run pm:zoho-explore -- --campos` marca cada campo con `✎` (escribible) o `·` (solo lectura)
y avisa explícitamente si alguno de los que necesitamos no se puede escribir.

## Estado del emparejamiento

Emparejados en la carga (lista escrita a mano, no una regla):

| PM | Zoho |
|---|---|
| `SE84` | `SE84` — Santa Engracia 84 |
| `GQ8` | `GQ8` — Glorieta de Quevedo 8 |
| `DC-15` | `DC15` — Doctor Cortezo 15 |
| `SA-33-31` | `SA31` — Sagasta 31 |

Pendientes de emparejar a mano: `CSP-10`, `PC25-CP6`, `PC25-26-RESIDENCIAL`, `EM-RESIDENCIAL`,
`CA1`. Ninguno tiene una fila en el export con un código reconocible, así que la decisión es de
la PMO. Hasta que se emparejen, su pestaña muestra el estado vacío con el enlace a Mapeo maestro.
