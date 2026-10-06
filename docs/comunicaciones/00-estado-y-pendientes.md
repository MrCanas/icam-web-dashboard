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
- El permiso de envío va en un **token de Zoho separado**.
- Todo el material del proyecto vive junto, en este repo (ver [`README.md`](README.md)).
- El módulo se construye entero, envío incluido, en una sola PR, **con un candado de
  destinatarios**: el único destinatario posible es `javiercanas@imparcapital.com` o los contactos
  principales de la promoción de prueba del CRM. Quitar el candado es una decisión aparte.

Y una norma que no se negocia: nada que envíe correos a inversores se construye con el envío por
defecto, ni sin pantalla de destinatarios, prueba previa y confirmación explícita.

## 3. Qué hay construido

Todo en la PR #64 (`feat/comunicaciones-lectura`).

| Pieza | Estado |
|---|---|
| Audiencia, destinatarios, plantilla, vista previa, historial | Hecho |
| Envío con los nueve controles | Hecho. Ver [`02-envio-con-controles.md`](02-envio-con-controles.md) |
| Candado de destinatarios | Hecho y **puesto**. Solo se puede enviar a `PROMOCIONTEST` |
| Pasarela de correo, real y simulada | Hecho |
| Pruebas automáticas del candado y de cada control | Hechas, dentro de `npm run check` |
| Migración 047 (tablas y zona) | Aplicada el 2026-10-06 |
| Migración 048 (columnas del envío) | Escrita y simulada. Ver §5 |
| Zona `comunicaciones` | Concedida solo a `javiercanas@imparcapital.com`, como admin |
| Ajustes | Envíos **desactivados** y modo **pruebas** |

Fuera de alcance por ahora: seguimiento de aperturas y rebotes, recordatorios, confirmación de
asistencia a eventos, listas propias y aprobación por una segunda persona.

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

## 5. Pendientes, y quién hace cada uno

| Tarea | Quién |
|---|---|
| Aplicar la migración 048 | Javier, o quien él autorice (escribe en producción) |
| Generar el token de envíos (`npm run comunicaciones:zoho-auth-envios`) | Javier: es un inicio de sesión suyo en Zoho |
| Recorrido completo: primero con la pasarela simulada, después con envíos reales bajo el candado | Ver [`01-puesta-en-marcha.md`](01-puesta-en-marcha.md) § 5 y § 6 |
| Borrar los cuatro módulos y la conexión del CRM (§4) | Javier |
| Mergear la PR #64 (`main` es producción) | Javier |
| Guardar el token de envíos en Vercel, **solo en Production** | Javier, tras el merge |
| Resolver el límite de 100 correos al día de Zoho | Antes de quitar el candado |
| Quitar el candado, en otra PR | Cuando Javier lo decida |
