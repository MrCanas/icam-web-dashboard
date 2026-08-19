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

**Migraciones pendientes de aplicar** (código en el repo, `--apply` no lanzado):

| Migración | Qué hace |
|---|---|
| 030 | Cierra el acceso anónimo (RLS `temp_allow_all`) — **crítica** |
| 031 | `replace_pm_portfolio` no destructivo (conserva los mapeos de la PMO) |
| 032 | `auth_user_id_by_email` (login sin paginar) |
| 033 | `auth_users_display` (avatares de actas sin paginar) |

```bash
npm run pm:apply-migration-030 -- --apply   # y 031
# 032/033: npx supabase db push, o el runner que uses
```

## Scripts útiles

`npm run` con prefijos por área: `pm:*` (planificación, avance, migraciones), `actas:*` (Monday → actas), `portfolio:*` (SharePoint/maestro), `auth:*`. Los `*:apply-migration-*` y varios de `actas:*` son de un solo uso ya ejecutados.

## Documentación

- `ARCHITECTURE.md` — módulos, capas, registry, permisos.
- `docs/auditoria-2026-08.md` — auditoría técnica y plan de saneamiento (estado vivo).
- `docs/pm/01-avance-obra.md` — avance de obra y la integración con Zoho.
- `docs/actas/` — bitácoras de la migración de actas desde Monday (histórico).
