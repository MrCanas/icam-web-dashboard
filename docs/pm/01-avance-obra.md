# Avance de obra

Pestaña de proyecto que responde **cuánto llevamos construido**, con origen en el módulo
Promociones de Zoho CRM. Planificación responde el *cuándo* (fechas de hito); esto responde
el *cuánto*.

- Pestaña del proyecto: `/dashboard/pm/proyecto/<id_activo>/avance-obra`
- Hub y bandeja de salida hacia Zoho: `/dashboard/pm/avance-obra` (rueda de Configuración)
- Emparejamiento activo ↔ promoción: `/dashboard/pm/proyectos`, columna «Promoción (Zoho)»
- Route key de permisos: `pm.avance_obra`
- Esquema: migraciones **028** (tablas) y **029** (tipología y contexto de la promoción)

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
financiero usa `TO123`/`FU149`, y PM usa `DC-15` donde Zoho usa `DC15`. Además hay 47
promociones para 9 proyectos de PM. **No hay ningún emparejamiento por código en tiempo de
ejecución**: los pares están escritos a mano en
`src/modules/pm/avance/logic/avance-autolink.ts` y se siembran en la carga; el resto lo decide la
PMO en Mapeo maestro. No existe regla que lleve `SA-33-31` a `SA31`, y `LDH171` convive con
`LDH171-V1`, así que cualquier heurística acabaría emparejando mal.

**Y una cuarta, que apareció con el export completo:** en Zoho hay registros cuyo
**«Nombre Promoción» se ha sobrescrito con el nombre del vehículo de inversión**. `SE84` pasó de
«Santa Engracia 84» a «Impar Prime Alternative Investment II» el 05/08/2026, y `SA31` a «Impar
Prime Alternative Investment II, SICC, S.A.». El código y el Record Id no cambiaron, así que el
emparejamiento aguanta; pero el nombre ya no identifica el edificio. Por eso se guarda también
`direccion` («Dirección promoción»): en SE84 sigue diciendo `C/Santa Engracia 84`. La interfaz la
muestra cuando difiere del nombre.

## Cargar o refrescar los datos de Zoho

```bash
npm run pm:apply-migration-028 -- --apply     # solo la primera vez
npm run pm:apply-migration-029 -- --apply     # solo la primera vez
npm run pm:seed-avance-obra                   # dry-run
npm run pm:seed-avance-obra -- --apply
```

El export no vive en el repositorio; lo versionado es el dato ya parseado en
`scripts/pm/data/avance-obra-promociones.ts`. Para actualizarlo con una descarga nueva:

```bash
npm run pm:seed-avance-obra -- --csv "C:/ruta/Promociones_2026_08_19.csv"
```

Eso **no escribe en la base**: imprime el diff contra el fichero versionado para que se revise
antes de tocarlo. Admite `.csv` y `.xlsx`.

**Exporta el módulo entero, sin filtros.** El primer export venía filtrado y traía 30 de los 47
registros; faltaban justo los que no se podían emparejar con PM. El export bueno es el del
módulo Promociones completo, con sus 139 columnas.

> El export de Zoho **Analytics** trae parte del texto doble codificado («RamÃ³n») y algún guion
> blando suelto («Gran Ví­a 61»); el del módulo, en CSV, viene en UTF-8 limpio. El lector repara
> ambos casos, así que da igual cuál se use.

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

**En tu terminal, no a través del asistente**: esto maneja el client secret.

```bash
npm run pm:zoho-auth -- --dc eu
```

Pide los tres datos de uno en uno —**el secret no se ve al teclearlo**—, canjea el código,
escribe las variables en `.env.local` y no imprime ni el secret ni el refresh token. Si Zoho
falla, no toca el fichero.

`--dc` es el dominio donde abres el CRM: `crm.zoho.eu` → `eu`, `crm.zoho.com` → `com` (también
`in`, `com.au`, `jp`, `ca`).

Traduce los errores que salen siempre:

| error | qué pasó |
|---|---|
| `invalid_code` | el código caducó (dura 10 min) o ya se había usado — genera otro |
| `invalid_client` | el `--dc` no coincide con el dominio donde generaste el código |
| `invalid_client_secret` | el secret no corresponde a ese client id |
| llega `access_token` pero no `refresh_token` | el Self Client ya tenía un token para ese scope: revócalo y repite |

Para automatizarlo también admite `--client-id`, `--client-secret` y `--code`, o las variables
`ZOHO_CLIENT_ID` / `ZOHO_CLIENT_SECRET` / `ZOHO_GRANT_CODE`. Por argumento el secret queda en el
historial del shell, y el script avisa.

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

> **`.env.local` o `.env`.** Los scripts de PM leen los dos, y `.env.local` gana si una clave
> está en ambos. El resto del repo solo mira `.env.local`, así que para la aplicación web las
> variables tienen que acabar ahí.

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

## La tipología

El campo de Zoho es **«Tipo de proyecto»** y tiene tres valores:

| Tipología | Registros |
|---|---|
| Promoción | 35 |
| Fondo | 8 |
| Proyecto de un fondo | 4 |

El primer export venía filtrado y traía 30 de los 47 registros. Con el completo aparecieron
`CSP10`, `CA1`, `PC25`, `VE1`, `LSE84`, los fondos (`FICCI`, `FICCII`, `FICCIII`, `SICCI`,
`SICCII`) y cinco registros que no son promociones reales: `SP` (Sin Proyecto), `PC`
(POTENCIALES CLIENTES), `PROMOCIONTEST`, `VDR` y `Placeholder`. Se cargan todos —no se descarta
nada por criterio propio— y el desplegable de emparejamiento los agrupa por tipología para
poder distinguirlos.

## Estado del emparejamiento

Emparejados en la carga (lista escrita a mano, no una regla):

| PM | Zoho |
|---|---|
| `SE84` | `SE84` — hoy renombrado al vehículo; su dirección sigue siendo C/Santa Engracia 84 |
| `GQ8` | `GQ8` — Glorieta de Quevedo 8 |
| `CA1` | `CA1` — Camino 1 |
| `DC-15` | `DC15` — Doctor Cortezo 15 |
| `SA-33-31` | `SA31` — hoy renombrado al vehículo |
| `CSP-10` | `CSP10` — Costanilla de San Pedro 10 |

Pendientes de emparejar a mano: `PC25-CP6`, `PC25-26-RESIDENCIAL` y `EM-RESIDENCIAL`. Los tres
apuntarían a la misma promoción `PC25 · Padre Claret 25`, que engloba Padre Claret 25 y Emilio
Mario 18 (así lo describe el campo «Destino del proyecto» de ese registro). Compartir promoción
es admisible —`pm_activo_promocion_map` no tiene UNIQUE sobre `promocion_id`, igual que en el
caso PC25 del maestro financiero—, pero eso lo confirma la PMO, no se deduce por parecido de
nombre. Hasta entonces su pestaña muestra el estado vacío con el enlace a Mapeo maestro.
