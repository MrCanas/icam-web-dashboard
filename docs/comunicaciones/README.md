# Comunicaciones · dónde vive cada cosa

El módulo **Comunicaciones** (`/dashboard/comunicaciones`) prepara los correos a inversores
enseñando a quién irían y con qué plantilla antes de que salga nada, y los envía con controles.
Esta página es el mapa: qué piezas tiene el proyecto, en qué servicio vive cada una y cómo se llega
a ella.

**Hay un candado de destinatarios puesto**: hoy el módulo solo puede escribir a dos direcciones
(`javiercanas@imparcapital.com` e `iranzuvicente@imparcapital.com`), y solo sobre las cuentas de
prueba del CRM. Se comprueba sin enviar nada con `npm run comunicaciones:candado-verificar`. Ver
[`02-envio-con-controles.md`](02-envio-con-controles.md) § 1.

**Regla: el proyecto es este repo.** Todo lo demás son servicios que el repo usa, o copias suyas.
Si algo de Comunicaciones no está aquí o enlazado desde aquí, está en el sitio equivocado.

## El mapa

| Capa | Dónde vive | Qué hay de Comunicaciones | Cómo se llega |
|---|---|---|---|
| Código | GitHub `MrCanas/icam-web-dashboard`, rama `main` | Las cinco carpetas de abajo | <https://github.com/MrCanas/icam-web-dashboard> |
| Aplicación | Vercel, proyecto `icam-web-dashboard` (equipo `mrcanas-projects`) | Las pantallas de `/dashboard/comunicaciones` | <https://icam-web-dashboard.vercel.app/dashboard/comunicaciones> · panel: <https://vercel.com/mrcanas-projects/icam-web-dashboard> |
| Datos | Supabase del portal (`SUPABASE_URL`) | Tablas `com_ajustes`, `com_comunicacion`, `com_destinatario`, `com_enlace`, `com_evento` y la función `com_registrar_evento` | Panel de Supabase > Table Editor, filtrando por `com_` |
| Origen y envío | Zoho CRM, centro de datos `eu` | Cuentas, contactos, plantillas de correo y el envío. Cada correo queda en la ficha del registro sobre el que se envió | El CRM de siempre |
| Seguimiento | Dominio `go.imparcapital.com`: DNS en Cloudflare (zona `imparcapital.com`), servido por el mismo proyecto de Vercel | La imagen de apertura y los enlaces de cada correo pasan por él. Solo sirve `/api/s/*` | Cloudflare > DNS: `CNAME go`. Vercel > Settings > Domains |
| Secretos y configuración | Variables de entorno de Vercel; en local, `.env.local` | Las `ZOHO_*` del portal; `ZOHO_REFRESH_TOKEN_ENVIOS`, que va **solo en Production**; y `COMUNICACIONES_SEGUIMIENTO_URL` (`https://go.imparcapital.com` en producción) | Vercel > Settings > Environment Variables |
| Rastro | Supabase, tabla `audit_log` | Quién preparó, revisó, probó, confirmó y envió, y cada cambio de ajustes | Acciones que empiezan por `comunicaciones.` |
| Permisos | Supabase, tabla `app_user_zone_role` | Zona `comunicaciones` | `/dashboard/admin/usuarios` |

Cosas del mapa que no se deducen solas:

- **Producción sale de `main`.** Cada PR tiene además su versión de previsualización en Vercel.
- **Hay una sola base de datos.** Las previsualizaciones y producción leen y escriben en la misma;
  una migración aplicada vale para todas a la vez.
- **Los secretos no están en GitHub.** `.env.local` está en `.gitignore`. Quien clone el repo
  necesita que alguien le pase las variables o las baje con `npx vercel env pull`.
- **Dónde puede salir un correo de verdad**: solo donde exista el token de envíos. En las
  previsualizaciones no existe, y allí la pasarela es la simulada. En una copia local que sí lo
  tenga, `COMUNICACIONES_PASARELA=simulada` fuerza la simulada (dejar el token vacío al arrancar
  no basta: el cargador de `.env.local` lo rellena).
- **El seguimiento solo funciona de verdad en producción**: `go.imparcapital.com` apunta a
  producción. En local los enlaces llevan `http://localhost:…` y solo valen en ese equipo.

## Dentro del repo

| Qué | Carpeta |
|---|---|
| Código del módulo | `src/modules/comunicaciones/` — empezar por su `README.md` |
| Páginas | `src/app/dashboard/comunicaciones/` |
| Rutas públicas de seguimiento | `src/app/api/s/` (y el bloque del dominio en `src/proxy.ts`) |
| Scripts | `scripts/comunicaciones/` |
| Migraciones | `supabase/migrations/…_047_comunicaciones.sql`, `…_048_comunicaciones_envio.sql` y `…_049_comunicaciones_analitica.sql` |
| Documentos | `docs/comunicaciones/` (esta carpeta) |

El módulo depende de dos piezas que no son suyas:

- **El espejo de Inversores** (`inv_*`, `src/modules/portfolio/inversores/`). De ahí salen las
  cuentas, los contactos y sus papeles. Se copia de Zoho cada día a las 06:00 y con el botón
  «Actualizar datos de Zoho». Ver `docs/inversores/01-zoho.md`.
- **El cliente de Zoho** (`src/lib/zoho/client.ts`), compartido con Inversores y Avance de obra.

## Fuera del repo

Lo que hay en el PC de Javier Canas y no es el proyecto, sino copias o historia:

| Carpeta | Qué es |
|---|---|
| `Documents\icam_dashboard` | Copia de trabajo principal del repo |
| `Documents\icam_dashboard-comunicaciones` | Copia temporal de la rama de la PR #64. Se retira tras el merge |
| OneDrive `Documentos\ZohoCRM-Automations\archivo\2026-10-05-kiosk\` | El kiosk de Zoho retirado, como referencia |
| OneDrive `Documentos\ZohoCRM-Automations\docs\destinatarios-envio-zurbaran5-2026-10-05.md` | A quién llegó el envío erróneo del 2026-10-05 |

## Cómo crece

El módulo está aislado a propósito: carpeta propia, tablas con prefijo `com_` y zona de permisos
propia. Añadir funcionalidad es añadir dentro de esas mismas carpetas, con una PR a `main` y, si
hace falta, una migración aditiva más.

Si algún día se quisiera sacar a un servicio aparte, la frontera ya existe: todo envío pasa por una
única pasarela de correo (ver `02-envio-con-controles.md` § 3).

Antes de abrirlo a audiencias reales hay tres cosas que resolver: quitar el candado, que es una
decisión; el límite de Zoho de 100 correos al día por usuario, que es un hecho; y confirmar con
quien lleve protección de datos el registro de aperturas y clics por persona.

Un riesgo conocido: el repo y el proyecto de Vercel cuelgan de la cuenta personal `MrCanas`, no de
una organización de Impar Capital.

## Los documentos

| Documento | Para qué |
|---|---|
| [`00-estado-y-pendientes.md`](00-estado-y-pendientes.md) | Qué pasó, qué está hecho, qué falta y quién lo hace |
| [`01-puesta-en-marcha.md`](01-puesta-en-marcha.md) | Dejarlo funcionando y comprobarlo, paso a paso |
| [`02-envio-con-controles.md`](02-envio-con-controles.md) | El candado, los nueve controles, la pasarela y el token de envíos |
| [`03-guia-de-uso.md`](03-guia-de-uso.md) | Para quien prepara y envía comunicaciones |
| [`04-analitica-y-reenvio.md`](04-analitica-y-reenvio.md) | El seguimiento de aperturas y clics, el ensayo general, las validaciones, el panel y el reenvío |
