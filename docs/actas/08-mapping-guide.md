# Guía de mapeo Monday → Supabase (P2.3)

Antes de ejecutar la migración de datos (siguiente fase), revisa y completa los archivos generados por los scripts de mapeo.

## Archivos

| Archivo | Script | Contenido |
|---------|--------|-----------|
| [`06-user-mapping.json`](./06-user-mapping.json) | `npm run actas:monday-map-users` | `monday_user_id` → `supabase_user_id` (`auth.users`) |
| [`07-element-mapping.json`](./07-element-mapping.json) | `actas:monday-map-elements` (muestra GQ8) o `actas:monday-map-elements-all` (workspace completo, deduplicado) | → `master_group` / `master_element` |
| [`07b-elements-unmapped-summary.md`](./07b-elements-unmapped-summary.md) | `actas:monday-map-elements-all` | Tabla legible de elementos sin mapeo |

Regenerar tras cambios en Monday o en el catálogo:

```bash
npm run actas:monday-map-users
npm run actas:monday-map-elements          # tablero muestra (rápido)
npm run actas:monday-map-elements-all    # workspace completo → 07 + 07b
npm run actas:monday-map-elements-all -- --from-cache  # re-mapeo rápido tras seed/leyenda (sin scan Monday)
npm run tsx scripts/actas/apply-manual-mappings.ts   # notas en 06-user-mapping
npm run actas:auth-bulk-create                       # crea auth.users para unmapped (dev/staging)
```

Variables en `.env.local`: `MONDAY_API_TOKEN`, `MONDAY_WORKSPACE_ID_ACTAS`, `MONDAY_SAMPLE_BOARD_ID` (default `18401743922` = GQ8), `SUPABASE_SERVICE_ROLE_KEY`.

---

## 1. Usuarios (`06-user-mapping.json`)

### Cómo se genera

1. Lista todos los usuarios de la cuenta Monday (`users { id name email }`).
2. Extrae IDs adicionales de la columna **Owner** (`people`) en el tablero muestra.
3. Cruza por **email exacto** (normalizado a minúsculas) con `auth.users`.

### Campos editables

En cada entrada de `users[]`:

- **`supabase_user_id`**: UUID de `auth.users`. Si es `null`, el usuario queda **unmapped**.
- Tras editar, actualiza también `mappings[monday_user_id]` y pon `mapped: true`, `unmapped: false`.

### Unmapped (`unmapped: true`)

Aparecen en `unmapped_monday_users` y en `unmapped_still_blocking_migration` (tras `apply-manual-mappings.ts`).

**Causa habitual en dev:** solo existen unos pocos usuarios en Supabase Auth; el resto del equipo Monday tiene email corporativo pero aún no está en Auth.

**Resolución antes de migrar (producción):**

1. Supabase Dashboard → **Authentication → Users** → invitar o crear usuario con el **mismo email** que en Monday.
2. O en entorno con `SUPABASE_SERVICE_ROLE_KEY`: `npm run actas:auth-bulk-create` (crea usuarios con contraseña aleatoria, `email_confirm: true`, idempotente por email, y regenera `06-user-mapping.json`).
3. Volver a ejecutar `actas:monday-map-users` si creaste usuarios a mano.
4. Repetir hasta que `summary.unmapped` sea `0`.

**Owners prioritarios** (tablero GQ8): ver `manual_resolution.priority_monday_user_ids` — Iranzu Vicente, Maria José Moya, etc.

**Entorno local (solo dev):** `manual_resolution.dev_fallback_supabase_user_id` documenta un UUID de fallback si migras sin Auth completo. No usar en producción.

### Duplicados de email

Si Monday muestra un email distinto del Auth (p. ej. `8elisaferran@gmail.com` vs `elisaferran@gmail.com`), unifica en Auth o anota en `notes`; no hay match automático sin el mismo email.

---

## 2. Elementos y grupos (`07-element-mapping.json`)

### Tablero muestra

Por defecto **GQ8 - 26/02/2026** (`18401743922`). Cambia con `MONDAY_SAMPLE_BOARD_ID` para otro snapshot representativo.

### Grupos (`groups[]`)

Alias automáticos en `scripts/actas/lib/normalize.ts`:

- `FICC - SOCIETARIO` → **SOCIETARIO**
- `SITACIÓN FINANCIERA` → **SITUACIÓN FINANCIERA**
- `MARRIOTT` → **OPERADOR HOTELERO**

Si un grupo no mapea: rellena **`manual_master_group_id`** con el UUID de `master_group` y ejecuta de nuevo el script o marca `mapped: true` a mano.

### Elementos (`elements[]`)

| Campo | Uso |
|-------|-----|
| `master_element_id` | UUID en catálogo; obligatorio para migrar el item |
| `manual_master_element_id` | Mismo UUID si lo rellenaste a mano |
| `suggested_master_name` | Pista del script cuando hay candidato |
| `resolution: "skip_not_in_catalog"` | Item Monday sin fila en catálogo — **no migrar** hasta ampliar Excel + `actas:seed-master-catalog` |
| `manually_resolved: true` | Decisión humana tomada (map o skip) |

### Unmapped de elementos

Listados en `unmapped_elements` mientras `unmapped: true` y no tengan `manually_resolved`.

**Resoluciones ya aplicadas (GQ8):**

| Item Monday | Grupo Monday | Resolución |
|-------------|--------------|------------|
| Saneamiento | ESTADO PROYECTO | → `master_element` **Saneamiento** (grupo catálogo: PROPERTY MANAGEMENT) |
| Comunidad de propietarios | ESTADO PROYECTO | → **Comunidad de Propietarios** (PROPERTY MANAGEMENT) |
| LGA | ESTADO PROYECTO | `skip_not_in_catalog` — no está en catálogo |
| Lona publicitaria | COMERCIAL | `skip_not_in_catalog` |
| Afecciones | PROPERTY MANAGEMENT | `skip_not_in_catalog` |
| Gastos Generales | FINANCIACIÓN | `skip_not_in_catalog` |

Para **añadir** un elemento al catálogo: edita `docs/actas/catalogo-maestro.xlsx`, `npm run actas:seed-master-catalog`, regenera `07-element-mapping.json` y mapea el nuevo UUID.

### Matcher (cascada)

Orden en `lib/element-mapping.ts`: `exact` → `cross_group` → `parent_context` → `manual_resolution` → `normalized` → `inclusion` → `fuzzy`. Cada match guarda `match_type` y, si aplica, `matched_via_parent`.

Resoluciones en [`manual-element-resolutions.ts`](../../scripts/actas/lib/manual-element-resolutions.ts): por nombre (`MANUAL_ELEMENT_RESOLUTIONS`) y padre-hijo (`MANUAL_PARENT_CHILD_RESOLUTIONS`, lista vacía preparada).

Subitems llevan `parent_item_name` y `parent_monday_group` (ver `lib/monday-board-parse.ts`).

`07b-elements-unmapped-summary.md` agrupa unmapped por frecuencia: Críticos (≥50 tableros), Frecuentes (10–49), Ocasionales (3–9), Marginales (1–2).

---

## 3. Checklist pre-migración

- [ ] `06-user-mapping.json`: `summary.unmapped === 0` (o fallback dev documentado y aceptado)
- [ ] `07-element-mapping.json`: `unmapped_elements` vacío
- [ ] Items con `skip_not_in_catalog`: decisión de negocio (omitir o ampliar catálogo)
- [ ] Commit de los JSON editados junto con la guía
- [ ] No commitear `.env.local`

---

## 4. Estructura JSON (referencia)

**Usuario** — clave en `mappings`:

```json
"63778539": "uuid-de-auth-users-o-null"
```

**Elemento** — entrada con flag unmapped:

```json
{
  "monday_item_id": "11375016719",
  "monday_name": "LGA",
  "unmapped": true,
  "mapped": false,
  "master_element_id": null
}
```

Tras resolver:

```json
{
  "unmapped": false,
  "mapped": true,
  "manually_resolved": true,
  "manual_master_element_id": "uuid-opcional",
  "match_method": "manual"
}
```

---

## 5. Alias en código

Añadir equivalencias recurrentes en [`scripts/actas/lib/normalize.ts`](../../scripts/actas/lib/normalize.ts) (`GROUP_ALIASES`, `ELEMENT_ALIASES`) y volver a ejecutar `actas:monday-map-elements` para no depender solo del JSON.
