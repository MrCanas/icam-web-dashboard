# Seed del catálogo maestro (P1.2)

Carga en Supabase los datos de la hoja **Catálogo Maestro** del Excel de referencia.

## Fuente de datos

| Archivo | Hojas usadas |
|---------|----------------|
| [`catalogo-maestro.xlsx`](./catalogo-maestro.xlsx) | `Resumen` (grupos + Core/Módulo), `Catálogo Maestro` (elementos y sub-elementos) |

Copia de respaldo: `Catalogo_Maestro_Proyectos.xlsx` (mismo contenido). El script prueba ambas rutas.

## Qué inserta

| Tabla | Contenido |
|-------|-----------|
| `master_group` | 10 grupos (`is_core` según columna Tipo en `Resumen`) |
| `master_module` | 4 módulos: DESINVERSIÓN, OPERADOR HOTELERO, SITUACIÓN INQUILINOS, ACTIVO ACCESORIO VINCULADO |
| `master_element` | 73 elementos + 21 sub-elementos (árbol vía `parent_element_id`) |
| `master_element_module` | Enlace de cada elemento cuyo **grupo** es uno de los 4 módulos opcionales |

## Requisitos

- `.env.local` con `SUPABASE_SERVICE_ROLE_KEY` y URL (ver [`.env.local.example`](../../.env.local.example)).
- Migración P1.1 aplicada: `20260522100000_001_master_catalog.sql` (`npx supabase db push`).

## Cargar o recargar el catálogo

Desde la raíz del repo:

```bash
npm run actas:seed-master-catalog
```

### Si cambia el Excel

1. Actualiza `docs/actas/catalogo-maestro.xlsx` (o sustituye el archivo y mantén el nombre canónico).
2. Revisa la hoja `Resumen` si añades/quitas grupos.
3. Vuelve a ejecutar:

```bash
npm run actas:seed-master-catalog
```

El script es **idempotente**: upsert por `name` en grupos/módulos y por `(master_group_id, name, parent_element_id)` en elementos. Una segunda ejecución sin cambios en el Excel debe mostrar casi todo **skipped** y el mismo `count(*)` en `master_element`.

### Comprobar en Supabase

```sql
SELECT count(*) FROM master_element;          -- esperado: 94
SELECT count(*) FROM master_group;            -- 10
SELECT count(*) FROM master_module;             -- 4
SELECT count(*) FROM master_element_module;     -- elementos en grupos-módulo
```

O:

```bash
npm run actas:verify-master-catalog
```

## Salida del script

Ejemplo tras la primera carga:

```text
master_group: { inserted: 10, updated: 0, skipped: 0 }
master_module: { inserted: 4, updated: 0, skipped: 0 }
master_element: { inserted: 94, updated: 0, skipped: 0 }
master_element_module: { inserted: 17, updated: 0, skipped: 0 }
master_element total en BD: 94
```

Tras re-ejecutar sin cambios:

```text
master_group: { inserted: 0, updated: 0, skipped: 10 }
master_element: { inserted: 0, updated: 0, skipped: 94 }
…
```

## Implementación

Script: [`scripts/actas/seed-master-catalog.ts`](../../scripts/actas/seed-master-catalog.ts)  
Cliente: `createActasServerClient()` (service role) — ver [`02-supabase-clients.md`](./02-supabase-clients.md).
