# Contrato `migration-resolve` (P3.2 / P3.4)

Módulo puro (sin I/O): [`scripts/actas/lib/migration-resolve.ts`](../../scripts/actas/lib/migration-resolve.ts).

Entrada esperada: filas de [`07-element-mapping.json`](./07-element-mapping.json) (`groups`, `elements_unique`) y **nombres literales** de cada ítem Monday en el tablero snapshot.

---

## Criterio canónico de “unmapped”

Para elementos (`UniqueElementMapping`):

```text
!mapping.mapped || mapping.match_type == null
```

- Los no mapeados en el 07 llevan `match_type: null` y `unmapped: true`.
- **No** comparar `match_type === "unmapped"` (esa cadena no existe).

Función auxiliar: `isElementMappingUnmapped(mapping)`.

---

## Tipos exportados

| Tipo | Origen en el 07 |
|------|------------------|
| `GroupMappingFrom07` | `groups[]` |
| `UniqueElementMapping` | `elements_unique[]` |
| `ElementsUniqueIndex` | `Map<normalizeKey(monday_name), UniqueElementMapping>` |
| `ResolvedCategory` | Payload para insertar/upsert `category` |
| `ResolvedElement` | Payload para insertar/upsert `element` |

---

## `buildElementsUniqueIndex(elements)`

Construye el índice para lookups O(1). Clave: `normalizeKey(monday_name)` (minúsculas, sin tildes, espacios colapsados).

---

## `resolveCategoryFromMondayGroup(mondayGroupTitle, groupMappings)`

Resuelve la categoría de un **ítem raíz** (o cualquier fila cuyo grupo Monday no sea el contenedor técnico `Subitems`).

| Caso | `master_group_id` | `name` |
|------|-------------------|--------|
| Grupo mapeado en el 07 (`mapped: true` y UUID presente) | `groups[].master_group_id` | `groups[].master_group_name` (o título Monday si falta nombre catálogo) |
| Grupo no mapeado | `null` | Título Monday **literal** del grupo |

Alias de grupo del matcher (`FICC - SOCIETARIO` → entrada `SOCIETARIO`) se respetan vía `resolveGroupAlias`.

### Ejemplo (JSON real del 07)

**Mapeado — COMERCIAL**

```json
{
  "monday_title": "COMERCIAL",
  "master_group_id": "a322a613-14af-4ac5-86eb-a57ee3aa486b",
  "master_group_name": "COMERCIAL",
  "mapped": true
}
```

→ `{ master_group_id: "a322a613-...", name: "COMERCIAL" }`

**No mapeado — BUSINESS PLAN - EDIFICIOS**

```json
{
  "monday_title": "BUSINESS PLAN - EDIFICIOS",
  "master_group_id": null,
  "mapped": false,
  "unmapped": true
}
```

→ `{ master_group_id: null, name: "BUSINESS PLAN - EDIFICIOS" }`

---

## `resolveCategoryForSubitem(parentMondayGroup, groupMappings)`

Misma lógica que `resolveCategoryFromMondayGroup`, pero el caller la usa cuando el ítem tiene `mondayGroupTitle === "Subitems"`. El parámetro `parentMondayGroup` es el grupo del **ítem padre** (`parent_monday_group` en el flatten), no `"Subitems"`.

| Caso | Resultado |
|------|-----------|
| Padre en grupo mapeado (p. ej. `PROPERTY MANAGEMENT`) | Categoría con `master_group_id` de ese grupo |
| Padre en grupo no mapeado (p. ej. `GRUPO CUSTOM PADRE`) | `master_group_id: null`, `name` = nombre del grupo padre |

Helper: `isMondaySubitemsGroup(title)` → `true` si `normalizeKey(title) === "subitems"`.

---

## `lookupElementMapping(itemName, elementsUniqueIndex)`

Devuelve la fila de `elements_unique` o `null`. Comparación por `normalizeKey(itemName)`.

---

## `resolveElementFromMapping(mondayItemName, mapping)`

| Caso | `master_element_id` | `name` |
|------|---------------------|--------|
| `mapping` unmapped (`!mapped \|\| match_type == null`) o `mapping == null` | `null` | **`mondayItemName` literal** del ítem en el tablero |
| Mapeado | `mapping.master_element_id` | `mapping.master_element_name` (o literal Monday si falta nombre catálogo) |

El nombre del 07 agregado (`elements_unique[].monday_name`) **no** sustituye al literal del ítem en migración cuando el ítem está unmapped.

### Ejemplo — mapeado (Gobernanza)

```json
{
  "monday_name": "Gobernanza",
  "master_element_id": "faa95bf6-7112-4777-a6a5-b1099c3210c7",
  "master_element_name": "Gobernanza",
  "mapped": true,
  "match_type": "normalized"
}
```

`resolveElementFromMapping("Gobernanza", mapping)` →  
`{ master_element_id: "faa95bf6-...", name: "Gobernanza" }`

### Ejemplo — unmapped (Ascensor)

```json
{
  "monday_name": "Ascensor",
  "master_element_id": null,
  "mapped": false,
  "unmapped": true,
  "match_type": null
}
```

`resolveElementFromMapping("Ascensor", mapping)` →  
`{ master_element_id: null, name: "Ascensor" }`

Si en el tablero el texto fuera distinto (`"Ascensor (torre B)"`), se usaría ese literal aunque el 07 diga `"Ascensor"`.

---

## Flujo recomendado en P3.2 (transform)

Por cada fila de `flattenMondayItemsWithParentContext`:

1. **Categoría**
   - Si `isMondaySubitemsGroup(row.monday_group_title)` → `resolveCategoryForSubitem(row.parent_monday_group, groups)`
   - Si no → `resolveCategoryFromMondayGroup(row.monday_group_title, groups)`
2. **Elemento**
   - `mapping = lookupElementMapping(row.name, index)`
   - `resolveElementFromMapping(row.name, mapping)`
3. Persistir en P3.4: `category` + `element` (+ `parent_element_id` operativo si aplica árbol)

---

## Tests

```bash
npm run actas:test-migration-resolve
```

Archivo: [`scripts/actas/lib/__tests__/migration-resolve.test.ts`](../../scripts/actas/lib/__tests__/migration-resolve.test.ts).
