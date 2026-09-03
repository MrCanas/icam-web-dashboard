# ICAM Dashboard

Portal interno de Impar Capital: gestión del portfolio inmobiliario, planificación de proyectos (PM), actas de obra, avance de obra (Zoho) y sincronización con Monday. Uso interno, <15 empleados, datos financieros sensibles.

- **Stack:** Next.js 16 (App Router, RSC) · React 19 · Tailwind 4 · Supabase (Postgres) · TypeScript.
- **Auth propia:** cookie `icam-auth` con JWT firmado (`jose`), usuarios en `app_user_*`, permisos por **zona** (`financiero`/`pm`/`adquisiciones`/`data`) y **rol** (`admin`/`editor`/`lector`), más una denylist por ruta. Ver `src/lib/auth` y `src/registry`.
- **Arquitectura:** modular, en `src/modules/<módulo>/{data,logic,ui}` + `module.ts`. Detalle en `ARCHITECTURE.md`.

## Arrancar en local

Requiere Node 24 y un `.env.local` con las variables de `.env.local.example` (pídeselas a quien administre el proyecto Supabase; no están en el repo).

```bash
npm ci --include=optional
npm run dev            # http://localhost:3000
```

> ⚠️ **Local y producción comparten la misma base de datos Supabase.** `npm run dev` y los scripts de `scripts/` escriben en datos reales. No hay entorno de staging (decisión registrada en `docs/auditoria-2026-08.md`).

## Comprobaciones

```bash
npm run check          # tsc + type-check de scripts/pm + lint + tests (lo que corre la CI)
npm test               # solo la batería de tests (src/**/__tests__)
npm run lint
npx tsc --noEmit
```

La CI (`.github/workflows/ci.yml`) ejecuta `check` en cada PR.

## Base de datos

Migraciones en `supabase/migrations/` (`<timestamp>_<NNN>_<slug>.sql`). Se aplican con `npx supabase db push` o con los scripts `pm:apply-migration-0NN` (dry-run por defecto, `--apply` para escribir, con verificación).

**Todas las migraciones del repo están aplicadas** (última comprobación: 2026-09-03).

Las 030–033 y la 035 se aplicaron ese día; la 034 ya lo estaba. Qué hizo cada una, por si
hay que auditarlas:

| Migración | Qué hizo |
|---|---|
| 030 | Cerró el acceso anónimo (`temp_allow_all` en 9 tablas, 13 lecturas públicas) |
| 031 | `replace_pm_portfolio` dejó de hacer `DELETE … WHERE true` de tres tablas `pm_*` |
| 032 | `auth_user_id_by_email` (login sin paginar `auth.users`) |
| 033 | `auth_users_display` (avatares de actas sin paginar) |
| 035 | Cerró las 5 lecturas públicas que la 030 no alcanzó, y la tabla de backup sin RLS |

La 030 se dio por buena dejando `pm_hitos` (131 filas) y `pm_snapshot_fechas` (416) todavía
legibles con la anon key: su script contaba políticas por patrón de nombre y sondeaba una
lista fija de cinco tablas. La 035 lo cierra y su script sondea **todas** las tablas del
esquema descubriéndolas del catálogo, sin listas ni convenciones de nombre. Si añades una
tabla, esa es la comprobación que la cubre:

```bash
npm run pm:apply-migration-035          # dry-run: audita, no escribe
```

## Scripts útiles

`npm run` con prefijos por área: `pm:*` (planificación, avance, migraciones), `actas:*` (Monday → actas), `portfolio:*` (SharePoint/maestro), `auth:*`. Los `*:apply-migration-*` y varios de `actas:*` son de un solo uso ya ejecutados.

## Documentación

- `ARCHITECTURE.md` — módulos, capas, registry, permisos.
- `docs/auditoria-2026-08.md` — auditoría técnica y plan de saneamiento (estado vivo).
- `docs/pm/01-avance-obra.md` — avance de obra y la integración con Zoho.
- `docs/actas/` — bitácoras de la migración de actas desde Monday (histórico).
