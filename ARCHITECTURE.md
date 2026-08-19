# ICAM Employee Portal — Architecture

Internal dashboard for ICAM real-estate portfolio management. The codebase is organized as a **modular employee portal**: business features live in `src/modules/`, shared infrastructure in `src/lib/`, and navigation is driven by a central module registry.

## Folder structure

```
src/
  app/                    # Next.js App Router — thin route entry points only
  modules/
    <module>/
      data/               # Repositories, Supabase/Monday queries, DTO types
      logic/              # Business rules, transforms, KPI calculations
      ui/                 # React components and page implementations
      module.ts           # Module metadata (routes, actions, labels)
  lib/
    auth/                 # getCurrentUser, useCurrentUser, session helpers
    db/                   # Shared Supabase clients (browser, server, admin)
    formatters.ts         # Cross-cutting presentation helpers
  registry/
    types.ts              # ModuleDefinition, ModuleRoute, ModuleAction
    modules.ts            # MODULES, MODULES_LIST
    platform-nav.ts       # Non-module admin nav (Data workspace)
  components/             # Shared design system (layout, data workspace UI)
```

### What goes where

| Location | Responsibility |
|----------|----------------|
| `app/**/page.tsx` | Re-export or minimal wrapper; **no business logic** |
| `modules/*/data` | Repositories: Supabase/Monday access only; every function takes `UserContext` as first param |
| `modules/*/types.ts` | Domain types for the module (e.g. `Proyecto`, `PmActivo`) |
| `modules/*/logic` | Pure/domain logic, transforms, aggregations |
| `modules/*/ui` | Components and `ui/pages/*` screen implementations |
| `lib/auth` | Identity and session; single source for user on server and client |
| `lib/db` | Supabase client factories shared across modules |
| `components/` | Layout shell, shared UI not tied to one business module |
| `registry/` | Module catalog consumed by navigation and (future) permissions |

## Module registry

Each business area exports `module.ts`:

```ts
import type { ModuleDefinition } from "@/registry/types";

export const portfolioModule: ModuleDefinition = {
  key: "portfolio",           // stable slug — never rename
  label: "Portfolio",
  icon: "building",
  pathPrefix: "/dashboard/portfolio",
  defaultPath: "/dashboard/portfolio",
  routes: [ /* secondary nav */ ],
  actions: [ /* permission keys */ ],
};
```

`src/registry/modules.ts` aggregates modules into `MODULES` and `MODULES_LIST`. **Dashboard navigation** (`DashboardNav`) builds primary and secondary tabs from `MODULES_LIST` plus `PLATFORM_NAV` for the Data workspace.

## User context

### Server — `getCurrentUser()`

`src/lib/auth/currentUser.ts`

- Used in Server Components, route handlers, and server actions.
- Returns `UserContext | null` when the ICAM session cookie is missing.
- **Auth real** (no mock): valida el JWT `icam-auth` (firmado con `jose`), resuelve el usuario en `auth.users` y carga sus permisos desde `app_user_zone_role`, `app_user_account` y `app_user_route_deny`. Memoizado por request con `cache()`.

### Modelo de permisos (RBAC)

`src/lib/auth/permissions.ts` + `src/registry`. `UserContext` lleva `zones: UserZoneRole[]`, `isPlatformAdmin` y `deniedRouteKeys` (no un campo `roles`).

- **Zona**: `financiero` · `pm` · `adquisiciones` · `data`. Cada usuario tiene un **rol** por zona: `admin` · `editor` · `lector`.
- `hasZoneAccess(user, zona)` — ve la zona (cualquier rol). `checkWriteAccess(user, zona)` — editor/admin escriben, lector no.
- **Denylist por ruta**: `app_user_route_deny.route_key` apunta a `ModuleRoute.key` (sin FK; renombrar una key deja denies huérfanos — ver auditoría §5.2). `canAccessRouteKey(user, key)` combina zona + denylist.
- **Corte de servidor**: cada page shell del registry llama `await requireRouteAccess("<key>")`. Es el único corte que no se salta por URL; `DashboardZoneGuard` (cliente) es solo UX.
- `isPlatformAdmin` gobierna la gestión de usuarios (zona aparte de las de negocio).

### Client — `useCurrentUser()`

`src/lib/auth/useCurrentUser.ts` re-exports the hook from `CurrentUserProvider`.

- Wrap client subtrees with `<CurrentUserProvider>` (dashboard layout does this).
- The hook loads identity from `GET /api/me`, which calls `getCurrentUser()` on the server.
- Do not read `localStorage` or ad-hoc cookies for identity in feature code.

### Session vs identity

- **Session gate**: `isSessionAuthenticated(request)` (cookie `icam-auth`) — middleware and legacy checks.
- **Identity**: `getCurrentUser()` / `useCurrentUser()` — who is acting.

## Adding a new module

1. Create `src/modules/<key>/` with `data/`, `logic/`, `ui/`, and `module.ts`.
2. Define routes using real App Router paths (e.g. `/dashboard/<key>/...`).
3. Register in `src/registry/modules.ts`.
4. Add `app/dashboard/<key>/.../page.tsx` entry points that re-export from `modules/<key>/ui/pages/`.
5. Run `npx tsc --noEmit` and `npm run build`.

## Slug conventions

Permission and route keys use dot-separated segments:

```
<module>.<resource>.<action>
```

Examples: `portfolio.read`, `monday.sync`, `portfolio.rentabilidad` (route key).

- **Module key**: lowercase, stable (`portfolio`, `pm`, `monday`).
- **Resource segment**: kebab-case or single word (`rentabilidad`, `detalle`).
- **Action**: verb (`read`, `write`, `delete`, `sync`).

URL paths remain kebab-case under `/dashboard/`.

## Data access layer

All Supabase queries live in `src/modules/<module>/data/*Repository.ts` (and `readClient.ts` helpers). **No** `supabase.from()` or `supabase.rpc()` outside `data/`.

Every repository function takes `UserContext` as its **first parameter** (`ctx`). The parameter is unused for filtering today but keeps signatures stable for RBAC:

```ts
export async function listProyectos(ctx: UserContext, options?: ListProyectosOptions) {
  const supabase = await getPortfolioReadSupabase(ctx);
  return supabase.from("proyectos").select("*").eq("es_ultima_fila", 1);
}
```

| Module | Repositories |
|--------|----------------|
| portfolio | `proyectosRepository.ts`, `uploadLogsRepository.ts`, `readClient.ts` |
| pm | `pmRepository.ts`, `readClient.ts` |
| monday | `syncLogsRepository.ts`, `readClient.ts` (+ Monday GraphQL in `read.ts`, `dashboard-read.ts`) |

Server pages and API routes obtain `ctx` via `await getCurrentUser()`; client hooks use `useCurrentUser()` then pass `user` into repository calls (browser client via `readClient`).

### Row Level Security (Supabase)

Migration: `supabase/migrations/20260521100000_enable_rls_temp_allow_all.sql`

**Tables covered:**

- `proyectos`
- `upload_logs`
- `pm_activos`, `pm_hitos`, `pm_snapshot_fechas`, `pm_activo_proyecto_map`, `pm_import_logs`
- `monday_sync_logs`

For each existing table, the migration enables RLS and adds policy `temp_allow_all` (`USING (true) WITH CHECK (true)`).

**Technical debt:** Replace `temp_allow_all` with role- and tenant-aware policies when Entra ID / RBAC is wired. Map `UserContext.roles` to Postgres roles or JWT claims, then narrow `SELECT`/`INSERT`/`UPDATE` per module action keys (`portfolio.read`, `pm.write`, etc.).

**Note:** `scripts/supabase/pm_schema.sql` may already define other policies on PM tables; the migration only adds `temp_allow_all` if missing.

Migration: `supabase/migrations/20260521110000_audit_log.sql` — tabla `audit_log` con RLS y política `temp_allow_all_audit`.

## Audit log

Toda **escritura** en Supabase (INSERT, UPDATE, DELETE, RPC destructivos) pasa por `withAudit` en los repositorios.

```ts
import { withAudit } from "@/lib/audit/withAudit";

export async function insertUploadLog(ctx: UserContext, payload: UploadLogInsert) {
  return withAudit(ctx, "portfolio.upload_log.create", { resourceType: "upload_log", payload }, async () => {
    const supabase = getPortfolioWriteSupabase(ctx);
    return supabase.from("upload_logs").insert(payload);
  });
}
```

| Regla | Comportamiento |
|-------|----------------|
| Lecturas | No se auditan |
| Mutación con error Supabase (`error` en respuesta) | No se escribe en `audit_log` |
| Mutación que lanza excepción | No se escribe en `audit_log` |
| Fallo al insertar en `audit_log` | Se loguea en consola; la mutación **no** se revierte (best-effort) |

**Convención `action`:** `<modulo>.<recurso>.<verbo>` — slugs estables (`portfolio.proyecto.replace`, `pm.import_log.create`, `monday.sync_log.update`).

**Tabla `audit_log`:** `user_id`, `user_email`, `action`, `resource_type`, `resource_id`, `metadata` (jsonb), `created_at`.

**Deuda técnica:** restringir lectura/escritura de `audit_log` por rol cuando RBAC esté activo; hoy usa service role en el wrapper (mismo patrón que mutaciones en servidor).

## Platform areas (not business modules)

The **Data** workspace (upload, activity logs) is cross-cutting. It is described in `src/registry/platform-nav.ts` and is not a `ModuleDefinition`, so it does not appear in `MODULES` but still appears in the shell navigation.

## Reference module (Portfolio)

`src/modules/portfolio/` is the **canonical example** of the modular pattern: registry entry, repositories with `UserContext` + `withAudit`, logic separated from UI, thin `app/` routes. See `src/modules/portfolio/README.md` for tables, audit actions, and module-specific conventions.

`src/modules/_template/` is a **copy-paste starter** (compiles, not registered in `MODULES` or navigation). Use it when adding a new business area.

## Cómo añadir un módulo nuevo

1. Copia `src/modules/_template/` a `src/modules/<nombre>/`.
2. Renombra los archivos y tipos sustituyendo `Example` / `template` por el nombre real del área.
3. Define el módulo en `module.ts` con su `key` (slug estable), `label`, `icon`, `routes`, `actions`.
4. Registra el módulo en `src/registry/modules.ts` (añade la import y entrada en `MODULES`).
5. Crea las tablas necesarias con una migration en `supabase/migrations/`. Habilita RLS con política permisiva temporal (`temp_allow_all`).
6. Implementa el repositorio en `data/`. Recuerda: `ctx: UserContext` como primer parámetro; `withAudit` en todas las mutaciones.
7. Implementa la lógica en `logic/` (cálculos, validaciones, view models de pantalla).
8. Implementa la UI en `ui/` (componentes y `ui/pages/*`).
9. Crea las páginas en `src/app/dashboard/<nombre>/` que solo importen y re-exporten desde `ui/pages/`.
10. Rellena el `README.md` del módulo (propósito, tablas, acciones, convenciones).
11. Verifica con: `npx tsc --noEmit && npm run build`.
