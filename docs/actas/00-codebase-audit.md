# Auditoría del codebase — ICAM Dashboard

**Fecha:** 2026-05-21  
**Alcance:** inspección estática del repositorio `icam-web-dashboard` (sin cambios de código fuera de `/docs/`).

---

## 1. Stack tecnológico

| Área | Detalle |
|------|---------|
| **Framework** | **Next.js 16.2.4** (App Router). No es Vite ni CRA. |
| **UI runtime** | **React 19.2.4** / **react-dom 19.2.4** |
| **Lenguaje** | TypeScript 5.x (`strict: true`, alias `@/*` → `./src/*`) |
| **Estilos** | **Tailwind CSS 4** (`@tailwindcss/postcss`, `globals.css` con `@import "tailwindcss"`). Tokens de marca en `tailwind.config.js` (icam-900, gold, page, card, text-*). |
| **Gráficos** | **Recharts 3.8.1** (portfolio y visualizaciones PM donde aplica) |
| **Excel** | **xlsx 0.18.5** (carga portfolio y PM) |
| **UI library de componentes** | **No hay** MUI, shadcn, Radix, etc. Componentes propios en `src/components/` y `src/modules/*/ui/`. |
| **Build** | `next build --webpack` (producción con Webpack; dev usa Turbopack según `next.config.ts`) |

### Routing

- **App Router** bajo `src/app/`.
- Entrada raíz: `/` → redirecciones/landing según `src/app/page.tsx`.
- Dashboard: `/dashboard/*` con layout compartido (`src/app/dashboard/layout.tsx`).
- Redirects legacy en `next.config.ts` (`/dashboard` → portfolio, rutas antiguas de rentabilidad/proyectos/tendencias).
- **Navegación declarativa**: `src/registry/modules.ts` + `src/registry/platform-nav.ts`; el shell (`DashboardNav`) deriva pestañas primarias y secundarias de esos registros.

### State management

- **Sin** Redux, Zustand, Jotai ni React Query.
- **Server Components**: la mayoría de páginas de módulo cargan datos en el servidor con `await getCurrentUser()` + repositorios Supabase.
- **Cliente**: estado local con `useState` / `useEffect` en componentes `"use client"` (p. ej. Gantt PM, `useProyectos`, menú móvil).
- **Identidad global**: `CurrentUserProvider` + `useCurrentUser()` (`src/lib/auth/`), alimentado por `GET /api/me`.

### Data fetching

| Patrón | Uso |
|--------|-----|
| Repositorios en `modules/*/data/*Repository.ts` | Lecturas/escrituras Supabase; primer argumento siempre `UserContext` |
| Server Components | `fetchPmPortfolio`, `listProyectos`, etc. directamente en `ui/pages/*` |
| Client hook | `useProyectos` llama al repositorio desde el navegador con usuario del contexto |
| API Routes (`src/app/api/`) | Upload Excel, sync Monday, auth login/logout, estado de jobs replace |
| Monday.com | GraphQL/API en `modules/monday/data/` (no Supabase para el board en vivo) |

---

## 2. Estructura de carpetas

```
src/
  app/                    # Rutas Next.js (páginas finas, re-export)
    api/                  # Route handlers REST
    dashboard/            # Área autenticada
    login/
  modules/                # Dominios de negocio
    portfolio/
    pm/
    monday/
    _template/            # Plantilla (no registrada en nav)
  lib/                    # Infra compartida (auth, db, audit, formatters)
  registry/               # Catálogo de módulos y nav Data
  components/             # Layout y workspace Data transversal
  proxy.ts                # Middleware de sesión (Next 16: export proxy)
```

| Concepto | Ubicación real |
|----------|----------------|
| **Pages (rutas)** | `src/app/**/page.tsx` — solo re-exportan desde `modules/*/ui/pages/` |
| **Páginas de negocio** | `src/modules/<modulo>/ui/pages/*.tsx` |
| **Components compartidos** | `src/components/` (layout, data upload, activity) |
| **Components de módulo** | `src/modules/<modulo>/ui/` |
| **Services** | **No existe** carpeta `services/`. La capa de servicio es `data/*Repository.ts` + `logic/` |
| **Types** | `src/modules/<modulo>/types.ts` y tipos locales en `data/` (p. ej. `monday/data/types.ts`) |
| **Hooks** | **No hay** carpeta `hooks/`. Hooks puntuales: `src/lib/auth/useCurrentUser.ts`, `src/modules/portfolio/ui/useProyectos.ts` |

Documentación de referencia: `ARCHITECTURE.md` (raíz), `src/modules/_template/README.md`, `src/modules/portfolio/README.md` (si existe).

---

## 3. Pestaña «PM»

### Registro y navegación

- Definida en `src/modules/pm/module.ts`, registrada en `src/registry/modules.ts` (`pm: pmModule`).
- **Pestaña primaria** en el header: label **«PM»**, `pathPrefix: /dashboard/pm`, landing `defaultPath: /dashboard/pm/overview`.
- **Subpestañas (nav secundario)** — sí, dos rutas declaradas:

| Clave | Ruta | Label |
|-------|------|-------|
| `pm.overview` | `/dashboard/pm/overview` | Overview |
| `pm.detalle` | `/dashboard/pm/detalle` | Detalle proyecto |

La ruta dinámica `/dashboard/pm/proyecto/[id]` **no es una tercera pestaña**; activa la subpestaña «Detalle proyecto» vía `match` en `module.ts` (`pathname.startsWith("/dashboard/pm/proyecto/")`).

### Rutas App Router

| Archivo | Exporta |
|---------|---------|
| `src/app/dashboard/pm/overview/page.tsx` | `OverviewPage` |
| `src/app/dashboard/pm/detalle/page.tsx` | `DetallePage` |
| `src/app/dashboard/pm/proyecto/[id]/page.tsx` | `ProyectoDetailPage` |

### Renderizado

- **Overview**: Server Component async; `getCurrentUser()` → `fetchPmPortfolio(ctx)`; KPIs, selector de snapshot (`?snapshot=`), Gantt overview, tabla de proyectos con semáforos.
- **Detalle**: listado de activos con enlaces a ficha por `id_activo`.
- **Proyecto**: ficha con Gantt de hitos, evolución de snapshots, tabla de desviaciones; query `?snapshot=` para fecha de corte.

Lógica de dominio en `src/modules/pm/logic/` (`pm-kpis`, `pm-viz`, `pm-axis`, `pm-hito-palette`). UI específica en `src/modules/pm/ui/` (`PmGanttOverview`, `PmGanttProject`, etc.).

### Carga de datos PM

- Origen: tablas Supabase `pm_activos`, `pm_hitos`, `pm_snapshot_fechas` vía `pmRepository.ts`.
- Import Excel: `POST /api/upload-pm-excel` + RPC `replace_pm_portfolio` (script SQL en `scripts/supabase/replace_pm_portfolio.sql`).
- UI de subida en workspace **Data** (`PmDataUpload` integrado en flujo de upload).

---

## 4. Integración Supabase

### Clientes (`src/lib/db/`)

| Archivo | Rol |
|---------|-----|
| `client.ts` | `createBrowserClient` (`@supabase/ssr`) — anon key en cliente |
| `server.ts` | `createServerClient` con cookies — SSR anon |
| `admin.ts` | `createClient` con **service role** — solo servidor, mutaciones y audit |

### Por módulo

- `modules/portfolio/data/readClient.ts` — lectura: service role en servidor si está configurado, si no server anon; en browser usa `client.ts`.
- `modules/pm/data/readClient.ts` — reutiliza `getPortfolioReadSupabase`; escritura `getPmWriteSupabase` → service role.
- Patrón documentado: **no** llamar `supabase.from()` fuera de `data/`.

### Variables de entorno esperadas

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY` (uploads, RPC, audit)

### Schemas / SQL

| Ubicación | Contenido |
|-----------|-----------|
| `scripts/supabase/pm_schema.sql` | Tablas PM + RLS lectura pública inicial |
| `scripts/supabase/replace_pm_portfolio.sql` | RPC reemplazo portfolio PM |
| `scripts/supabase/replace_proyectos.sql` | RPC portfolio financiero |
| `scripts/supabase/policies_proyectos_read_public.sql` | Políticas lectura `proyectos` |
| `scripts/supabase/README-policies.md` | Guía operativa RLS |
| `supabase/migrations/` | `enable_rls_temp_allow_all`, `audit_log` |

Tablas PM principales: `pm_activos`, `pm_hitos`, `pm_snapshot_fechas`, `pm_activo_proyecto_map`, `pm_import_logs`. Portfolio: `proyectos`, `upload_logs`. Transversal: `audit_log`, `monday_sync_logs`.

### Auth

- **La sesión de la app no es Supabase Auth.**
- Login: `POST /api/auth/login` con credenciales fijas en código; cookie `icam-auth=authenticated`.
- Gate: `src/proxy.ts` (middleware Next 16) redirige a `/login` si no hay cookie; APIs de datos sensibles devuelven 401.
- Identidad: `getCurrentUser()` devuelve usuario mock (`admin@icam.es`) — TODO Entra ID en comentarios.
- Supabase se usa como **base de datos** con RLS temporal permisivo (`temp_allow_all` en migraciones).

---

## 5. Tests y linting

### Tests

- **No hay** framework de tests en `package.json` (sin Jest, Vitest, Playwright, Cypress).
- **No hay** archivos `*.test.ts(x)` ni `*.spec.ts(x)` en el repo.
- Verificación manual documentada: `npx tsc --noEmit` y `npm run build` (`ARCHITECTURE.md`).

### Linting

- **ESLint 9** con flat config `eslint.config.mjs`: `eslint-config-next` (core-web-vitals + typescript).
- Script: `npm run lint` → `eslint src --ext .ts,.tsx`.
- **No hay** Prettier ni Husky configurados en el proyecto.

### CI / calidad

- `docs/quality-baseline.md` menciona baseline para tooling de PR (Greptile); sin pipeline detallado en este audit.

---

## 6. Convenciones del repositorio

### Organización modular

1. Cada área de negocio = carpeta en `src/modules/<key>/` con `data/`, `logic/`, `ui/`, `module.ts`.
2. Rutas en `app/` son **delgadas**: `export { default } from "@/modules/.../ui/pages/..."`.
3. Registro central en `src/registry/modules.ts`; nav Data aparte en `platform-nav.ts`.

### Naming

| Elemento | Convención |
|----------|------------|
| Module `key` | minúsculas, estable (`portfolio`, `pm`, `monday`) — no renombrar tras release |
| Route keys | `modulo.recurso` o path segment (`pm.overview`, `portfolio.rentabilidad`) |
| Permission actions | `modulo.read`, `modulo.write`, `modulo.sync`, etc. |
| URLs | kebab-case bajo `/dashboard/` |
| Audit actions | `modulo.recurso.verbo` (`pm.import_log.create`, `portfolio.upload_log.create`) |
| Repositorios | `*Repository.ts`, funciones con `ctx: UserContext` primero |
| Mutaciones Supabase | envueltas en `withAudit` (`src/lib/audit/withAudit.ts`) |

### Patrones técnicos

- **RSC por defecto** en páginas de dashboard; `"use client"` solo donde hay interactividad (nav, gráficos interactivos, hooks).
- **Separación logic/data/ui** estricta; KPIs y transforms en `logic/`.
- **Reutilización cross-módulo**: PM usa `KPICard` de portfolio; PM read client delega en portfolio read client.
- **Plantilla nuevos módulos**: copiar `_template`, registrar en `modules.ts`, crear rutas `app/dashboard/<key>/`.
- **Middleware**: Next 16 usa `src/proxy.ts` con `export function proxy` (no `middleware.ts` en raíz).

### Otros módulos (contexto nav)

| Módulo | `defaultPath` | Subpestañas |
|--------|---------------|-------------|
| Portfolio | `/dashboard/portfolio` | Executive, Rentabilidad, Proyectos, Tendencias |
| Monday | `/dashboard/monday` | Dashboard, Histórico (+ logs en ruta extra `/dashboard/monday/logs`) |
| Data (plataforma) | `/dashboard/data/upload` | Subir datos, Actividad |

Orden primario en nav: orden de `MODULES_LIST` (portfolio → pm → monday) + Data al final.

---

## 7. Resumen ejecutivo

El proyecto es un **portal interno Next.js 16 + React 19** con arquitectura **modular por dominio**, datos en **Supabase** y sesión **propia por cookie** (aún sin SSO). La pestaña **PM** está madura en rutas, subnav y visualización Gantt/KPI, con datos en tablas `pm_*` y carga vía Excel. No hay capa de tests automatizados; la calidad se apoya en TypeScript estricto, ESLint y build. Las convenciones están documentadas y aplicadas de forma consistente en `ARCHITECTURE.md` y el módulo de referencia **portfolio**.

---

## Referencias rápidas

- `package.json` — versiones y scripts
- `ARCHITECTURE.md` — guía canónica
- `src/modules/pm/module.ts` — metadatos PM y subpestañas
- `src/components/layout/DashboardNav.tsx` — render de pestañas
- `scripts/supabase/pm_schema.sql` — modelo PM en BD
