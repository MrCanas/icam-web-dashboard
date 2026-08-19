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
editar → pendiente → (admin de PM) aprobado → descargar CSV/JSON → subir a Zoho → marcar enviado
```

- La bandeja es **estado deseado** por (promoción, fase), no un log: editar tres veces la misma
  celda deja una sola entrada que aprobar, y volver al valor de Zoho la borra sola.
- Editar necesita permiso de escritura en PM; **aprobar o descartar es solo para el rol admin**.
- «Descartar» no revierte la edición: el valor sigue siendo el de la PMO, simplemente no viaja
  a Zoho.
- El endpoint de descarga (`/api/pm/avance-obra/export`) es un `GET` y **no muta nada**: cerrar
  el cambio es un botón aparte. Un GET que cambia estado se dispararía solo con el prefetch del
  navegador.

## Conectar la API de Zoho (pendiente)

Hoy no hay integración. La costura está en `src/modules/pm/avance/data/zohoClient.ts` y **ningún
punto del código la llama**. Faltan tres cosas:

1. **El nombre API del módulo** de Promociones (Zoho → Configuración → Espacio para
   desarrolladores → APIs) → variable `ZOHO_MODULO_PROMOCIONES`.
2. **El nombre API de cada uno de los 7 campos** de avance → columna
   `pm_avance_fase_catalogo.zoho_api_name`, hoy a `NULL`. Mientras falte, la exportación JSON
   emite una clave marcada `__API_NAME_PENDIENTE__<fase>` en vez de inventarse un nombre: así el
   fichero no se puede subir «sin querer» creyendo que está listo.
3. **Credenciales OAuth** (self-client) y el **centro de datos**: los dominios de Zoho cambian
   entre `.eu` y `.com`, y usar el equivocado da un 401 sin explicación. Ver
   `.env.local.example`, sección «Zoho CRM · Avance de obra».

Cuando existan: implementar `pushAvance`, añadir una acción que la invoque **solo sobre cambios
ya aprobados**, y usar el estado `enviado` del outbox, que ya está previsto en el esquema. El
modelo de datos no hay que tocarlo.

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
