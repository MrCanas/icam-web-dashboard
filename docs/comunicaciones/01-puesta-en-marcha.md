# Comunicaciones · puesta en marcha

Los pasos para dejar el módulo funcionando y comprobado, del primero al último.

Los pasos 1, 2 y 4 **escriben en la base de producción** (solo hay una, ver
[`README.md`](README.md)). Los autoriza Javier Canas cada vez.

Mientras el candado de destinatarios esté puesto, nada de lo que hay aquí puede escribir a un
inversor: ver [`02-envio-con-controles.md`](02-envio-con-controles.md) § 1.

## 1. Aplicar las migraciones

```bash
npm run comunicaciones:apply-migration-047             # simulación: aplica y revierte
npm run comunicaciones:apply-migration-047 -- --apply
npm run comunicaciones:apply-migration-048
npm run comunicaciones:apply-migration-048 -- --apply
npm run comunicaciones:apply-migration-049
npm run comunicaciones:apply-migration-049 -- --apply
```

Las tres son aditivas e idempotentes. Cada script aplica la suya dos veces dentro de una
transacción, enseña cómo queda y **solo confirma si todo cuadra**; si no, hace ROLLBACK.

| Migración | Qué crea | Qué tiene que imprimir |
|---|---|---|
| 047 | Zona `comunicaciones`, tablas `com_ajustes`, `com_comunicacion`, `com_destinatario` y dos columnas en el espejo de Inversores | Seis zonas, `Ajustes: 1 fila · envíos desactivados · modo pruebas`, tres tablas con RLS y 0 políticas |
| 048 | Las columnas del envío: prueba enviada, pasarela, a quién salió de verdad cada correo y el estado `omitido` | Siete columnas con `✓` y un solo CHECK de `estado_envio` que incluye `omitido` |

| 049 | Seguimiento y analítica: identificador y huella de cada correo, `com_enlace`, `com_evento`, la función `com_registrar_evento`, el ensayo general, el reenvío y el tope diario | «Columnas nuevas: N de N», las tablas `com_*` con RLS y 0 políticas, la función `com_registrar_evento` ejecutable solo por `service_role` y sus comprobaciones con `✓` |

Sin la 047 las páginas dicen que falta. Sin la 048 se puede preparar y revisar, pero la prueba y la
confirmación se niegan **antes** de enviar nada. Sin la 049 no hay ensayo general, y sin ensayo no
se confirma.

## 1 bis. La dirección de seguimiento

La prueba, el ensayo y el envío necesitan **`COMUNICACIONES_SEGUIMIENTO_URL`**: de ella cuelgan la
imagen de apertura y los enlaces de cada correo. Sin ella se niegan antes de enviar nada.

| Dónde | Valor |
|---|---|
| Producción (Vercel) | `https://go.imparcapital.com` |
| Local | `http://localhost:<puerto>` del servidor de desarrollo. Los enlaces solo valen en ese equipo |

El dominio y su registro DNS, en [`04-analitica-y-reenvio.md`](04-analitica-y-reenvio.md) § 3.

## 2. Conceder la zona

La zona nace sin nadie. Se concede en `/dashboard/admin/usuarios` o por consola:

```bash
npm run auth:grant -- javiercanas@imparcapital.com comunicaciones admin
npm run auth:grant -- <email> comunicaciones none      # revocar
```

| Rol | Puede |
|---|---|
| `lector` | Ver el historial, las listas, las vistas previas y los ajustes |
| `editor` | Además, preparar, excluir destinatarios, elegir plantilla, probar y enviar |
| `admin` | Además, activar los envíos, cambiar el modo y fijar cuenta de pruebas y remitentes |

## 3. Actualizar los datos de Zoho

En «Nueva comunicación», pulsar **«Actualizar datos de Zoho»**. Es la sincronización de Inversores
de siempre: solo lee de Zoho y tarda alrededor de un minuto.

Hace falta una vez tras la migración 047, porque es la que rellena las dos columnas nuevas. Y hace
falta **cada día** que se vaya a preparar una comunicación.

> Hasta que la PR esté en `main`, el cron diario de producción no rellena esas dos columnas: corre
> el código de `main`, que aún no las conoce. Solo las rellena una sincronización lanzada desde la
> previsualización de la PR o en local.

## 4. Ajustes de envío

En **Comunicaciones > Ajustes**, con rol admin:

- **Cuenta de pruebas**: una de las cuentas de prueba de `PROMOCIONTEST`.
- **Remitentes permitidos**: las direcciones que devuelva `npm run comunicaciones:zoho-envio-verificar`.
- **Envíos activados** y **modo**: nacen apagados y en pruebas. Se encienden solo para enviar.

## 5. Comprobar con la pasarela simulada

Donde no existe el token de envíos (las previsualizaciones, o una copia local sin él) el recorrido
se completa y **no sale ningún correo**. En una copia local que **sí** tiene el token en
`.env.local`, hay que forzarla:

```bash
COMUNICACIONES_PASARELA=simulada npx next dev --webpack          # bash
$env:COMUNICACIONES_PASARELA='simulada'; npx next dev --webpack  # PowerShell
```

Arrancar con el token vacío **no basta**: el cargador de `.env.local` rellena las variables vacías.
Antes de pulsar nada, comprobar que la banda de la página dice **«Pasarela simulada»** y no «Salen
por Zoho».

- [ ] **Historial**: carga, con la banda «Candado de destinatarios activo» y las direcciones
      permitidas. La pestaña le aparece a quien tiene la zona y a nadie más.
- [ ] **Nueva**: «Toda la base» ronda las **164 cuentas** e «Inversores directos» las **87**.
- [ ] **Detalle** de «Toda la base»: alrededor de **22 «Sin destinatario»**; las cuentas de prueba y
      las internas, marcadas y excluidas. El CSV trae la misma lista.
- [ ] **Plantilla**: la vista previa resuelve los campos combinados.
- [ ] **El candado para una audiencia real**: en el detalle de «Toda la base», la sección «Envío»
      dice «Esta comunicación no se puede enviar» y no ofrece ningún paso. Y `npm run
      comunicaciones:candado-verificar` contesta que el candado deja salir 0 correos de ella, en
      modo pruebas y en modo real.
- [ ] **Recorrido completo con `PROMOCIONTEST`**: preparar, volver a incluir las cuentas de prueba
      (nacen excluidas), revisar, enviarse la prueba, darla por buena, hacer el ensayo general,
      teclear el número y enviar. Todo queda marcado «(simulado)».
- [ ] **Analítica**: la comunicación simulada tiene su página de analítica, con el aviso de que
      sus cifras no miden a nadie, y aparece en el agregado bajo «Fuera de las cifras».
- [ ] **Detener** a mitad y **Reanudar**.
- [ ] **Sin regresiones**: la pestaña Inversores carga, y «Subir a Zoho» de Avance de obra sigue
      disponible.

Las cifras salen del recuento hecho en el CRM el 2026-10-05 y se mueven con el día a día.

## 6. Comprobar con envíos reales, bajo el candado

Hace falta el token de envíos en el entorno donde se pruebe
([`02-envio-con-controles.md`](02-envio-con-controles.md) § 5):

```bash
npm run comunicaciones:zoho-auth-envios
npm run comunicaciones:zoho-envio-verificar
```

1. En Ajustes: envíos activados, **modo pruebas**.
2. Preparar `PROMOCIONTEST`, incluir sus cuentas de prueba, revisar, y enviarse la prueba. Tiene
   que llegar, con la plantilla resuelta.
3. Confirmar y enviar en modo pruebas: todos los correos llegan a quien envía.
4. Cambiar a **modo real** y repetir con una comunicación nueva. Los correos llegan a los contactos
   principales de las cuentas incluidas, y solo a ellos.
5. Pulsar un enlace del correo recibido y ver el clic en **Analítica** de esa comunicación. Con un
   filtro aplicado, «Preparar reenvío»: nace un borrador con solo esas cuentas.
6. Al terminar: **modo pruebas y envíos desactivados**.

Cada correo queda en la ficha de la cuenta de prueba en Zoho y, en el detalle de la comunicación,
con la dirección a la que salió y su identificador.

## Diagnóstico

```bash
npm run comunicaciones:zoho-descubrir         # qué ve el token de lectura: campos y plantillas
npm run comunicaciones:zoho-envio-verificar   # el token de envíos y sus remitentes
```

| Síntoma | Causa probable |
|---|---|
| La pestaña no aparece | La zona no está concedida a ese usuario |
| «Falta aplicar la migración `047_comunicaciones`» | Paso 1 sin hacer |
| «Faltan las columnas del envío» | Falta la migración 048 |
| «Inversores directos» sale con 0 cuentas | Paso 3 sin hacer |
| «No son de hoy: actualízalos antes de preparar» | La copia de Zoho es de ayer |
| «Los envíos están desactivados» | El interruptor general, en Ajustes |
| «… no está entre los remitentes permitidos» | Falta esa dirección en Ajustes |
| «Zoho no acepta … como remitente» | Esa dirección no es del usuario dueño del token |
| «Candado de destinatarios: …» | Es el candado haciendo su trabajo |
| «Pasarela simulada» donde debería enviar | Falta el token de envíos en ese entorno, o está puesto `COMUNICACIONES_PASARELA=simulada` |
| «Salen por Zoho» en una copia local que se quería simulada | Falta `COMUNICACIONES_PASARELA=simulada` al arrancar |
| «Falta la dirección de seguimiento…» | Falta `COMUNICACIONES_SEGUIMIENTO_URL` en ese entorno |
| «Con esta plantilla el correo no saldría» | La plantilla usa un campo que el portal no resuelve (importe, fecha, otro módulo, firma) |
| «El correo ya no es el que se ensayó» | Algo cambió en Zoho o en la plantilla entre el ensayo y el envío. Preparar otra |
| «Tope diario: …» | El envío no cabe en lo que queda del día |
| `LIMIT_EXCEEDED` | El límite diario de Zoho: 100 correos por usuario |
| No llegan plantillas | El token de lectura caducó: ver `docs/inversores/01-zoho.md` § Credenciales |

## Cómo quitarlo

Está en el `README.md` del módulo, § «Cómo quitarlo».
