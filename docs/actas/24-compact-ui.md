# Actas — Vista operativa compacta (P-UX-1)

Refactor de densidad del tablero operativo, alineado con Monday: una fila por elemento, acciones en hover a la izquierda.

## Objetivo de densidad

| Antes (aprox.) | Después (objetivo) |
|----------------|-------------------|
| ~60–80 px / fila | ~36–40 px / fila colapsada |
| ~10 elementos visibles | ~15–20 sin scroll en viewport típico |

Cambios de layout: `py-1.5`, `min-h-9`, avatares 24px, grid de 5 columnas (sin Timeline ni columna de acciones a la derecha).

## Columnas visibles

1. **Elemento** — barra de acciones (hover) + indentación + nombre  
2. **Owner**  
3. **Status**  
4. **Última entrada**  
5. **Fecha** (relativa)

`timeline_start` / `timeline_end` siguen en modelo y queries; **no se renderizan** (reservado para V2).

Grid: `OPERATIVO_ROW_GRID` en `logic/element-display.ts`.

## Acciones rápidas (hover)

Contenedor de fila: `group/row`. Barra: `opacity-0 group-hover/row:opacity-100`.

| Icono | Acción | Comportamiento |
|-------|--------|----------------|
| ➕ | Añadir entrada | `ActasAddLogEntryPanel` bajo la fila |
| ⏬ | Sub-elemento | Solo en elementos raíz → `ActasAddSubelementPanel` |
| 🕐 | Histórico | Expande `ActasElementHistoryPanel` |
| 🗑 | Eliminar | Modal → `archiveElement` (soft-delete) |

Iconos: SVG inline 16px (`ActasElementQuickActions.tsx`). Sin Lucide en el proyecto.

### Eliminado del DOM

- Botones texto «Histórico» / «+ Añadir entrada» a la derecha  
- Fila «+ Sub-elemento» bajo cada padre  
- Columna Timeline (cabecera y celdas)

## Server Actions

### `createSubelement`

- Valida padre raíz, acceso RLS.  
- `INSERT` con `status = not_started`, `master_element_id = null`, `order_index = max(hermanos)+1`.  
- Copia `element_owner` del padre si existe.

### `archiveElement`

- `archived_at = now()` en el elemento y **todos los descendientes** (BFS en servidor).  
- Toast: «{nombre} eliminado.» — **sin undo** en V1 (distinto de log entries).

Restaurar manualmente (SQL):

```sql
UPDATE element SET archived_at = NULL WHERE id = '...';
-- incluir descendientes si aplica
```

## Modo histórico (P9.3)

En `readOnly` / snapshot: no se muestra la barra de acciones; el resto del layout compacto se mantiene.

## Picker de owner (P-UX-2)

Click en avatares de owner (o en «—» si no hay responsables) abre un popover anclado (~280px) debajo del avatar.

| Comportamiento | Detalle |
|----------------|---------|
| Apertura | Cualquier avatar abre el mismo popover del elemento |
| Búsqueda | Debounce 250ms; filtra miembros de `org_member` de la org del proyecto |
| Sin búsqueda | Primeros 10 users por email |
| Toggle | Click en usuario → add/remove inmediato (sin Guardar) |
| Optimista | Avatares en fila se actualizan al instante; revert + toast si falla la action |
| Cierre | Click fuera o Escape |

### Server Actions

- `addElementOwner({ elementId, userId })` — upsert idempotente en `element_owner`
- `removeElementOwner({ elementId, userId })` — delete idempotente
- `searchOrgMembers({ orgId, query, limit? })` — users de la org vía `auth.admin.listUsers` + filtro
- `getElementOwnerPickerContext(elementId)` — `orgId` + `orgName` del proyecto

### Edge cases

- **UUID sin auth.users** → avatar gris «?», chip «Usuario no encontrado»; se puede quitar con ×
- **Sin resultados de búsqueda** → «Sin coincidencias. ¿Quizá el usuario no es miembro de {org}?»
- **Popover abierto** → `stopPropagation` en fila; no colapsa paneles expandidos

Componentes: `ActasOwnerPicker.tsx`, `ActasOwnerAvatars.tsx`, `data/orgMembersRepository.ts`, `actions/element-owner.ts`.

## Picker de status (P-UX-3)

Click en el badge de status abre un dropdown (~180px) anclado debajo.

| Comportamiento | Detalle |
|----------------|---------|
| Opciones | 4 estados con color de badge + etiqueta ES; ✓ en el actual |
| Selección | Cierra al elegir; sin botón Cancelar (click fuera / Escape) |
| Optimista | Badge y «Última entrada» se actualizan al instante |
| Audit trail | `changeElementStatus` crea `log_entry` auto: «Estado cambiado: X → Y» con `status_before` / `status_after`, `source = ui`; trigger BD sincroniza `element.status` |
| Sin comentario | No hay prompt al cambiar; contexto extra vía ➕ Añadir entrada |
| Histórico abierto | `historyReloadNonce` recarga la lista; la entrada nueva aparece arriba con chip de transición |
| Error servidor | Revert del badge + toast «No se pudo cambiar el estado. Intenta de nuevo.» |
| Clicks rápidos | Cola serial por `elementId` en cliente; cada action lee status actual en servidor → última acción completada gana |
| Modo histórico | `readOnly` → badge estático, no clickable |

Server Action: `changeElementStatus({ elementId, newStatus })`. Si `newStatus === current` → no-op sin insert.

Componentes: `ActasStatusPicker.tsx`, `actions/change-element-status.ts`, `logic/status-change-log.ts`.

## Comparación con Monday

Monday agrupa acciones en iconos al hover de la fila y evita filas secundarias de botones. Este cambio replica ese patrón para reducir ruido visual y aumentar filas visibles por pantalla.

## Archivos principales

- `ActasElementRow.tsx`, `ActasElementQuickActions.tsx`  
- `ActasAddSubelementPanel.tsx`, `ActasArchiveElementModal.tsx`  
- `ActasStatusPicker.tsx`, `ActasOwnerPicker.tsx`, `ActasOwnerAvatars.tsx`
- `actions/change-element-status.ts`, `actions/element-owner.ts`, `actions/create-subelement.ts`, `actions/archive-element.ts`  
- `ActasOperativoColumnHeader.tsx`, `element-display.ts`
