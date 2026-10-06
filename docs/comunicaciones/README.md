# Comunicaciones · dónde vive cada cosa

El módulo **Comunicaciones** (`/dashboard/comunicaciones`) prepara los correos a inversores
enseñando a quién irían y con qué plantilla antes de que salga nada. Esta página es el mapa: qué
piezas tiene el proyecto, en qué servicio vive cada una y cómo se llega a ella.

**Regla: el proyecto es este repo.** Todo lo demás son servicios que el repo usa, o copias suyas.
Si algo de Comunicaciones no está aquí o enlazado desde aquí, está en el sitio equivocado.

## El mapa

| Capa | Dónde vive | Qué hay de Comunicaciones | Cómo se llega |
|---|---|---|---|
| Código | GitHub `MrCanas/icam-web-dashboard`, rama `main` | Las cinco carpetas de abajo | <https://github.com/MrCanas/icam-web-dashboard> |
| Aplicación | Vercel, proyecto `icam-web-dashboard` (equipo `mrcanas-projects`) | Las pantallas de `/dashboard/comunicaciones` | <https://icam-web-dashboard.vercel.app/dashboard/comunicaciones> · panel: <https://vercel.com/mrcanas-projects/icam-web-dashboard> |
| Datos | Supabase del portal (`SUPABASE_URL`) | Tablas `com_ajustes`, `com_comunicacion`, `com_destinatario` | Panel de Supabase > Table Editor, filtrando por `com_` |
| Origen y envío | Zoho CRM, centro de datos `eu` | Cuentas, contactos, plantillas de correo y, en la fase 2, el envío | El CRM de siempre |
| Secretos | Variables de entorno de Vercel; en local, `.env.local` | Las `ZOHO_*` del portal | Vercel > Settings > Environment Variables |
| Permisos | Supabase, tabla `app_user_zone_role` | Zona `comunicaciones` | `/dashboard/admin/usuarios` |

Tres cosas del mapa que no se deducen solas:

- **Producción sale de `main`.** Cada PR tiene además su versión de previsualización en Vercel.
- **Hay una sola base de datos.** Las previsualizaciones y producción leen y escriben en la misma;
  una migración aplicada vale para todas a la vez.
- **Los secretos no están en GitHub.** `.env.local` está en `.gitignore`. Quien clone el repo
  necesita que alguien le pase las variables o las baje con `npx vercel env pull`.

## Dentro del repo

| Qué | Carpeta |
|---|---|
| Código del módulo | `src/modules/comunicaciones/` — empezar por su `README.md` |
| Páginas | `src/app/dashboard/comunicaciones/` |
| Scripts | `scripts/comunicaciones/` |
| Migración | `supabase/migrations/20261006120000_047_comunicaciones.sql` |
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

Si algún día se quisiera sacar a un servicio aparte, la frontera ya está pensada: en la fase 2
todo envío pasa por una única pasarela de correo (ver `02-fase-2-envio.md`).

Un riesgo conocido: el repo y el proyecto de Vercel cuelgan de la cuenta personal `MrCanas`, no de
una organización de Impar Capital.

## Los documentos

| Documento | Para qué |
|---|---|
| [`00-estado-y-pendientes.md`](00-estado-y-pendientes.md) | Qué pasó, qué está hecho, qué falta y quién lo hace |
| [`01-puesta-en-marcha.md`](01-puesta-en-marcha.md) | Dejar la fase 1 funcionando y comprobarla |
| [`02-fase-2-envio.md`](02-fase-2-envio.md) | Especificación del envío con controles |
| [`03-guia-de-uso.md`](03-guia-de-uso.md) | Una página para quien prepara comunicaciones |
