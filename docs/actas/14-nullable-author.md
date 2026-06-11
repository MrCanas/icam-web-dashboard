# `log_entry.author_id` nullable (Actas 006)

## Decisión

Un `log_entry` **puede no tener autor** (`author_id IS NULL`) cuando la entrada proviene de un ítem Monday cuya columna **Owner** estaba vacía en el snapshot correspondiente.

Esto no indica un fallo de mapeo `06-user-mapping.json`: el diagnóstico GQ8 (`npm run actas:validate-diagnose-authors -- GQ8`) mostró que casi todos los `author_id` null en staging corresponden a **Owner null en Monday**, no a emails sin usuario en auth.

## Esquema

| Antes (004) | Después (006) |
|-------------|----------------|
| `author_id uuid NOT NULL` → `auth.users` | `author_id uuid NULL` → `auth.users` |

Migración: `supabase/migrations/20260526120000_006_nullable_author.sql`

Índice parcial para consultas por autor cuando exista:

```sql
CREATE INDEX log_entry_author_idx ON log_entry (author_id)
  WHERE author_id IS NOT NULL;
```

## UI / producto

- Mostrar **«Sin autor»** (o equivalente) cuando `author_id` es null.
- No bloquear la carga histórica (P3.4) por entradas sin owner Monday.

## Verificación local

```bash
npx supabase db push
```

Comprobar nullable:

```sql
SELECT column_name, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'log_entry'
  AND column_name = 'author_id';
```

Equivalente a `\d log_entry` → `author_id | uuid | |` (sin `not null`).

## Relacionado

- Transform: `author_id` null si Owner Monday no resuelve a `06-user-mapping.json`; no se emite fila en `element_owners` si no hay `user_id` (PK compuesta, no nullable).
- Validación pre-load (check 6): solo comprueba `author_id` **no null** contra `auth.users`.
