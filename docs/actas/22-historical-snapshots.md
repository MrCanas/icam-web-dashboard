# Actas — Snapshots históricos (P9.3)

Reconstrucción de la vista operativa **a una fecha pasada**: status de cada elemento y última entrada visible en ese momento. Solo lectura.

## Concepto

Un snapshot responde: «¿Cómo estaba este proyecto el día X?» Útil para auditorías trimestrales o revisar el estado de un asunto en un cierre.

La reconstrucción se basa en **`log_entry`**, no en tablas de snapshot materializadas:

1. **Status** — último `status_after` registrado en una entrada con `entry_date <= fecha` (o `not_started` si no hubo cambios).
2. **Última entrada** — contenido y fecha de la entrada activa más reciente hasta esa fecha.

## Base de datos

Migración `supabase/migrations/20260530120000_010_snapshot_reconstruction.sql`:

```sql
reconstruct_project_at_date(p_project_id uuid, p_as_of_date timestamptz)
```

Devuelve una fila por elemento activo del proyecto (no archivado). Elementos sin actividad previa: `status_at_date = 'not_started'`, `last_log_*` NULL.

**Nota sobre `element.created_at`:** en datos migrados las fechas de creación pueden no reflejar la realidad; la función **no filtra** por `created_at` del elemento. El catálogo completo del proyecto aparece en el snapshot; la actividad se limita por `entry_date`.

Comparación de fecha: fin del día UTC (`YYYY-MM-DDT23:59:59.999Z`).

## API

### Server Action `getProjectSnapshotAtDate`

`src/modules/pm/actas/actions/get-project-snapshot-at-date.ts`

- Entrada: `{ projectId, asOfDate }` (`YYYY-MM-DD`).
- Fecha futura → modo `live` (igual que estado actual).
- Fecha anterior a `project.created_at` → `before_project`.
- Resto → RPC + ensamblado al formato `ActasOperativoCategory[]` (`snapshotRepository.ts`).

### Histórico inline filtrado

`GET /api/actas/elements/{id}/log-entries?asOf=YYYY-MM-DD` — solo entradas con `entry_date <= fin del día`.

## UI

### Selector de fecha

- Icono 📅 junto al título del proyecto (solo tab **Operativo**).
- Oculto por defecto; clic abre `input type="date"`.
- URL: `/dashboard/pm/actas/{code}?asOf=2026-01-01` (compartible).

### Modo histórico

- Banner ámbar: «Viendo el estado a fecha DD/MM/YYYY…» + enlace **Volver al estado actual**.
- `ActasOperativoBoard` con `mode: 'historical'`: sin añadir categoría/elemento/entrada, sin editar/borrar.
- Status y preview de última entrada vienen del snapshot.
- Histórico inline: entradas hasta la fecha + texto «Solo se muestran entradas hasta el DD/MM/YYYY.»

### Edge cases

| Caso | Comportamiento |
|------|----------------|
| Fecha futura | Vista en vivo (sin snapshot) |
| Antes de creación del proyecto | Mensaje + botón volver |
| Elemento sin entries hasta la fecha | `not_started`, «Sin actividad previa» |

## Limitaciones (V1)

- **Solo lectura** — no se puede editar ni añadir en modo snapshot.
- **Owners actuales** — no se reconstruyen responsables históricos (`element_owner` es estado presente).
- **Timeline** (`timeline_start` / `timeline_end`) — valores actuales del elemento, no históricos.
- **Elementos archivados** — excluidos del snapshot (como en operativo vivo).

## Aplicar migración

```bash
npx supabase db push
```

## Pruebas manuales (GQ8)

1. 📅 → `01/01/2026` → banner ámbar, status coherente con entries de esa época.
2. Expandir histórico de «Tramitación de licencias» → solo entries hasta la fecha.
3. **Volver al estado actual** → operativo normal.
4. Abrir `?asOf=2026-01-01` en otra pestaña → mismo snapshot.
