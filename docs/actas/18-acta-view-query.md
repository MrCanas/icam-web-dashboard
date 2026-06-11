# P8.1 — Vista de Acta (query y UX)

Consolidación de `log_entry` activas en un rango de fechas, agrupadas **categoría → elemento → cronológico ascendente** dentro de cada elemento.

## Enfoque de datos (sin RPC)

No usamos RPC ni vista materializada en V1. Tres consultas en paralelo secuencial (categorías → elementos + logs):

| # | Tabla | Propósito |
|---|--------|-----------|
| 1 | `category` | Metadatos, orden, colores (`master_group_id`) |
| 2 | `element` | Árbol (`parent_element_id`), orden, nombres |
| 3 | `log_entry` | Una fila por entrada en rango, `deleted_at IS NULL` |

Filtro de rango en BD:

```sql
entry_date >= :from_start_of_day
AND entry_date <= :to_end_of_day
AND element_id = ANY(:project_element_ids)
```

Índices existentes: `log_entry_entry_date_idx`, `log_entry_element_entry_date_idx`.

Tras la lectura, **agrupación en memoria** (`group-acta-view.ts`):

1. Opciones de autor/distinct derivadas del conjunto en rango (antes de filtrar por autor).
2. Filtros cliente: `categoryIds`, `authorIds` (incl. `null` → "Sin autor"), `onlyWithStatusChange`.
3. Agrupación por categoría y elemento; orden de elementos respetando árbol (raíz → hijos).
4. Entradas por elemento: **`entry_date` ASC** (lectura tipo acta / evolución temporal).

### Por qué no N+1

Un único `SELECT` de log entries para todos los `element_id` del proyecto en el rango (~200–300 filas en SA31/PC25). Resolución de autores: un `listUsers` paginado por IDs distintos (`resolveUserDisplayMap`).

### Performance esperado

| Escenario | Filas log | Tiempo objetivo |
|-----------|-----------|-----------------|
| GQ8, última semana | decenas | &lt; 200 ms |
| SA31, último trimestre | 200–300 | &lt; 1 s (red + agrupación JS) |

La UI renderiza todas las categorías visibles de una vez (sin lazy-load por categoría en V1). 300 nodos React es aceptable; si crece, siguiente paso: virtualizar lista o lazy-load por categoría al scroll.

## Server Action

`getActaView(input: ActasActaQueryInput)` → `ActasActaViewData`

```ts
{
  projectId: string;
  dateFrom: string;   // YYYY-MM-DD
  dateTo: string;
  categoryIds?: string[];
  authorIds?: (string | null)[];
  onlyWithStatusChange?: boolean;
}
```

## Estado en URL

Ruta: `/dashboard/pm/actas/{code}?tab=acta&...`

| Param | Valores |
|-------|---------|
| `range` | `week` (default), `month`, `quarter`, `custom` |
| `from`, `to` | `YYYY-MM-DD` (obligatorios si `custom`; presets los calculan al cambiar) |
| `categories` | `uuid,uuid` — omitido = todas |
| `authors` | `userId` o `__none__` para sin autor — omitido = todos |
| `statusOnly` | `1` = solo entradas con `status_before` y `status_after` |

**Compartir link** copia la URL completa; al abrir otra pestaña, `parseActaUrlState` restaura rango y filtros.

## Decisiones UX

| Tema | Decisión |
|------|----------|
| Orden dentro del elemento | **Ascendente** (más antiguo primero) — documento de reunión / evolución |
| Histórico inline (P5) | **Descendente** — lo más reciente arriba para operar |
| Categorías/elementos vacíos | No se muestran |
| Sin entradas en rango | Mensaje: probar rango más amplio |
| Exportar PDF | Stub deshabilitado (P8.2) |

## Archivos

| Archivo | Rol |
|---------|-----|
| `data/actaRepository.ts` | Queries Supabase |
| `logic/group-acta-view.ts` | Agrupación y filtros |
| `logic/acta-url-state.ts` | URL ↔ estado |
| `actions/get-acta-view.ts` | Server Action |
| `ui/components/acta/ActasActaTab.tsx` | Cabecera, filtros, cuerpo |
| `ui/components/acta/ActasActaCategoryBlock.tsx` | Bloque por categoría |
| `ui/components/acta/ActasActaEntryRow.tsx` | Fila de entrada |
