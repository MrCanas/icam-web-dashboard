# Clientes Supabase — Actas y portal ICAM

**Fecha:** 2026-05-21

## Variables de entorno

Copia [`.env.local.example`](../../.env.local.example) a `.env.local` (ignorado por git).

| Variable | Uso |
|----------|-----|
| `SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_URL` | URL del proyecto (misma valor en ambas para desarrollo) |
| `SUPABASE_ANON_KEY` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Clave **anon** — navegador y lecturas con RLS |
| `SUPABASE_SERVICE_ROLE_KEY` | Clave **service_role** — solo servidor y scripts |
| `MONDAY_API_TOKEN` | API Monday (no es Supabase) |

La app Next.js **debe** usar `NEXT_PUBLIC_*` en el cliente porque solo esas variables se exponen al bundle del navegador. Los scripts en `scripts/actas/` aceptan el alias sin prefijo o con `NEXT_PUBLIC_*`.

## Qué cliente usar para qué

| Contexto | Cliente | Ubicación | Clave |
|----------|---------|-----------|-------|
| **Scripts CLI** (check, seeds, import) | Service role | [`scripts/actas/lib/supabase-server.ts`](../../scripts/actas/lib/supabase-server.ts) | `SUPABASE_SERVICE_ROLE_KEY` |
| **Scripts CLI** (probar RLS como usuario anónimo) | Anon | [`scripts/actas/lib/supabase-anon.ts`](../../scripts/actas/lib/supabase-anon.ts) | `SUPABASE_ANON_KEY` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` |
| **Navegador** (dashboard, hooks cliente) | Anon + JWT bridge | [`src/lib/db/supabase-browser.ts`](../../src/lib/db/supabase-browser.ts) (`createClient`) | `NEXT_PUBLIC_*` + `/api/auth/supabase-token` + `SUPABASE_JWT_SECRET` (servidor) |
| **Server Components / cookies** | Anon + sesión cookie | [`src/lib/db/server.ts`](../../src/lib/db/server.ts) | Igual + cookies de `@supabase/ssr` |
| **Route Handlers / mutaciones** tras validar sesión ICAM | Service role | [`src/lib/db/admin.ts`](../../src/lib/db/admin.ts) | `SUPABASE_SERVICE_ROLE_KEY` |
| **Repositorios PM / Portfolio / Actas (futuro)** | Delegación | `get*ReadSupabase(ctx)` / `get*WriteSupabase(ctx)` en cada módulo | Lectura: service role en servidor si está configurado; escritura: service role |

### Reglas

1. **Nunca** importar `supabase-server` ni `admin.ts` en archivos con `"use client"`.
2. **No** llamar `supabase.from()` fuera de `src/modules/*/data/` (convención del portal).
3. **Service role** omite RLS: usar solo después del gate `icam-auth` en APIs o en scripts de operación.
4. **Anon** respeta RLS: comportamiento equivalente al usuario final en el frontend.

## Supabase CLI y migraciones

```bash
# Inicializado en el repo (config en supabase/config.toml)
npx supabase --version

# Aplicar migraciones al proyecto remoto (requiere login/link)
npx supabase link --project-ref <ref>
npx supabase db push

# Nueva migración Actas (cuando exista el modelo)
npx supabase migration new actas_<descripcion>
```

Migraciones versionadas: [`supabase/migrations/`](../../supabase/migrations/).

La comprobación de conexión usa la función `actas_check_supabase_health()` definida en `20260521120000_actas_health_rpc.sql` (equivale a `SELECT now()`).

## Verificar conexión

```bash
cp .env.local.example .env.local
# Rellena URL y claves en .env.local

npm run actas:check-supabase
```

Salida esperada (ambos clientes):

```text
[service_role] OK — server time: 2026-05-21T12:00:00.000000+00:00
[anon] OK — server time: 2026-05-21T12:00:00.000000+00:00
```

Si la función RPC no existe en el remoto, el script intenta un **fallback** leyendo `audit_log.created_at` y avisa de aplicar migraciones. Tras `db push`, la salida usa `now()` vía `actas_check_supabase_health()`.

```bash
npx supabase login
npx supabase link --project-ref <tu-project-ref>
npx supabase db push
```

## Módulo Actas (app)

Cuando exista código en `src/modules/pm/actas/data/`, los repositorios deben reutilizar los clientes del portal (`getPmReadSupabase` / service role para escrituras), no duplicar factories salvo tests aislados.
