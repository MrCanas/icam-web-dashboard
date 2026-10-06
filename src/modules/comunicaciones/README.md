# Comunicaciones

Zona propia (`comunicaciones`) en `/dashboard/comunicaciones`. Prepara correos a inversores
enseñando **a quién irían y con qué plantilla antes de que salga nada**, y los envía con controles.

Dónde vive cada pieza del proyecto, el estado, la puesta en marcha, el envío con su candado y la
guía de uso están en [`docs/comunicaciones/`](../../../docs/comunicaciones/README.md).

## Por qué existe

Los correos a inversores salían del kiosk «Emails a Fondos/Promos» de Zoho CRM, que no enseña a
quién va a escribir. Un intento de ampliarlo dentro del CRM (2026-10-05) acabó en 60 correos
enviados por error: el envío era la opción por defecto y en ningún paso se veía la lista de
destinatarios ni la plantilla. Este módulo le da la vuelta: primero se ve, después —y con
controles— se envía.

## Qué hace

1. **Nueva** — se elige la audiencia (promoción o fondo, toda la base, inversores directos) y qué
   papeles de contacto van en «Para» y en copia. Enseña cuántas cuentas tiene cada audiencia y de
   qué hora son los datos de Zoho; si no son de hoy, obliga a actualizarlos.
2. **Detalle** — la lista de destinatarios, una fila por cuenta, con sus avisos. Se puede excluir a
   cualquiera y descargar la lista en CSV. Se elige la plantilla del CRM y se ve cómo queda con los
   datos de un destinatario concreto. Y, al final, **el envío**: revisión firmada, prueba
   obligatoria a uno mismo, confirmación tecleando el número de correos y tandas con botón de
   parada.
3. **Historial** — las comunicaciones y su estado.
4. **Ajustes** — el interruptor general, el modo pruebas/real, la cuenta de pruebas y los
   remitentes. Solo los cambia el administrador de la zona.

## Lo que no puede hacer

**Escribir a un inversor.** Hay un candado de destinatarios en `logic/candado.ts`: mientras exista,
el único destinatario posible es una dirección fija o un contacto principal de una cuenta de prueba
de la promoción de pruebas del CRM, y solo sobre los registros de esas cuentas. Quitarlo es una PR
aparte. Todo el detalle, en `docs/comunicaciones/02-envio-con-controles.md`.

Tampoco envía nada por defecto: `com_ajustes` nace con los envíos desactivados y en modo pruebas, y
donde no existe el token de envíos la pasarela es la simulada.

## Tablas

Migraciones `047_comunicaciones` y `048_comunicaciones_envio`:

| Tabla | Qué guarda |
|---|---|
| `com_comunicacion` | Una fila por comunicación: audiencia, plantilla, estado y quién pasó cada control |
| `com_destinatario` | La FOTO de a quién iría: una fila por cuenta, con «Para», copia, avisos y exclusión. Y, tras el envío, a qué direcciones salió de verdad, por qué pasarela y con qué resultado |
| `com_ajustes` | Una sola fila: interruptor general, modo, cuenta de pruebas y remitentes. Nace con envíos desactivados y modo pruebas |

RLS habilitada y **sin política de SELECT**, como `inv_*`: hay nombres y correos de inversores. El
único acceso es service role desde el servidor.

La migración añade además dos columnas al espejo de Inversores (`inv_cuentas.tiene_intermediario`,
`inv_contactos.email_opt_out`) con su fila en `inv_campo_catalogo`. Las rellena el sync de
Inversores; hasta el primer sync posterior a la migración valen `NULL` y la audiencia «Inversores
directos» sale vacía.

```bash
npm run comunicaciones:apply-migration-047             # simulación: aplica y revierte
npm run comunicaciones:apply-migration-047 -- --apply
npm run comunicaciones:apply-migration-048             # ídem, las columnas del envío
npm run comunicaciones:zoho-descubrir                  # qué ve el token de lectura: campos y plantillas
npm run comunicaciones:zoho-auth-envios                # genera el token de ENVÍOS (no usar pm:zoho-auth)
npm run comunicaciones:zoho-envio-verificar            # el token de envíos y sus remitentes; solo lee
```

## De dónde salen los datos

- **Cuentas, contactos y papeles**: del espejo de Inversores (`inv_*`), no de Zoho en vivo. Se lee
  con `cargarEspejosDeContacto` de `portfolio/inversores/data/inversoresRepository.ts`.
- **Plantillas**: de Zoho en vivo (`/settings/email_templates`). Siguen editándose en el CRM.
- **Vista previa**: la plantilla más el registro entero del destinatario, leído de Zoho en vivo,
  porque una plantilla puede combinar campos que el espejo no guarda.

## Por dónde entra cada cosa

| Fichero | Qué hace |
|---|---|
| `logic/destinatarios.ts` | Audiencia → cuentas → «Para», copia y avisos. Puro, y lo más probado |
| `logic/plantilla.ts` | Sustituye los campos combinados `${!Módulo.Campo}`. Puro |
| `logic/candado.ts` | A quién se puede escribir. Puro. **La última línea antes de que algo salga** |
| `logic/controles.ts` | Qué paso del envío se puede dar y por qué no. Puro |
| `logic/envio.ts` | Cómo se monta cada correo: redirección en modo pruebas, sin repetir direcciones. Puro |
| `logic/loadComunicaciones.ts` | Carga de cada pantalla; nunca lanza |
| `data/comunicacionesRepository.ts` | Todas las consultas a `com_*`. Nada de `supabase.from()` fuera de aquí |
| `data/zohoPlantillas.ts`, `data/zohoRegistros.ts` | Lecturas de Zoho. Solo lectura |
| `data/pasarela/` | La única puerta de salida: `enviarConCandado`, con la pasarela de Zoho y la simulada detrás |
| `actions/comunicaciones.ts` | Server Actions de preparación. Ninguna envía |
| `actions/envio.ts` | Server Actions del envío. Todas repiten permisos y controles en el servidor |
| `ui/pages/` | Historial, Nueva, Detalle y Ajustes |

## Convenciones del área

- **Los destinatarios son una foto.** Se calculan al preparar y no se recalculan solos: lo que se
  revisa es exactamente lo que después se enviaría, aunque el CRM cambie entre medias.
- **Nada se filtra en silencio.** Las cuentas de prueba (`inv_cuentas.excluida`) y las que solo
  tienen direcciones internas aparecen en la lista, marcadas y excluidas, con su motivo. Una cuenta
  sin contacto principal aparece como «Sin destinatario».
- **Cambiar la lista o la plantilla invalida lo ya revisado.** Excluir a alguien devuelve la
  comunicación a borrador; cambiar de plantilla anula la prueba.
- **El correo sale siempre de `inv_contactos`**: el `Email` del enlace cuenta–contacto viene vacío
  en el CRM (ver `docs/inversores/01-zoho.md`).
- **Ante la duda, no se escribe.** Una cuenta sin el dato de intermediario no entra en «Inversores
  directos»; un contacto dado de baja o sin correo no entra en ningún sitio, y se avisa.
- **Nadie llama a una pasarela.** Lo que sale, sale por `enviarConCandado`, y la llamada de envío
  de Zoho vive en un solo fichero (`data/pasarela/pasarelaZoho.ts`). Lo vigila
  `__tests__/arquitectura.test.ts`.
- **Un control es lo que comprueba el servidor**, no un botón apagado. La pantalla usa las mismas
  funciones de `logic/controles.ts` solo para explicar qué falta.
- **Antes de enviar, marcar; después, anotar.** Cada destinatario pasa a «enviando» antes de su
  correo, y si no se puede anotar el resultado el envío se detiene. Un error no se reintenta solo.

## Permisos

| Rol en la zona | Puede |
|---|---|
| Lector | Ver el historial, las listas, las vistas previas y los ajustes |
| Editor | Además, preparar, excluir destinatarios, elegir plantilla, probar y enviar |
| Admin | Además, activar los envíos, cambiar el modo y fijar cuenta de pruebas y remitentes |

La zona nace sin nadie concedido. Se concede en `/dashboard/admin/usuarios` o con
`npm run auth:grant`.

## Cómo quitarlo

Borrar `src/modules/comunicaciones`, `src/app/dashboard/comunicaciones` y
`scripts/comunicaciones`; quitar la zona de `src/registry/modules.ts` y de los mapas de etiquetas;
y, en la base, `DROP TABLE com_destinatario, com_comunicacion, com_ajustes` y la fila de
`app_zone`. Las dos columnas añadidas a `inv_*` pueden quedarse: nadie más las usa.
