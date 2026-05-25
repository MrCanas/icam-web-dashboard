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
| **Estilos** | **Tailwind CSS 4** (`@tailwindcss/postcss`, `tailwind.config.js` con tokens ICAM) |
| **Gráficos** | **Recharts 3.8.1** (portfolio y visualizaciones PM donde aplica) |
| **Excel** | **xlsx 0.18.5** (carga portfolio y PM) |
| **UI library de componentes** | **Ninguna** (MUI, Chakra, shadcn, etc.). Componentes propios en `src/components/` y `src/modules/*/ui/`. |
| **Bundler / dev** | `next dev` (Turbopack en dev según build cache); producción: `next build --webpack` |

### Routing

- **App Router** bajo `src/app/`.
- Rutas de negocio bajo `/dashboard/<módulo>/...`.
- Redirects en `next.config.ts`: `/dashboard` → portfolio; rutas legacy (`/dashboard/rentabilidad`, etc.) → portfolio.
- **Navegación declarativa**: `src/registry/modules.ts` + `src/registry/platform-nav.ts`; renderizada en `src/components/layout/DashboardNav.tsx` (tabs primarios + secundarios).
- **Middleware (Next 16)**: `src/proxy.ts` exporta `proxy()` — sustituye el patrón clásico `middleware.ts`; protege rutas no-API y APIs de datos sensibles.

### State management

- **No hay** Redux, Zustand, Jotai ni React Query.
- **Servidor**: Server Components cargan datos con `await getCurrentUser()` + repositorios en `modules/*/data/`.
- **Cliente**:
  - `CurrentUserProvider` + `useCurrentUser()` (`src/lib/auth/`) — identidad vía `GET /api/me`.
  - Hooks locales puntuales, p. ej. `useProyectos` en portfolio (`src/modules/portfolio/ui/useProyectos.ts`).
  - Estado UI local con `useState` / `useEffect` en componentes `"use client"`.

### Data fetching

| Patrón | Uso |
|--------|-----|
| **Supabase** (lectura/escritura) | Repositorios en `modules/*/data/*Repository.ts`; clientes en `lib/db/` y `modules/*/data/readClient.ts`. |
| **Route Handlers** | `src/app/api/*` — uploads Excel, sync Monday, auth, estado de jobs async. |
| **Monday.com** | API GraphQL vía módulo `monday` (`read.ts`, `dashboard-read.ts`), no Supabase para el board en vivo. |
| **PM pages** | Fetch en Server Components (`fetchPmPortfolio`, etc.) directamente desde repositorio. |

---

## 2. Estructura de carpetas

```
icam_dashboard/
├── src/
│   ├── app/                    # Rutas Next.js (entry points finos)
│   │   ├── api/                # Route handlers REST
│   │   ├── dashboard/          # Shell autenticado + páginas por módulo
│   │   ├── login/
│   │   ├── layout.tsx, globals.css, page.tsx
│   │   └── proxy.ts            # Gate de sesión (middleware Next 16)
│   ├── modules/                # Dominios de negocio
│   │   ├── portfolio/          # data | logic | ui | module.ts | types.ts
│   │   ├── pm/
│   │   ├── monday/
│   │   └── _template/          # Plantilla (no registrada en nav)
│   ├── lib/                    # Infra compartida
│   │   ├── auth/
│   │   ├── db/                 # client | server | admin Supabase
│   │   ├── audit/              # withAudit
│   │   └── formatters.ts
│   ├── registry/               # modules.ts, platform-nav.ts, types.ts
│   └── components/             # Layout + workspace Data (compartido)
├── scripts/supabase/           # SQL manual (PM, policies, RPC)
├── supabase/migrations/        # Migraciones versionadas (RLS, audit_log)
├── docs/                       # Documentación de negocio / actas
├── ARCHITECTURE.md             # Convenciones canónicas del repo
└── package.json
```

### Dónde vive cada concepto

| Concepto | Ubicación real | Notas |
|----------|----------------|-------|
| **Pages (rutas)** | `src/app/**/page.tsx` | Casi siempre `export { default } from "@/modules/.../ui/pages/..."` |
| **Implementación de pantallas** | `src/modules/<módulo>/ui/pages/` | Lógica de presentación y composición |
| **Components compartidos** | `src/components/` (layout, data upload) | No hay carpeta global `src/components/ui` tipo design system grande |
| **Services** | **No existe** carpeta `services/` | La capa de servicio es `modules/*/data/*Repository.ts` + `modules/*/logic/` |
| **Types** | `src/modules/<módulo>/types.ts` + tipos locales en `data/` (p. ej. monday) | Registry: `src/registry/types.ts` |
| **Hooks** | **No hay** `src/hooks/` | `useCurrentUser`, `useProyectos` colocados junto a su dominio |

---

## 3. Pestaña «PM» (estado actual)

### Registro y navegación

Definido en `src/modules/pm/module.ts` y registrado en `src/registry/modules.ts`:

- **Tab primario:** label `"PM"`, `pathPrefix: "/dashboard/pm"`, landing `defaultPath: "/dashboard/pm/overview"`.
- **Subpestañas (nav secundario):** sí, **2 rutas** en el registry:
  1. **Overview** — `/dashboard/pm/overview`
  2. **Detalle proyecto** — `/dashboard/pm/detalle` (activa también rutas `/dashboard/pm/proyecto/[id]` vía `match` custom)

No hay más subpestañas registradas (p. ej. no hay tab separado «Proyecto»; el detalle de un activo es ruta dinámica bajo el mismo tab «Detalle proyecto»).

### Rutas App Router

| Ruta | Entry `app/` | Implementación |
|------|----------------|----------------|
| `/dashboard/pm/overview` | `src/app/dashboard/pm/overview/page.tsx` | `modules/pm/ui/pages/OverviewPage.tsx` |
| `/dashboard/pm/detalle` | `src/app/dashboard/pm/detalle/page.tsx` | `modules/pm/ui/pages/DetallePage.tsx` |
| `/dashboard/pm/proyecto/[id]` | `src/app/dashboard/pm/proyecto/[id]/page.tsx` | `modules/pm/ui/pages/ProyectoDetailPage.tsx` |

### Cómo se renderiza

1. `src/app/dashboard/layout.tsx` — `Header` + `Footer`, `CurrentUserProvider`, `force-dynamic`.
2. `Header` incluye `DashboardNav`, que detecta `pathname.startsWith("/dashboard/pm")` y muestra las subpestañas del módulo PM.
3. Las páginas PM son **Server Components** async: obtienen `getCurrentUser()`, llaman `fetchPmPortfolio` / `fetchPmActivoBySlug`, renderizan Gantt, KPIs, tablas de desviación, selector de snapshot (`?snapshot=` en query).

### UI específica PM

- Componentes en `src/modules/pm/ui/`: `PmGanttOverview`, `PmGanttProject`, `PmSnapshotSelector`, `PmDeviationTable`, `PmDataUpload`, etc.
- Lógica pura en `src/modules/pm/logic/`: KPIs, ejes temporales, paleta de hitos, visualización.
- Reutiliza `KPICard` del módulo portfolio.

### Carga de datos

- Lectura: tablas `pm_activos`, `pm_hitos`, `pm_snapshot_fechas` vía `pmRepository.ts`.
- Escritura / import: `POST /api/upload-pm-excel`, RPC `replace_pm_portfolio`, logs en `pm_import_logs` — auditadas con `withAudit`.

---

## 4. Integración Supabase

### Clientes

| Archivo | Rol |
|---------|-----|
| `src/lib/db/client.ts` | `createBrowserClient` (`@supabase/ssr`) — anon key |
| `src/lib/db/server.ts` | `createServerClient` con cookies — anon key |
| `src/lib/db/admin.ts` | `createClient` con **service role** — solo servidor, mutaciones y audit |

Selección de cliente de lectura (portfolio y PM comparten patrón en `getPortfolioReadSupabase` / `getPmReadSupabase`):

- En servidor: service role si `SUPABASE_SERVICE_ROLE_KEY` está definida; si no, cliente SSR con anon.
- En browser: cliente anon.

### Auth: dos capas separadas

| Capa | Implementación |
|------|----------------|
| **Sesión app ICAM** | Cookie `icam-auth=authenticated` tras `POST /api/auth/login` (credenciales hardcoded en dev). **No usa Supabase Auth.** |
| **Identidad** | `getCurrentUser()` devuelve usuario mock (`admin@icam.es`) — TODO Entra ID / SSO en código. |
| **Supabase** | Solo almacén de datos; RLS con políticas permisivas temporales y lectura pública en scripts legacy PM. |

Variables de entorno esperadas:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY` (servidor, uploads y audit)

### Schemas / tablas relevantes

**Portfolio:** `proyectos`, `upload_logs` (+ scripts `replace_proyectos.sql`).

**PM** (`scripts/supabase/pm_schema.sql`):

- `pm_activos`, `pm_hitos`, `pm_snapshot_fechas`, `pm_activo_proyecto_map`, `pm_import_logs`
- RPC: `replace_pm_portfolio`

**Monday:** `monday_sync_logs` (sync vía API Monday + persistencia).

**Plataforma:** `audit_log` (migración `supabase/migrations/20260521110000_audit_log.sql`).

**RLS:** migración `20260521100000_enable_rls_temp_allow_all.sql` — política `temp_allow_all` en tablas listadas en `ARCHITECTURE.md` (deuda: RBAC real).

### Regla de acceso a datos

Documentado en `ARCHITECTURE.md`: **no** llamar `supabase.from()` fuera de `modules/*/data/`. Primer argumento de repositorios: `UserContext`. Mutaciones envueltas en `withAudit`.

---

## 5. Tests y linting

### Tests

| Aspecto | Estado |
|---------|--------|
| Framework (Jest / Vitest / Playwright) | **No configurado** en `package.json` |
| Archivos `*.test.ts` / `*.spec.ts` | **0** en el repo |
| Script `test` | **Ausente** |
| CI de tests | No observado en este audit |

Verificación manual documentada: `npx tsc --noEmit` y `npm run build` (`ARCHITECTURE.md`).

### Linting

| Aspecto | Estado |
|---------|--------|
| **ESLint 9** | `eslint.config.mjs` — `eslint-config-next` (core-web-vitals + typescript) |
| **Script** | `npm run lint` → `eslint src --ext .ts,.tsx` |
| **Prettier / Husky** | No presentes en dependencias raíz |
| **Typecheck** | Implícito vía `tsc` en build Next; no hay script `typecheck` dedicado |

`docs/quality-baseline.md` es un stub para tooling de PR (Greptile), no define reglas de calidad locales.

---

## 6. Convenciones del repositorio

Fuente principal: **`ARCHITECTURE.md`** y plantilla **`src/modules/_template/README.md`**.

### Organización modular

- Cada área de negocio: `data/` (I/O), `logic/` (sin I/O), `ui/` (+ `ui/pages/`), `module.ts`, `types.ts`.
- Rutas en `app/` son **delgadas** — re-exportan páginas del módulo.
- Nuevos módulos: copiar `_template`, registrar en `registry/modules.ts`, crear rutas bajo `app/dashboard/<key>/`.

### Naming

| Ámbito | Convención |
|--------|------------|
| **Module key** | minúsculas, estable (`portfolio`, `pm`, `monday`) — no renombrar tras release |
| **Claves de permiso / ruta registry** | `modulo.recurso.accion` con puntos (`pm.read`, `portfolio.rentabilidad`) |
| **URLs** | kebab-case bajo `/dashboard/` |
| **Repositorios** | `*Repository.ts`, funciones con `ctx: UserContext` primero |
| **Auditoría** | `withAudit(ctx, "modulo.recurso.verbo", ...)` |
| **Imports** | Alias `@/` hacia `src/` |

### Patrones técnicos

- **Server-first**: dashboard con RSC; `"use client"` solo donde hace falta interactividad (nav, charts con brush, uploads).
- **Sin capa `services/`**: repositorios + logic sustituyen servicios clásicos.
- **Seguridad perimetral**: `proxy.ts` + cookie; APIs de mutación protegidas; Supabase service role solo en servidor tras validar sesión.
- **Módulo de referencia**: `portfolio`; PM sigue el mismo esquema registry + repository + páginas finas.
- **Data workspace**: no es `ModuleDefinition`; vive en `platform-nav.ts` (Upload, Actividad).

### Documentación existente (fuera de actas)

- `docs/00_README_uso_en_cursor.md`, contexto exec summary, diccionario campos.
- `PROMPT_CURSOR_NEXTJS.md`, `AGENTS.md` (regla Next.js 16 — consultar docs en `node_modules/next/dist/docs/`).

---

## 7. Resumen ejecutivo

| Pregunta | Respuesta breve |
|----------|-----------------|
| ¿React o Next? | **Next.js 16** App Router + React 19 |
| ¿Vite? | **No** |
| ¿Estado global? | **No**; contexto de usuario + fetch en servidor |
| ¿UI kit? | **Tailwind custom** + Recharts |
| ¿PM dónde? | `/dashboard/pm/*`, módulo `src/modules/pm/` |
| ¿Subpestañas PM? | **Sí**: Overview + Detalle proyecto (+ detalle por `[id]`) |
| ¿Supabase? | **Sí**, datos + RLS temporal; auth de app **separada** (cookie ICAM) |
| ¿Tests? | **No** |
| ¿Lint? | **ESLint 9** (Next config), script `lint` en `src/` |

---

## 8. Deuda / riesgos detectados (informativo)

- Auth mock + credenciales en `api/auth/login` — sustituir por Entra ID.
- RLS `temp_allow_all` y lecturas públicas en scripts PM — endurecer con RBAC.
- PM y portfolio pueden leer con service role en servidor si la key está presente (omite RLS).
- Sin tests automatizados — regresiones solo vía build manual.
- `src/app/dashboard/mapa/page.tsx` existe pero **no** está en el registry de módulos (posible ruta huérfana / legacy).

---

*Documento generado por inspección del repo. Para ampliar un módulo concreto, ver su `README.md` bajo `src/modules/<nombre>/` cuando exista.*
