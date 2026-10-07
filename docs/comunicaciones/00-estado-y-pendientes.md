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

Todo llegó a `main` con la PR #64 (`feat/comunicaciones-lectura`), mergeada el 2026-10-07.

| Pieza | Estado |
|---|---|
| Audiencia, destinatarios, plantilla, vista previa, historial | Hecho |
| Envío con los nueve controles | Hecho. Ver [`02-envio-con-controles.md`](02-envio-con-controles.md) |
| Candado de destinatarios | Hecho y **puesto**. Solo se puede enviar a `PROMOCIONTEST` |
| Pasarela de correo, real y simulada | Hecho |
| Pruebas automáticas del candado y de cada control | Hechas, dentro de `npm run check` |
| Migración 047 (tablas y zona) | Aplicada el 2026-10-06 |
| Migración 048 (columnas del envío) | Aplicada el 2026-10-06 |
| Seguimiento propio de aperturas y clics; el correo lo monta el portal | Hecho. Ver [`04-analitica-y-reenvio.md`](04-analitica-y-reenvio.md) |
| Ensayo general con huella, validaciones de direcciones y de cada correo, tope diario | Hecho |
| Panel de analítica, por correo y agregado, y reenvío por filtro | Hecho |
| Migración 049 (seguimiento y analítica) | Aplicada el 2026-10-06 |
| Dominio `go.imparcapital.com` | Añadido al proyecto de Vercel. **Falta el registro DNS en Cloudflare** (§5) |
| Seguimiento desde la comunicación (todos los que lo recibieron, o un filtro) con elección de plantilla | Hecho el 2026-10-07. Ver [`04-analitica-y-reenvio.md`](04-analitica-y-reenvio.md) § 7 |
| «Nueva» dice qué falta en vez de apagar el botón; DNS solo de la audiencia | Hecho el 2026-10-07 |
| Rediseño: cabeceras con chips, stepper, pestañas, tarjetas KPI, ayuda en ⓘ y desplegables, piezas compartidas en `src/components/ui/` | Hecho el 2026-10-07. Revisado en local con la pasarela simulada; pendiente de que Javier lo vea |
| Zona `comunicaciones` | Concedida solo a `javiercanas@imparcapital.com`, como admin |
| Ajustes | Envíos **desactivados** y modo **pruebas**. Cuenta de pruebas: TEST CUENTA JCV_Updated. Remitente permitido: `javiercanas@imparcapital.com`. Tope diario: 100 |
| PR #64 | **Mergeada el 2026-10-07**. Producción (`main`) tiene el módulo entero con el candado puesto, los envíos desactivados y, mientras falten las variables de abajo, la pasarela simulada |
| Token de envíos | Generado el 2026-10-06 con el usuario de Javier Canas. Solo en el `.env.local` de su copia de trabajo (`Documents\icam_dashboard`); **falta ponerlo en Vercel (Production)** |
| `COMUNICACIONES_SEGUIMIENTO_URL` | En local, `http://localhost:3100`. **Falta ponerla en Vercel**: `https://go.imparcapital.com` |

### Probado el 2026-10-06

Recorrido completo en local, primero con la pasarela simulada y después con envíos reales por
Zoho, siempre bajo el candado. Salieron **cuatro correos reales, los cuatro solo a
`javiercanas@imparcapital.com`**, y llegaron a su buzón:

| Qué | Modo | Registro de Zoho | Llegó a |
|---|---|---|---|
| Prueba obligatoria | — | TEST CUENTA JCV_Updated | `javiercanas@imparcapital.com` |
| Envío a `PROMOCIONTEST`, dos cuentas | Pruebas | CUENTA MASTER | `javiercanas@imparcapital.com` (redirigido). La segunda cuenta, omitida por dirección repetida |
| Prueba obligatoria | — | TEST CUENTA JCV_Updated | `javiercanas@imparcapital.com` |
| Envío a `PROMOCIONTEST`, solo TEST CUENTA JCV_Updated | Real | TEST CUENTA JCV_Updated | `javiercanas@imparcapital.com` |

Además:

- Una comunicación a «Toda la base» (125 correos) se preparó y se descartó sin enviar. El candado
  no dejaba salir ninguno de sus correos, ni en modo pruebas ni en modo real, y la página no ofrecía
  ningún paso de envío.
- El número mal tecleado no dejó confirmar.
- `npm run comunicaciones:candado-verificar` termina con «Ningún correo, enviado o por enviar,
  lleva una dirección fuera de la lista cerrada».

Sin probar en el navegador: Detener y Reanudar a mitad de un envío (con dos correos la tanda acaba
de una vez). Lo cubren las pruebas automáticas de `logic/controles.ts`.

Un detalle de datos que apareció: el correo enviado sobre CUENTA MASTER salió con «Buenas tardes ,»
porque esa cuenta de prueba tiene vacío el campo del saludo. La vista previa lo avisa como «campo
vacío».

### Probado el 2026-10-06, con el seguimiento

Segundo recorrido, ya con el correo montado por el portal, el ensayo general y la analítica.
Primero simulado y después real: **otros cuatro correos, los cuatro solo a
`javiercanas@imparcapital.com`**, comprobados en su buzón (ocho en total en el día, más dos de una
comprobación técnica previa, todos a esa misma dirección).

| Qué | Modo | Registro de Zoho | Llegó a |
|---|---|---|---|
| Prueba obligatoria | — | TEST CUENTA JCV_Updated | `javiercanas@imparcapital.com` |
| Envío a `PROMOCIONTEST`, solo TEST CUENTA JCV_Updated | Real | TEST CUENTA JCV_Updated | `javiercanas@imparcapital.com` |
| Prueba obligatoria del reenvío | — | TEST CUENTA JCV_Updated | `javiercanas@imparcapital.com` |
| Reenvío desde el filtro «Hizo clic» | Real | TEST CUENTA JCV_Updated | `javiercanas@imparcapital.com` |

Qué se vio, y los tres fallos que destapó y quedaron corregidos, en
[`04-analitica-y-reenvio.md`](04-analitica-y-reenvio.md) § 9. Lo que **no** se ha podido comprobar
todavía son las aperturas con el correo de verdad: hace falta que la PR esté en producción.

### Revisión de Javier del 2026-10-07

Vio el módulo en local y pidió tres cosas, hechas ese día: poder enviar un **seguimiento desde la
propia comunicación** a todos los destinatarios o a un filtro (no abrieron, no hicieron clic…);
arreglar «Nueva», donde el botón se quedaba gris al elegir una promoción sin decir por qué (faltaba
el tipo de comunicación, o los datos de hoy); y un **rediseño a fondo** del aspecto, que tenía
demasiado texto explicativo y no seguía el sistema del portal. El servidor local se le paraba solo:
no era el portal, sino Claude Code matando el proceso por falta de memoria en el equipo
([`01-puesta-en-marcha.md`](01-puesta-en-marcha.md) § 5).

Fuera de alcance por ahora: recordatorios automáticos, confirmación de asistencia a eventos, listas
propias y aprobación por una segunda persona.

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

La PR #64 se mergeó el 2026-10-07. En el orden en que tiene sentido:

| Tarea | Quién |
|---|---|
| Crear en Cloudflare `CNAME go → 1429ddcbf3c9f778.vercel-dns-017.com` (solo DNS, sin proxy), comprobando antes que no exista ya un registro `go`. El dominio ya está en el proyecto de Vercel | Javier (o Claude con su sesión de Cloudflare) |
| En Vercel, entorno Production: `COMUNICACIONES_SEGUIMIENTO_URL=https://go.imparcapital.com` y `ZOHO_REFRESH_TOKEN_ENVIOS` (el del `.env.local`; `npx vercel env add ZOHO_REFRESH_TOKEN_ENVIOS production`) | Javier |
| Comprobar una apertura real: activar envíos, enviarse un correo desde producción (solo a él, bajo el candado), abrirlo cargando las imágenes y verla en la analítica. Al terminar, envíos desactivados | Javier |
| Borrar los cuatro módulos y la conexión del CRM (§4) | Javier |
| Confirmar con protección de datos el registro de aperturas y clics por persona | Antes de quitar el candado |
| Resolver el límite de 100 correos al día de Zoho | Antes de quitar el candado |
| Quitar el candado, en otra PR | Cuando Javier lo decida |
