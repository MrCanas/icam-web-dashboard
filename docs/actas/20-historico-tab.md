# P8.3 — Tab Histórico y permalink de elemento

Vista dedicada a la **evolución completa** de un elemento: todas las `log_entry` desde la creación, en orden narrativo ascendente.

## URLs

| Vista | URL |
|-------|-----|
| Hub (selector) | `/dashboard/pm/actas/{code}?tab=historico` |
| **Permalink canónico** | `/dashboard/pm/actas/{code}?tab=historico&element={elementId}` |

Helpers: `actasProjectHistoricoHubPath`, `actasProjectElementHistoricoPath`, `actasElementPermalinkUrl`.

## Hub (sin `element`)

- Título + buscador con autocomplete de todos los elementos del proyecto.
- Cada opción: nombre + categoría como subtítulo.
- Click → navegación al permalink.

Datos: `fetchHistoricoElementOptions` (categorías + elementos del proyecto).

## Vista detalle (`element={id}`)

### Cabecera

- Breadcrumb: Proyecto → Categoría → Elemento (enlaces al tab Operativo).
- Nombre, badge de status, owners (avatares), planificación, fecha creación, última actividad.
- Badge **Elemento archivado** si `element.archived_at` no es null.
- Botones: Volver al selector, Compartir link (copia permalink).

### Timeline

- Todas las entradas **ASC** (más antigua arriba).
- Marca temporal a la izquierda; contenido + autor a la derecha; chip de status si aplica.
- Separador `↓ N días sin actividad ↓` si hay **>30 días** entre entradas consecutivas.
- Entradas borradas: ocultas por defecto; toggle **Mostrar entradas borradas (N)** — tachadas con fecha de borrado.

### Sin actividad

Mensaje orientando a añadir la primera entrada desde Operativo.

### 404 amable

Si `elementId` no pertenece al `projectCode` → mensaje + botón volver al hub.

## Datos

Una query compuesta en `fetchHistoricoElementDetail`:

1. `element` + join `category` (validar `project_id`).
2. `element_owner` (owners actuales).
3. `log_entry` del elemento, **ORDER BY entry_date ASC** (incluye borradas para el toggle).

Server Actions: `getHistoricoElementOptions`, `getHistoricoElementDetail`.

## Integración con otros tabs

| Origen | Enlace |
|--------|--------|
| **Operativo** (P5.3) | «Ver histórico completo →» → `actasProjectElementHistoricoPath` |
| **Acta** (P8.1) | Icono 🔗 al hover en cada entry → copia permalink del elemento |

## Pendiente (mejora futura)

Mini-gráfico de evolución de status (línea temporal con puntos coloreados) — omitido en V1 por complejidad.

## Archivos

| Archivo | Rol |
|---------|-----|
| `data/actasRepository.ts` | `fetchHistoricoElementOptions`, `fetchHistoricoElementDetail` |
| `actions/get-historico-element.ts` | Server Actions |
| `logic/historico-timeline.ts` | Gaps >30 días, conteo borradas |
| `logic/actas-paths.ts` | Permalink helpers |
| `ui/components/historico/*` | Hub, detalle, timeline |
| `ui/components/acta/ActasActaEntryRow.tsx` | 🔗 copiar permalink |
