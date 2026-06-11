# Actas — Vista operativa compacta (P-UX-1)

Refactor de densidad del tablero operativo, alineado con Monday: una fila por elemento, acciones en hover a la izquierda.

## Objetivo de densidad

| Antes (aprox.) | Después (objetivo) |
|----------------|-------------------|
| ~60–80 px / fila | ~36–40 px / fila colapsada |
| ~10 elementos visibles | ~15–20 sin scroll en viewport típico |

Cambios de layout: `py-1.5`, `min-h-9`, avatares 24px, grid compacto de 6 columnas + acciones hover.

## Columnas visibles

1. **Elemento** — barra de acciones (hover) + indentación + nombre  
2. **Owner**  
3. **Status**  
4. **Plazo**  
5. **Última entrada**  
6. **Actualizado** (fecha relativa de última entrada)

Grid: `OPERATIVO_ROW_GRID` en `logic/element-display.ts`.

## Acciones rápidas (hover)

Contenedor de fila: `group/row`. Barra: `opacity-0 group-hover/row:opacity-100`.

| Icono | Acción | Comportamiento |
|-------|--------|----------------|
| ➕ | Añadir entrada | `ActasAddLogEntryPanel` bajo la fila |
| ⏬ | Sub-elemento | Solo en elementos raíz → creación inline (`createSubelement`) con nombre por defecto; la fila nueva aparece en modo edición con foco |
| 🕐 | Histórico | Expande `ActasElementHistoryPanel` |
| 🗑 | Eliminar | Modal → `archiveElement` (soft-delete) |

Iconos: SVG inline 16px (`ActasElementQuickActions.tsx`). Sin Lucide en el proyecto.

### Creación inline (P-UX-feedback-v2)

Tanto «Añadir elemento» (footer del grupo, `ActasCategoryGroup`) como «+ Sub-elemento» (quick-action de fila, `ActasElementRow`) crean directamente en BD con un nombre por defecto único entre hermanos (`logic/default-element-name.ts`) y dejan la fila recién creada en **modo edición con foco**. La señal de auto-edición la coordina `ActasInlineCreateContext` (solo estado de UI, no renderiza DOM → no afecta al grid). Ya no hay modal/panel intermedios para escribir el nombre.

### Ajustes del DOM

- Botones texto «Histórico» / «+ Añadir entrada» a la derecha  

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

## Columna Plazo (P-UX-4)

Click en la celda de plazo abre un calendario popover (`react-day-picker`) anclado a la celda.

| Estado visual | Regla |
|---------------|-------|
| `—` | `timeline_start` y `timeline_end` nulos |
| `+ Plazo` en hover | mismo estado vacío, solo en filas editables |
| Fecha única | deadline simple (`timeline_end`, `timeline_start = null`) |
| Rango | duración (`timeline_start` + `timeline_end`) |

Color del texto (solo si `timeline_end` existe y el estado no es `done`):

- rojo: vencido (`timeline_end < hoy`)  
- ámbar: vence en ≤7 días  
- normal: resto

### Semántica deadline vs duración

- Selección de un único día (o mismo día dos veces) → deadline (`timeline_end`)  
- Selección de dos días distintos → duración (`timeline_start` / `timeline_end`, ordenadas)

Botones del popover: **Aplicar**, **Aplicar como deadline**, **Quitar plazo**, **Cancelar**.

### Persistencia y logging

Server Action: `updateElementTimeline({ elementId, timelineStart, timelineEnd })`.

- Valida acceso RLS y formato `YYYY-MM-DD`
- Si llega rango invertido, lo corrige (swap) antes de guardar
- **No crea `log_entry`** por cambios de plazo: son ajustes frecuentes y generarían ruido en el histórico
- UI optimista con rollback + toast en error

### Modo histórico

En `readOnly` / snapshot, la celda de plazo es solo lectura y muestra el valor actual del elemento.
En V1 no se reconstruye histórico de plazos (igual que owners).

## Comparación con Monday

Monday agrupa acciones en iconos al hover de la fila y evita filas secundarias de botones. Este cambio replica ese patrón para reducir ruido visual y aumentar filas visibles por pantalla.

## Archivos principales

- `ActasElementRow.tsx`, `ActasElementQuickActions.tsx`  
- `ActasInlineCreateContext.tsx`, `logic/default-element-name.ts`, `ActasArchiveElementModal.tsx`  
- `ActasStatusPicker.tsx`, `ActasTimelinePicker.tsx`, `ActasOwnerPicker.tsx`, `ActasOwnerAvatars.tsx`
- `actions/change-element-status.ts`, `actions/update-element-timeline.ts`, `actions/element-owner.ts`, `actions/create-subelement.ts`, `actions/archive-element.ts`  
- `ActasOperativoColumnHeader.tsx`, `element-display.ts`
