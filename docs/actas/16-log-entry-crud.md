# Log entry — creación desde UI (P6.1)

**Fecha:** 2026-05-27

Creación de entradas de seguimiento desde la vista operativa (fila de elemento), sin modal.

---

## Server Action: `createLogEntry`

**Archivo:** `src/modules/pm/actas/actions/create-log-entry.ts`

### Entrada

| Campo | Tipo | Obligatorio | Notas |
|-------|------|-------------|--------|
| `elementId` | `string` (UUID) | Sí | Elemento destino |
| `content` | `string` | Sí | Texto; se hace `trim()`; vacío → error |
| `statusAfter` | `ElementStatus \| null` | No | Si coincide con el status actual del elemento → se ignoran estados |
| `entryDate` | ISO string \| null | No | Default: `now()` |

### Flujo

1. `requireCurrentUser()` — sesión cookie `icam-auth`.
2. `resolveAuthUserIdByEmail(email)` → `author_id` en `auth.users` (mismo puente que P4.0).
3. Cliente Supabase **authenticated** (`getActasAuthenticatedSupabase`) con JWT del bridge — necesario para que RLS exija `author_id = auth.uid()`.
4. Lectura defensiva del `element` (acceso vía RLS si el usuario pertenece a la org del proyecto).
5. Par de estados:
   - Si `statusAfter` distinto de `element.status` → `status_before` = actual, `status_after` = elegido.
   - Si no hay cambio o "Sin cambio" → ambos `null`.
6. `INSERT` en `log_entry` con `source: 'ui'` (columna migración `007_log_entry_source`).

### Salida

```ts
{ ok: true, entry: ActasLogEntryItem, elementStatus: ElementStatus }
| { ok: false, error: string }
```

---

## Trigger de status (P1.5)

`log_entry_sync_element_status_trg` (AFTER INSERT): si `status_after` no es null y la fila no está borrada, actualiza `element.status` al valor de `status_after`. La UI no actualiza el elemento a mano; confía en el trigger y en `router.refresh()` para alinear Server Components.

---

## UX: panel inline (no modal)

| Decisión | Motivo |
|----------|--------|
| Panel bajo la fila | Mismo patrón que el histórico (P5.3); contexto del elemento visible |
| "+ Añadir entrada" siempre visible | Texto discreto bajo "▾ Histórico"; no depende de hover |
| Status opcional ("Sin cambio") | Muchas actualizaciones son solo texto; el cambio de estado es excepcional |
| Fecha opcional | Documentar decisiones a posteriori con `entry_date` en el pasado |
| Cancelar sin confirmación | Formulario local; no hay datos sensibles ni borrado |
| Error inline en rojo | El panel permanece abierto con el texto del usuario |
| Tras guardar | `router.refresh()` + actualización optimista de preview/fecha/status en la fila; histórico se abre/recarga si estaba cerrado/abierto |

---

## RLS relevante

- `log_entry_insert_org_member`: `author_id = auth.uid()` y `user_can_access_element(element_id)`.
- No usar `service_role` para el insert UI (saltaría la comprobación de autor).

---

## Migración

`supabase/migrations/20260527120000_007_log_entry_source.sql` — columna `source text` nullable.

---

## Verificación manual

```sql
SELECT id, element_id, author_id, content, status_before, status_after, entry_date, source, created_at
FROM log_entry
ORDER BY created_at DESC
LIMIT 5;
```

Tras guardar desde UI: última fila con `source = 'ui'` y `content` del formulario.

---

## Edición de entradas (P6.2)

**Archivo:** `src/modules/pm/actas/actions/update-log-entry.ts`

### Política de autor (servidor + UI)

| Regla | Dónde |
|-------|--------|
| Solo el autor puede editar | `updateLogEntry` compara `log_entry.author_id` con `resolveAuthUserIdByEmail(currentUser)` en BD. Si no coincide → `{ ok: false, forbidden: true, error: "Solo el autor..." }` |
| UI oculta ✎ Editar | `canEditLogEntry()` — no sustituye la validación del servidor |
| `source = snapshot` o `monday_update` | No editables desde UI (entradas migradas Monday) |
| `author_id` NULL | No editables por nadie en V1 (solo borrado lógico por admin vía SQL si aplica) |

### Entrada

| Campo | Editable en V1 |
|-------|----------------|
| `content` | Sí |
| `entry_date` | Sí |
| `status_before` / `status_after` | **No** — se muestran read-only si existían |
| `author_id`, `element_id`, `source` | No |

### Update en BD

Solo se actualizan `content`, `entry_date` y `edited_at = now()` (no existe `updated_at` en `log_entry`).

### Por qué no se edita el status en el log

El par `status_before` / `status_after` es un hecho histórico ligado al trigger que sincronizó `element.status`. Permitir editarlo rompería la coherencia audit trail ↔ estado del elemento.

**Corrección de un cambio de estado mal registrado:** borrar la entrada (futuro P6.3 / admin) y crear una nueva con el status correcto (P6.1).

### UX

- ✎ Editar visible al **hover** de la tarjeta en el histórico inline (solo si `canEditLogEntry`).
- Formulario in-place: textarea + fecha; chip de status read-only + nota explicativa.
- Tras guardar: marca **(editada)** junto a la fecha; tooltip `Editada hace X tiempo` (`edited_at`).
- Si la entrada editada es la **más reciente** del elemento (`entry_date` máximo entre activas), se actualiza la columna «Última entrada» de la fila padre.

### Mejora futura (no V1)

Detección de ediciones concurrentes comparando `edited_at` antes/después del save y aviso: «Otra persona editó esta entrada al mismo tiempo…».

### Verificación

1. Usuario A crea entrada → A ve ✎ Editar; B no.
2. A edita texto → cambio visible + `(editada)`.
3. Llamar `updateLogEntry` con id de entrada de B → mensaje de forbidden.
4. Editar la última entrada → preview y fecha relativas de la fila se actualizan.

---

## Borrado lógico (P6.3)

**Archivos:** `soft-delete-log-entry.ts`, `restore-log-entry.ts`, `ActasLogEntryUndoContext.tsx`

### Política

| Regla | Detalle |
|-------|---------|
| Soft delete | `deleted_at = now()`; la fila permanece en BD |
| Solo autor | Misma validación servidor que edición (`author_id` en BD) → 403 si no coincide |
| Visibilidad UI | Mismas reglas que ✎ Editar (`canManageLogEntry`) |
| Deshacer 30 s | Snackbar «Entrada borrada. Deshacer»; el botón desaparece a los 30 s en cliente; `restoreLogEntry` sigue válido en servidor |
| Idempotente | Borrar ya borrada / restaurar ya activa → éxito sin error |

### No revertir `element.status`

Borrar una entrada **no** revierte cambios de estado que esa entrada estableció vía `status_after` y el trigger P1.5. El elemento conserva su status actual.

**Corregir estado:** crear una nueva entrada con el status deseado (P6.1).

### Hard delete

Nunca desde la UI. Solo SQL manual con justificación documentada.

### Restaurar como admin (SQL)

```sql
UPDATE log_entry
SET deleted_at = NULL
WHERE id = '<uuid>';
```

### Verificación

1. Autor borra → desaparece del histórico; toast Deshacer 30 s.
2. Deshacer a tiempo → entrada visible de nuevo.
3. Tras 30 s + recarga → oculta; «Mostrar borradas» → tachada.
4. Única entrada borrada → fila «Sin actividad», elemento sigue existiendo.
5. `softDeleteLogEntry` sobre entrada ajena → forbidden / 403.
