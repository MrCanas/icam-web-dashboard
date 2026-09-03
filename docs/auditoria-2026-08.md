# Auditoría técnica — agosto 2026

**Base auditada:** commit `cb154f5` (rama `avance-obra`), 19-08-2026. ~50.800 LOC en `src/`, 29 migraciones, 54 scripts npm.
**Método:** tres pasadas independientes — arquitectura y acoplamiento · datos/seguridad/rendimiento · calidad/tests/UX — solo lectura, con evidencia por fichero y línea.
**Motivo:** el portal «va lento», da miedo tocarlo sin red de seguridad, y maneja datos financieros sensibles con <15 usuarios internos.

Este documento es el **estado vivo** de la auditoría: cada hallazgo lleva su estado y las fases del saneamiento lo van tachando.

Estados: `pendiente` · `en fase N` · `hecho (commit)` · `aceptado` (riesgo asumido a sabiendas) · `fuera de alcance`.

---

## 0. Decisiones tomadas (19-08-2026)

| Decisión | Quién |
|---|---|
| El arreglo de RLS va dentro de la Fase 1, no como hotfix aparte | Javier |
| Saneamiento **por fases** intercalado con features; cada fase una rama pequeña desplegable | Javier |
| Entorno de staging y protecciones de scripts contra prod: **aplazado** → riesgo `aceptado` | Javier |

## Riesgo aceptado: local = producción

`.env.local` apunta al proyecto Supabase de producción (`psptnfjitmfukuboeamu`). `npm run dev` y **todos** los scripts de `scripts/` (DDL, cargas masivas, seeds) escriben en la base real con service role, sin prompt de confirmación. Además `scripts/actas/lib/db.ts:122` fuerza `ssl: { rejectUnauthorized: false }` (sin verificación de certificado). Documentado aquí porque se decidió no actuar de momento; si algún día un script rompe datos de producción, este es el porqué.

---

## 1. Seguridad

### 1.1 `temp_allow_all` — lectura y escritura anónima · **CRÍTICA** · `migración 030 lista (pendiente --apply)`

`20260521100000_enable_rls_temp_allow_all.sql:33` crea `FOR ALL USING (true) WITH CHECK (true)` — sin `TO`, aplica a **todos** los roles incluido `anon` — en 8 tablas: `proyectos`, `upload_logs`, `pm_activos`, `pm_hitos`, `pm_snapshot_fechas`, `pm_activo_proyecto_map`, `pm_import_logs`, `monday_sync_logs`. Y `20260521110000_audit_log.sql:26` lo mismo en `audit_log`.

La única migración que las elimina (`005_rls.sql:136-155`) solo cubre tablas de Actas. Consecuencia: **con la anon key del navegador, sin iniciar sesión, se puede leer y BORRAR** el portfolio financiero (`equity`, `inversion_total`, `beneficios`, `tir_desp_is`, `roe_desp_is`…) y el log de auditoría (emails de usuarios).

Lo que sí está bien cerrado: `app_user_password`, `app_user_account`, `app_user_zone_role`, `app_user_route_deny`, `app_zone` (solo `service_role`).

### 1.2 `SELECT TO public` deliberado en 12 tablas PM/avance · **MEDIA** · `migración 030 lista (pendiente --apply)`

`pm_hito_catalogo`, `pm_snapshots`, `pm_activo_snapshot`, `maestro_lineas_trimestre`, `maestro_hito_fechas`, `pm_snapshot_validacion` y las 6 tablas de avance de obra (028): cronograma completo, promociones de Zoho y porcentajes legibles con la anon key. Pasarán a `TO authenticated` (el navegador ya lee con el bridge JWT).

### 1.3 Rutas sin guarda de servidor · **ALTA** · `hecho`

`requireRouteAccess` falta en: `/dashboard/pm/planificacion`, `/dashboard/pm/proyectos`, `/dashboard/pm/proyecto/[id]` (Resumen), `/dashboard/monday/logs` (sin guard alguno: `LogsPage.tsx:41-45` consulta Monday antes de mirar `ctx`) y el layout del hub de actas. Solo las protege `DashboardZoneGuard`, que es **cliente**: el HTML con los datos ya viajó. Además `/dashboard/monday/logs` no tiene `ModuleRoute` → `routeKeyForPathname` devuelve `null` y hereda el permiso de zona.

### 1.4 Escritura con rol `lector` · **ALTA** · `hecho`

`pm/actas/actions/update-element-timeline.ts:31` solo llama `requireCurrentUser()`; hace `UPDATE element SET timeline_start/end` sin `checkWriteAccess(user, "pm")`.

### 1.5 Login sin freno + oráculo de enumeración · **ALTA** · `hecho (rate limit + migración 032 lista)`

- Cero rate limiting en `POST /api/auth/login` (fuerza bruta ilimitada contra bcrypt coste 10).
- `resolveAuthUserIdByEmail` (`src/lib/auth/resolve-auth-user.ts:18-30`) pagina `auth.admin.listUsers` **entero** buscando el email: tiempo distinto para email existente vs inexistente (enumeración) y coste fijo caro por intento.
- `GET /api/auth/logout` existe → logout CSRF-able con un `<img>`.
- Logout no invalida el token en servidor: uno robado vale los 7 días. `baja`.

### 1.6 Lecturas sin comprobación de zona · **MEDIA** · `hecho`

Con el matiz de que los reads de servidor usan **service role** (RLS no es segunda barrera, §1.7):

- 7 server actions de actas solo comprueban sesión: `get-acta-view`, `search-log-entries`, `search-pm-activos`, `get-historico-element`, `get-project-snapshot-at-date`, `get-project-wizard-catalog`, `list-element-log-entries` (+ `list-attachments`).
- API routes solo con sesión: `api/upload-logs` (jsonb del maestro, debería exigir zona financiero), `api/monday` GET (proxy libre a la API de Monday), `api/monday/sync-logs`, `api/actas/elements/[id]/log-entries`, `api/actas/projects/[id]/export-pdf`.
- IDOR menor: `markSeen`/`dismiss`/`delete` de notificaciones filtran solo por id, no por destinatario (`notifications/actions/mark-seen.ts:18-26`).

### 1.7 Contexto estructural (sin acción inmediata)

- Reads de servidor siempre con service role (`portfolio/data/readClient.ts:7-18`): la autorización es 100 % código de aplicación. `aceptado` de facto — es el diseño actual.
- Sin CSRF explícito; cubre `sameSite: lax` + validación de Origin de las Server Actions. `baja`.
- bcrypt coste 10, contraseña mínima 8. `baja` → subir a 12 al siguiente cambio de contraseña (fase 1, oportunista).
- Secretos: **cero exposición encontrada** en cliente o en git. `.env.local` no está en el historial. ✅
- `proxy.ts:9-16` protege APIs con lista blanca manual: una ruta nueva bajo `/api/` no queda protegida por defecto. `baja`, mitigado porque cada route se auto-protege.

---

## 2. Integridad de datos

### 2.1 `replace_pm_portfolio` destruye los mapeos manuales · **CRÍTICA** · `migración 031 lista (pendiente --apply)`

`scripts/supabase/replace_pm_portfolio.sql:25-27`: `DELETE FROM pm_activos` + reinsert con **UUIDs nuevos**. Cada subida del Excel PM (`/api/upload-pm-excel?confirm=true`) borra en cascada:

| Se pierde | FK |
|---|---|
| `pm_activo_proyecto_map` (mapeo PM↔financiero de la PMO) | `ON DELETE CASCADE` |
| `pm_activo_promocion_map` (emparejamiento con Zoho) | `ON DELETE CASCADE` |
| `pm_activo_snapshot` (flags publicado por trimestre) | `ON DELETE CASCADE` |
| `pm_snapshot_validacion` | vía `pm_hitos` `CASCADE` |
| `project.pm_activo_id` (enlace actas↔activo) | `ON DELETE SET NULL` |

Arreglo (migración 031): upsert de `pm_activos` por `id_activo` con UUIDs estables; borrar solo hitos/fechas.

### 2.2 Subconsulta PostgREST inválida · **ALTA** · `hecho`

`actasRepository.ts:325-343` pasa un query builder como valor de `.eq()`: se serializa como string y **el filtro no filtra**. El mismo fichero lo resuelve bien 20 líneas más abajo con `await` + `.in()`.

### 2.3 Claves de texto sin FK entre sistemas · **ALTA** · `pendiente` (mitigada por 031)

`proyecto_financiero_key`, `project.code`, `pm_activos.id_activo`: tres nomenclaturas unidas por texto libre sobre tablas que se borran y recargan. Un renombrado en el Excel maestro rompe el gate de publicación **sin error visible** (el join devuelve null). `es_ultima_fila` sin constraint de unicidad → un Excel mal formado duplica proyectos en los KPIs.

### 2.4 Fuentes de verdad duplicadas · **MEDIA** · `pendiente`

`pm_hitos.hito` (texto) vs `catalogo_id`: tras cada Excel hay que reejecutar `pm:backfill-planificacion` a mano y nada lo verifica. Excel local / SharePoint / tabla pueden divergir sin detección.

---

## 3. Rendimiento (el «va lento»)

### 3.1 Full-table scans · **ALTA** · `pendiente (proyección SQL — fuera de esta tanda)`

- `fetchPmPortfolio` (`pm/data/pmRepository.ts:65-93`): 4 tablas enteras con `select("*")`, filtrado en JS. Corre en `/dashboard/pm/detalle` y `pm-overview`.
- `planificacionRepository.ts:69-77`: 5 tablas completas más.
- `avanceRepository.ts:263-270`, `proyectosRepository.ts:60`, `syncLogsRepository.ts:207`: más `select("*")`.

### 3.2 `auth.users` paginado en cada render · **ALTA** · `hecho (migración 033 lista)`

`resolveUserDisplayMap` (`actas/logic/user-display.ts:57-88`) pagina `auth.admin.listUsers` de 200 en 200 **sin caché**, invocado por cada tablero de actas. Es probablemente la causa nº 1 del «va lento» en actas.

### 3.3 Cero caché, cero code-splitting · **MEDIA** · `parcial: loading.tsx hecho; recharts dynamic y caché pendientes`

- `force-dynamic` + `revalidate=0` en el **layout raíz** del dashboard: todo dinámico, incluidas páginas cuyos datos cambian una vez por semana.
- `revalidatePath` a patrones enteros y a nivel `layout` en cada edición de actas.
- recharts (~400 KB) importado estático en 13 componentes cliente; **cero `next/dynamic`** en el repo.
- 28 de 32 páginas sin `loading.tsx` (incluidas las más lentas: monday/historico, planificación, avance-obra).
- `bulk-change-element-status.ts:28-41`: bucle con `await` → ~4 queries por elemento.

### 3.4 Divergencia de bundler · **MEDIA** · `pendiente`

Dev con Turbopack, `build --webpack` sin justificación documentada en ningún sitio (verificado en git log). Riesgo clásico de «en local funciona».

---

## 4. Red de seguridad (el «miedo a romper»)

### 4.1 Sin CI · **ALTA** · `hecho`

`.github/` no existe. Nada valida lint, tsc ni tests antes de merge. Sin husky, sin pre-commit. `npm test` no existe (solo `pm:test`).

### 4.2 Bugs reales entre los 44 errores de lint · **ALTA** · `hecho (lint: 0 errores)`

- `react-hooks/rules-of-hooks` en `ActasOperativoSortableElement.tsx:91`: early-return antes de `useSortable` → crash potencial «Rendered more hooks» cuando `dnd.enabled` cambia.
- 3 `react-hooks/error-boundaries` en `HistoricoPage.tsx`: el try/catch no cubre el render y **no hay ni un `error.tsx` en toda la app**.
- 2 `<a>` → `<Link>` (full page reload).
- 38 `set-state-in-effect`, 7 concentrados en `ActasElementRow.tsx` (espejo de props en estado; cascadas de render en la fila más renderizada). 3 de los 44 errores están en código muerto.

### 4.3 Cobertura de tests muy desigual · **ALTA** · `parcial: RBAC/registry/log-access (fase 2)`

205 tests verdes, pero: `pm/actas` (20.069 LOC, 40 % del repo) **cero tests**; `src/lib/auth/` (todo el RBAC, incl. el fail-open de `canAccessRouteKey`) cero; `registry/routes` (matching por orden, la pieza más frágil) cero; `monday/logic` cero. Lo bien cubierto: `pm-viz` (36 tests), planificación, avance.

### 4.4 Código de producción fuera del type-check · **ALTA** · `hecho`

`pm/actas/data/pg.ts` reexporta de `scripts/actas/lib/db` — carpeta excluida de tsc y ESLint **que además no compila** (14 errores de tipos preexistentes). Dos server actions de 300+ líneas dependen de ello en runtime.

---

## 5. Arquitectura y deuda

### 5.1 Las reglas declaradas no se cumplen · **ALTA** · `pendiente` (fase 4 parcial)

- «No `supabase.from()` fuera de `data/`»: ~35 violaciones en `logic/`, `actions/` (17 en 14 ficheros) y `app/api/`.
- «Toda escritura pasa por `withAudit`»: cobertura real ≈ 15 % (13 de 87 mutaciones). `actas` y `admin` (alta/baja de usuarios, permisos) al **0 %**.
- «Repos con `ctx` primero»: 49 funciones lo incumplen.
- 4 estrategias de cliente Supabase conviviendo en `pm/actas` (bridge JWT ×25, service role ×4+8, pg crudo ×2) — la optimización marcada «crítica en Vercel» se aplicó al 14 % de los sitios.
- Ciclos: `pm ↔ portfolio` y `avance ↔ planificacion`.
- ESLint sin ninguna regla de fronteras: todo lo anterior pasa el lint.

### 5.2 Registry frágil · **ALTA** · `tests hechos (fase 2)` / `rediseño pendiente`

`routeKeyForPathname` devuelve el **primer** match del array: el orden de los literales en `module.ts` es semántica de permisos, ya parcheado dos veces con regex negativas y comentarios de advertencia. Dos fuentes de verdad path→key (cliente por match, servidor por key literal escrita a mano) — 4 rutas ya divergieron (§1.3). `route_key` sin FK: renombrar una key deja denies huérfanos que se descartan en silencio (ya pasó: migración 027). 4 resoluciones path→zona distintas en el código.

### 5.3 Duplicación estructural · **MEDIA** · `en fase 4`

7 toasts (4 con fuga de timeout), 5 writeClients (2 byte-idénticos), 10 guards «No autorizado» (8 inalcanzables), 55 secciones rojas de error con 4 variantes, 2 celdas de mapeo optimista casi idénticas, 12 `Intl.DateTimeFormat` a mano con 3 formatos incompatibles, formatters de `monday` que reimplementan `lib/formatters.ts`, 2 rutas API gemelas (`*-status`), 2 componentes de upload con 211 líneas idénticas, ~140 tipos `Input/Result` sin genérico.

### 5.4 Código muerto · **MEDIA** · `hecho: 10 ficheros borrados; src/services y _template CONSERVADOS (sí se usan)`

~750 LOC: `src/services/monday/client.ts` entero (229, resto pre-flatten), `useProyectos.ts` (126), `ActasElementHistoryPanel.tsx` (201), 2 server actions con `.from()` que nadie invoca, ~30 exports sueltos. Más «Ajustes» de actas: pestaña navegable en producción que solo muestra «próximamente».

### 5.5 Monolitos · **MEDIA** · `fuera de alcance` (documentado)

21 componentes cliente con una función >250 líneas (máx.: `PlanificacionBoard` 658). `actasRepository.ts` 915 líneas.

### 5.6 Tres protocolos de error incompatibles · **MEDIA** · `pendiente`

`{data, error}` (repos PM/portfolio) vs `throw` (admin: 15 throws — y `admin/usuarios/page.tsx:20` lo llama sin try/catch) vs `{ok, error}` (actions). 15 de 102 `catch` silencian sin log. Observabilidad: **cero** (ni Sentry ni logger; 23 `console.*` en total).

---

## 6. Operaciones

- **Cron de notificaciones de actas nunca programado**: el endpoint existe, `vercel.json` no lo invoca. Los emails de actas solo salen a mano. · **MEDIA** · `hecho`
- Cron portfolio-sync: si falta `CRON_SECRET` devuelve 401 en silencio; fallos de SharePoint solo dejan traza en `upload_logs`, sin alerta. Doble entrada en `vercel.json` es un truco DST correcto y documentado. · `baja`
- `audit_log` no registra login/logout, cambios de contraseña ni acciones de admin — justo lo que más importa auditar. · **MEDIA** · `pendiente`
- Backups: sin documentar; dependencia implícita del plan de Supabase. · `baja` · `pendiente`

---

## 7. UX, accesibilidad y DX

- Contraste `text-muted` `#8A8A8A` = 3,16:1 sobre fondo — **falla WCAG AA**. · **ALTA** · `hecho (#6E6E6E, 4.68:1 sobre page / 5.10 sobre card)`
- `lang="en"` en una app 100 % en español (`layout.tsx:22`). · trivial · `hecho (lang="es")`
- 250 colores hex hardcodeados (52× `#1E2A56` teniendo token); login con un azul fuera de paleta (`#1c2e69`).
- Diálogos: 32 `role="dialog"`, **0 focus traps**, 0 restauración de foco, 10 sin `aria-modal`; ~46 inputs sin label asociado. · `aria-modal hecho; focus trap fuera de alcance`
- 13 de 20 tablas con scroll horizontal sin columna sticky; 4 sin overflow. · `pendiente`
- README = boilerplate de create-next-app; ARCHITECTURE.md describe un auth que ya no existe (dice «mock admin profile») y omite el modelo real de zonas/roles/denylist y el 70 % de los módulos. · **ALTA** · `hecho (README real + sección RBAC en ARCHITECTURE)`
- ~950 líneas de prompts de Cursor + artefactos Power BI versionados; `PROMPT_CURSOR_NEXTJS.md:35` expone la URL del proyecto Supabase. 427 ficheros CRLF sin `.gitattributes`. · `.gitattributes hecho; borrado de prompts pendiente de tu OK`
- `tailwind.config.js` `content` omite `src/modules/**` (compensado por la autodetección de v4 — riesgo latente). `--ext` inválido en el script de lint con flat config. · `baja`

---

## 8. Puntos fuertes (proteger)

- **0 `any`, 0 `@ts-ignore`** en 50.800 LOC; solo 4 `eslint-disable`.
- 205 tests que corren en <1 s; `pm-viz` ejemplarmente cubierto.
- Cero dependencias fantasma y cero sin declarar.
- Secretos bien manejados (nada en cliente, nada en git).
- Drawer móvil correcto (scroll lock, targets 44 px).
- Comentarios en español de calidad inusual explicando el porqué de las decisiones.
- Los patrones nuevos (avance de obra, migración 028/029) siguen las convenciones con disciplina.

---

## 9. Plan de saneamiento

| Fase | Rama | Contenido | Estado |
|---|---|---|---|
| 0 | `auditoria-2026-08` | Este informe + artefacto ejecutivo | **hecho** |
| 1 | `auditoria-2026-08` | Migraciones 030/031/032 (código listo, `--apply` pendiente), guardas de servidor, rate limit + lookup directo, IDOR notificaciones, cron actas | **código hecho** |
| 2 | `auditoria-2026-08` | Bugs de lint (0 errores), `error.tsx`, tests de RBAC/registry/log-access (+18), CI, `npm test`/`check`, `pg.ts`→`src/lib/db` | **hecho** |
| 3 | `auditoria-2026-08` | user-display por RPC (033), fix subconsulta inválida, bulk concurrente, `loading.tsx` en 8 páginas | **parcial** (proyecciones SQL y recharts dynamic quedan) |
| 4 | `auditoria-2026-08` | `lang="es"`, README real, RBAC en ARCHITECTURE, `.gitattributes`, formateadores de fecha, `aria-modal` en 10 diálogos | **parcial** (borrado y contraste requieren tu OK) |

Fuera de alcance (reevaluar más adelante): staging, `cacheComponents`, focus traps completos, refactor de monolitos, tests exhaustivos de `pm/actas`, Prettier, observabilidad (Sentry/logger).
