# Row Level Security — Módulo Actas (P1.6)

Las políticas se evalúan con el **JWT de Supabase Auth** (`auth.uid()`, rol `authenticated`). El portal usa hoy cookie `icam-auth` en la app; para que RLS aplique en el cliente hay que pasar sesión Supabase (anon key + access token) o seguir usando **service role** solo en servidor tras validar sesión ICAM.

Migraciones: `20260522140000_004b_organization.sql`, `20260522141000_005_rls.sql`.

---

## Modelo de organización (auxiliar)

| Tabla | Propósito |
|-------|-----------|
| `organization` | Tenant (V1: una fila `slug = icam`) |
| `org_member` | `(organization_id, user_id, role)` — `member` \| `admin` |
| `project.organization_id` | Todo proyecto pertenece a una org |

**Por qué existe:** sin membresía no hay forma en Postgres de saber “este usuario puede ver el proyecto X”. RLS necesita una relación usuario ↔ org ↔ proyecto.

Alta de miembros (hasta SSO): insertar en `org_member` con service role o SQL Editor.

```sql
INSERT INTO org_member (organization_id, user_id, role)
SELECT id, '<uuid-auth-users>', 'admin'
FROM organization WHERE slug = 'icam';
```

---

## Funciones helper

| Función | Uso |
|---------|-----|
| `user_belongs_to_org(org_id)` | Miembro de la organización |
| `user_is_org_admin(org_id)` | Rol `admin` en la org |
| `user_can_access_project(project_id)` | Proyecto visible |
| `user_can_access_category` / `_element` | Cadena proyecto → categoría → elemento |
| `user_can_modify_log_entry(log_id)` | Autor del log **o** admin de la org del proyecto |

`SECURITY INVOKER` + `auth.uid()` para no elevar privilegios.

---

## Políticas por tabla

### Catálogo maestro (`master_*`)

| Operación | Rol | Política | Por qué |
|-----------|-----|----------|---------|
| SELECT | `authenticated` | `USING (true)` | Catálogo común de solo lectura para cualquier empleado con cuenta Supabase |
| INSERT/UPDATE/DELETE | — | *(ninguna)* | Solo **service_role** (bypass RLS): seed, scripts `import-catalogo-maestro`, operaciones admin |

### `organization` / `org_member`

| Tabla | SELECT | Escritura |
|-------|--------|-----------|
| `organization` | Miembros de esa org | Sin política → service_role |
| `org_member` | Solo filas con `user_id = auth.uid()` | Sin política → service_role (alta de usuarios) |

### Datos operativos (`project`, `project_module`, `category`, `element`, `element_owner`)

| Operación | Condición | Por qué |
|-----------|-----------|---------|
| SELECT | `user_can_access_*` en la cadena hasta `project.organization_id` | No ver obras de otra organización |
| INSERT/UPDATE | Misma condición en `WITH CHECK` | Solo mutar proyectos de tu org |
| DELETE | Sin política explícita en V1 | Evitar borrado físico desde cliente; usar `archived_at` / service_role |

`project_module` sigue la visibilidad del `project_id`.

### `log_entry`

| Operación | Condición | Por qué |
|-----------|-----------|---------|
| SELECT | Acceso al `element_id` | Mismo perímetro que el árbol del proyecto |
| INSERT | `author_id = auth.uid()` + acceso al elemento | Trazabilidad: quien escribe queda registrado |
| UPDATE | `user_can_modify_log_entry(id)` | **Solo autor o admin org** — alineado con `01-architecture.md` (editar / `deleted_at`) |
| DELETE | *(ninguna)* | Borrado lógico por `UPDATE` de `deleted_at`, no `DELETE` SQL |

---

## Roles Supabase vs portal

| Cliente | RLS |
|---------|-----|
| **anon** (sin JWT) | Sin políticas → **0 filas** en tablas protegidas |
| **authenticated** (JWT válido) | Políticas anteriores |
| **service_role** | Bypass RLS — Route Handlers / scripts tras validar cookie ICAM |

---

## Tests manuales

### Automatizado

```bash
npm run actas:verify-rls
```

Comprueba:

1. Cliente **anon**: `project` y `master_group` devuelven 0 filas (sin filtrar datos de org).
2. Usuario autenticado **sin** `org_member`: 0 proyectos.
3. Usuario **miembro** de `icam`: ve proyectos de esa org.
4. Usuario miembro **no autor** no puede `UPDATE` un `log_entry` ajeno; el **autor** sí.

### Manual con anon (SQL o REST)

```bash
# .env.local con NEXT_PUBLIC_SUPABASE_URL y NEXT_PUBLIC_SUPABASE_ANON_KEY
curl "$NEXT_PUBLIC_SUPABASE_URL/rest/v1/project?select=code" \
  -H "apikey: $NEXT_PUBLIC_SUPABASE_ANON_KEY" \
  -H "Authorization: Bearer $NEXT_PUBLIC_SUPABASE_ANON_KEY"
```

Respuesta esperada: `[]` (no datos de ICAM).

Con JWT de un usuario **fuera** de `org_member`, mismo resultado para `project`. Con JWT de miembro, aparecen códigos de proyecto de su org.

---

## Relación con la app Next.js

| Patrón actual | Recomendación |
|---------------|----------------|
| Servidor con service role tras cookie ICAM | Válido: la app sigue siendo gate; RLS protege acceso directo a PostgREST |
| Cliente browser con anon key sin JWT | **No verá datos** tras P1.6 — hay que enlazar login ICAM ↔ Supabase Auth o leer solo vía Server Actions |

Deuda: sincronizar login del portal con `auth.users` y poblar `org_member` al provisionar usuarios.
