# Comunicaciones · estado y pendientes

Estado a **2026-10-06**. Quien retome el proyecto empieza por aquí.

## 1. Qué pasó

Los correos a inversores salían del kiosk «Emails a Fondos/Promos» de Zoho CRM, que no enseña a
quién va a escribir. El 2026-10-05 se construyó dentro del CRM un kiosk nuevo, «Enviar
comunicaciones», para ampliarlo. Ese mismo día **envió 60 correos por error** («Oportunidad de
inversión: Zurbarán, 5») a inversores reales: el envío era la opción por defecto y en ningún paso
se veía la lista de destinatarios ni cómo quedaba la plantilla.

Los 60 correos no se pueden deshacer y siguen visibles en la ficha de cada Cuenta de Inversión. La
lista de a quién llegaron está fuera del repo, en
`ZohoCRM-Automations\docs\destinatarios-envio-zurbaran5-2026-10-05.md`.

## 2. Decisiones (Javier Canas, 2026-10-06)

- Lo creado en el CRM se retira entero y se rehace como **módulo del portal**, no como servicio
  aparte ni como repo nuevo.
- **Zona de permisos propia**, `comunicaciones`, que nadie ve hasta que se le concede.
- Los correos se siguen enviando **con Zoho CRM y sus plantillas actuales**, no con Microsoft 365.
- El permiso de envío va en un **token de Zoho separado** que solo existe en Producción de Vercel.
- Todo el material del proyecto vive junto, en este repo (ver [`README.md`](README.md)).

Y una norma que no se negocia: nada que envíe correos a inversores se construye con el envío por
defecto, ni sin pantalla de destinatarios, prueba previa y confirmación explícita.

## 3. Fases

| Fase | Qué es | Estado |
|---|---|---|
| 0 | Retirar del CRM lo creado el 2026-10-05 | Casi: quedan dos borrados (§4) |
| 1 | Módulo de solo lectura: audiencia, destinatarios, plantilla, historial | Código hecho, PR #64 abierta |
| 2 | Envío con controles | Sin empezar. Especificada en [`02-fase-2-envio.md`](02-fase-2-envio.md) |
| 3 | Puesta en marcha del envío con el equipo | Sin empezar |

Fuera de alcance por ahora: seguimiento de aperturas y rebotes, recordatorios, confirmación de
asistencia a eventos, listas propias y aprobación por una segunda persona.

### Fase 1, pieza a pieza

| Pieza | Estado |
|---|---|
| Código (`feat/comunicaciones-lectura`) | Hecho. No contiene ninguna llamada de envío |
| PR #64 a `main` | Abierta, sin conflictos, CI y previsualización en verde |
| Migración 047 | Aplicada el 2026-10-06 |
| Zona `comunicaciones` | Concedida solo a `javiercanas@imparcapital.com`, como admin (2026-10-06) |
| «Actualizar datos de Zoho» tras la migración | **Sin hacer**: hasta entonces «Inversores directos» sale vacía |
| Recorrido en el navegador | **Sin hacer** |

Los pasos para cerrarla están en [`01-puesta-en-marcha.md`](01-puesta-en-marcha.md).

## 4. Lo que queda por borrar en el CRM

Ya están borrados el kiosk «Enviar comunicaciones», la programación «Comunicaciones envio y
seguim» y las nueve funciones `com_*`. Quedan dos cosas, y las borra una persona desde el CRM
porque borrar un módulo elimina sus registros de forma permanente.

**1. Los cuatro módulos**, en Configuración > Personalización > Módulos y campos, **en este
orden**:

| Orden | Nombre API | Etiqueta |
|---|---|---|
| 1 | `Com_Miembros_de_lista` | Miembros de lista |
| 2 | `Com_Destinatarios` | Destinatarios |
| 3 | `Com_Comunicaciones` | Comunicaciones |
| 4 | `Com_Listas` | Listas de comunicación |

Con ellos desaparecen sus registros, sus botones y las listas relacionadas que Zoho añadió a las
fichas de Cuenta de Inversión, Contacto y Promoción.

**2. La conexión `comunicaciones_crm`**, después de los módulos, en Configuración > Espacio para
desarrolladores > Conexiones.

**Cómo comprobar que quedó limpio:**

- No queda ningún módulo, función, kiosk, programación ni conexión con «Com_», «com_» o
  «Comunicaciones» en el nombre.
- El kiosk «Emails a Fondos/Promos» sigue en la versión 18, con fecha 2026-07-03.
- Las fichas de Cuenta de Inversión ya no muestran «Comunicaciones recibidas» ni «Listas de
  comunicación».

## 5. Quién hace qué

| Tarea | Quién |
|---|---|
| Borrar los cuatro módulos y la conexión del CRM (§4) | Javier |
| Actualizar los datos de Zoho y ver las tres pantallas con datos reales | Javier |
| Mergear la PR #64 (`main` es producción) | Javier |
| Dar el visto bueno para empezar la fase 2 | Javier |
| Generar el token de envío y guardarlo en Vercel, solo en Producción | Javier, en la fase 2 |
| Programar la fase 2, en su propia rama y su propia PR | Quien desarrolle |
| Activar el modo real y lanzar cualquier envío real | Javier. Nunca un asistente ni un script |
