# P7.1 — Crear proyecto desde plantilla maestra

Alta de un proyecto Actas clonando categorías y elementos del catálogo maestro (`master_group`, `master_element`, `master_module`), sin historial ni responsables.

## UI

- Botón **+ Nuevo proyecto** en `ActasProjectSidebar`, encima del buscador.
- Modal centrado a pantalla casi completa (`ActasCreateProjectModal`) con wizard en una sola página:
  - Información: código, nombre, fase, tipo de activo, activo PM opcional.
  - Estructura: texto informativo + checkboxes de módulos opcionales con contador `(+N elementos)`.
  - Resumen dinámico: categorías y elementos que se crearán.
- Tras éxito: toast, cierre del modal, `router.push` a `/dashboard/pm/actas/{code}` y `revalidatePath` del layout Actas.

## Validación cliente

| Campo | Reglas |
|-------|--------|
| `code` | 2–10 chars, `A-Z0-9-`, mayúsculas automáticas. Blur → `checkActasProjectCode`. Duplicado → mensaje rojo. |
| `name` | Obligatorio, máx. 120. |
| Crear | Deshabilitado si hay errores de código/nombre o catálogo no cargado. |

## Server Actions

### `checkActasProjectCode(rawCode)`

Comprueba formato y unicidad en `project.code` (lectura Supabase con RLS del usuario).

### `getProjectWizardCatalog` / `getProjectWizardPreview(selectedModuleIds)`

Carga módulos con recuentos (`master_element_module`) y preview de categorías/elementos.

### `searchPmActivosAction(query)`

Búsqueda en `pm_activos` (`id_activo`, `nombre_display`).

### `createProjectFromTemplate(input)`

**Entrada:**

```ts
{
  code: string;
  name: string;
  phase: 'adquisicion' | 'desarrollo' | 'comercializacion' | 'desinversion';
  assetType: 'hotel' | 'residencial' | 'oficinas' | 'mixto' | 'otro';
  pmActivoId?: string | null;
  selectedModuleIds: string[];
}
```

**Salida éxito:** `{ ok: true, projectId, projectCode }`  
**Salida error:** `{ ok: false, error, status?: 409 }` — el modal permanece abierto.

**Transacción Postgres** (`getPgPool`, `BEGIN` … `COMMIT`):

1. Comprobar catálogo (grupos core y elementos core > 0); si no → mensaje `npm run actas:seed-master-catalog`.
2. Comprobar `project.code` único; conflicto → 409.
3. `INSERT project` con `organization_id` de `org_member` (fallback org ICAM), `created_by`, `pm_activo_id` opcional, `status = active`.
4. `INSERT project_module` por cada `selectedModuleIds`.
5. `INSERT category` por cada `master_group` con `is_core = true` **o** cuyo `name` coincide con un `master_module` seleccionado (`name`, `master_group_id`, `order_index`).
6. Seleccionar `master_element` donde no tiene fila en `master_element_module` **o** está vinculado a un módulo seleccionado.
7. **Dos pasadas** de `INSERT element`:
   - Pasada 1: `parent_element_id IS NULL` en catálogo → mapa `master_element.id` → `element.id`.
   - Pasada 2: hijos con `parent_element_id` resuelto.
   - Campos: `category_id`, `name`, `master_element_id`, `status = not_started`, `order_index`, `parent_element_id`.

**No se crea:** `log_entry`, `element_owner`, timelines ni actividad.

**Triggers:** el trigger de estado en `log_entry` no aplica a inserts masivos de `element` sin logs. No se usa `session_replication_role` salvo necesidad futura.

## Catálogo y conteos

- Elementos **core**: sin fila en `master_element_module` (~89 en catálogo v2).
- Elementos **de módulo**: filas en `master_element_module` para el `master_module_id` elegido (p. ej. Operador hotelero ≈ +12).
- Categorías: 6 grupos `is_core` + 1 categoría por cada módulo opcional activado (grupo homónimo).

## Migración

`20260528120000_008_project_pm_activo.sql` — columna `project.pm_activo_id` → `pm_activos(id)`.

## Criterios de aceptación

1. Botón abre wizard completo.
2. Código duplicado en blur → error inmediato.
3. `TEST1` + Desarrollo + Residencial + Operador hotelero → ~89 + 12 ≈ 101 elementos en BD.
4. Navegación a vista operativa con categorías vacías colapsables.
5. Sin módulos → solo elementos core.

## Duplicar proyecto (P7.2)

Clona la **estructura operativa** de un proyecto existente en uno nuevo, sin historial ni responsables.

### UI

- Menú kebab (⋮) en cada ítem de la sidebar; visible al hover del proyecto.
- Opciones: **Duplicar proyecto…** y **Archivar proyecto**.
- Modal compacto (`ActasDuplicateProjectModal`): código y nombre del nuevo proyecto, mismas validaciones que P7.1.
- Spinner en **Duplicar** durante la transacción (proyectos grandes pueden tardar varios segundos).
- Toast: `{ORIG} duplicado como {NEW}` o, si no hay categorías/elementos, `… (proyecto sin estructura)`.

### `duplicateProject({ sourceProjectId, newCode, newName })`

**Acceso:** lectura del proyecto origen vía Supabase + RLS (`user_belongs_to_org`). Si no existe → 404.

**Transacción Postgres:**

1. `newCode` único; conflicto → 409.
2. `INSERT project` con `phase`, `asset_type`, `organization_id` del origen; `newCode`, `newName`; **`pm_activo_id = NULL`** (vínculo PM se configura después en Ajustes).
3. Copia `project_module` del origen.
4. Copia `category` no archivadas → mapa `oldCategoryId → newCategoryId`.
5. Copia `element` no archivados en **dos pasadas** (raíz, luego hijos).

| Campo elemento | Comportamiento |
|----------------|----------------|
| `name`, `master_element_id`, `order_index`, `timeline_start`, `timeline_end` | Copiados (planificación) |
| `status` | Siempre `not_started` |
| `parent_element_id` | Remapeado al nuevo árbol |

**No se copia:** `log_entry`, `element_owner`, `pm_activo_id`, estado operativo del origen.

### Justificación

- **Sin logs:** el texto del historial pertenece al proyecto origen; copiarlo confundiría al usuario en el clon.
- **Sin status:** un elemento `done` en el origen haría parecer trabajo ya hecho en un proyecto recién duplicado.
- **Sin owners:** los responsables se asignan de nuevo en el nuevo contexto.

### Criterios de aceptación (P7.2)

1. Kebab en GQ8 → Duplicar → modal con código/nombre.
2. `GQ8_COPY` → navegación al nuevo proyecto.
3. Misma estructura que GQ8 (p. ej. 6 categorías, 57 elementos), todos `not_started`, 0 `log_entry`.
4. Sidebar lista ambos proyectos por separado.

## Archivar / Restaurar (P7.3)

Archivado **lógico** vía `project.archived_at` (timestamptz). No se modifican categorías, elementos, `log_entry` ni `element_owner`.

### Semántica

| Concepto | Comportamiento |
|----------|----------------|
| Listado principal | `fetchActasProjects` filtra `archived_at IS NULL` |
| Sidebar | Enlace **Proyectos archivados (N)** si `N > 0` → `/dashboard/pm/actas/archivados` |
| URL directa a proyecto archivado | Pantalla intermedia (`ActasProjectArchivedScreen`): Restaurar / Volver — **no** 404 |
| Restaurar | `archived_at = NULL`; el proyecto vuelve al listado activo con estructura intacta |

### UI archivar

- Kebab → **Archivar proyecto** → modal de confirmación (botón ámbar).
- Tras archivar: toast con enlace a archivados; desaparece del sidebar; si estabas en ese proyecto → redirect al hub.

### Server Actions

- `archiveProject({ projectId })` — `UPDATE project SET archived_at = now()` (Supabase autenticado + RLS).
- `restoreProject({ projectId })` — `UPDATE project SET archived_at = NULL`.

Solo se toca la fila `project`. El contenido sigue en BD para trazabilidad y posibles informes.

### Política: sin borrado desde UI (V1)

No hay “eliminar definitivamente” en la interfaz. Motivo: **trazabilidad** y auditoría. Si hace falta borrar un proyecto de verdad (casos excepcionales), hacerlo en SQL con justificación documentada.

**WARNING — borrado definitivo manual (Postgres):**

```sql
-- ⚠️ IRREVERSIBLE: elimina el proyecto y, por ON DELETE CASCADE/RESTRICT de las FKs,
-- categorías, elementos, project_module, etc. según el esquema migrado.
-- Sustituir :project_code por el código real. Ejecutar solo tras backup y aprobación explícita.
DELETE FROM public.project WHERE code = :project_code;
```

Revisar restricciones (`ON DELETE RESTRICT` en `category.project_id`, etc.) antes de ejecutar; puede ser necesario borrar en orden inverso a las dependencias si alguna FK es RESTRICT.

### Criterios de aceptación (P7.3)

1. Archivar `GQ8_COPY` → desaparece del sidebar; aparece **Proyectos archivados (1)**.
2. Listado archivados con restaurar → vuelve al sidebar y navega al proyecto.
3. URL `/dashboard/pm/actas/GQ8_COPY` archivado → pantalla Restaurar / Volver.
4. Proyecto restaurado conserva categorías, elementos y logs.

## Archivos principales

| Archivo | Rol |
|---------|-----|
| `actions/create-project-from-template.ts` | Transacción de alta desde catálogo |
| `actions/duplicate-project.ts` | Transacción de clonación |
| `actions/archive-project.ts` | Archivar (`archived_at`) |
| `actions/restore-project.ts` | Restaurar |
| `actions/check-actas-project-code.ts` | Unicidad código |
| `actions/get-project-wizard-catalog.ts` | Catálogo UI |
| `data/actasRepository.ts` | Listados, ruta archivado/activo |
| `data/projectTemplateRepository.ts` | Queries Supabase |
| `ui/components/ActasCreateProjectModal.tsx` | Wizard alta |
| `ui/components/ActasDuplicateProjectModal.tsx` | Modal duplicar |
| `ui/components/ActasArchiveProjectModal.tsx` | Modal archivar |
| `ui/components/ActasProjectArchivedScreen.tsx` | Proyecto archivado por URL |
| `ui/pages/ActasArchivedProjectsPage.tsx` | Listado archivados |
| `ui/components/ActasProjectSidebarItem.tsx` | Fila + kebab |
| `ui/components/ActasProjectSidebar.tsx` | Botón + toasts |
| `app/dashboard/pm/actas/archivados/page.tsx` | Ruta archivados |
