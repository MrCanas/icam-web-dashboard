# Actas — Búsqueda full-text (P9.2)

Búsqueda de entradas de log (`log_entry`) dentro de un proyecto, con ranking por relevancia y fragmentos resaltados.

## Base de datos

### Columna `search_vector`

Migración `supabase/migrations/20260529120000_009_log_entry_search.sql`:

- Columna generada `search_vector tsvector` con `GENERATED ALWAYS AS (to_tsvector('spanish', coalesce(content, ''))) STORED`.
- Se rellena **retroactivamente** en todas las filas existentes al aplicar la migración.
- Configuración **`spanish`**: stemming (plurales, conjugaciones), normalización de acentos en el analizador de texto completo de PostgreSQL.

### Índice GIN

`log_entry_search_idx` sobre `search_vector` para consultas `@@` en tiempo sub-lineal (~&lt;100 ms con ~4k filas).

### RPC `search_log_entries`

Parámetros:

| Parámetro       | Tipo   | Descripción                          |
|-----------------|--------|--------------------------------------|
| `p_project_id`  | uuid   | Proyecto Actas                       |
| `p_query`       | text   | Texto de búsqueda (tokenizado)       |
| `p_limit`       | int    | Máximo de filas (default 50)         |

Comportamiento:

- `plainto_tsquery('spanish', p_query)` — tokens AND implícitos; no es búsqueda de frase exacta.
- Filtros: `deleted_at IS NULL`, `element.archived_at IS NULL`, `category.project_id = p_project_id`.
- Orden: `ts_rank` DESC, `entry_date` DESC.
- `ts_headline` con marcadores `<<mark>>` / `<</mark>>` (convertidos a `<mark>` en UI).

Ejecutable por rol `authenticated`; RLS de `log_entry`, `element` y `category` aplica al invocar con JWT del bridge ICAM.

## API de aplicación

### Server Action `searchLogEntries`

`src/modules/pm/actas/actions/search-log-entries.ts`

- Entrada: `{ projectId, query, limit?: 50 }`.
- Comprueba acceso al proyecto vía cliente autenticado (RLS en `project`).
- Llama al RPC y resuelve etiquetas de autor (`resolveUserDisplayMap`).

### Repositorio

`src/modules/pm/actas/data/searchRepository.ts` — lógica compartida servidor.

## UI

### Buscador de proyecto

`ActasProjectSearch` en la cabecera del proyecto (`ActasProjectPage`), visible en los cuatro tabs.

| Comportamiento        | Valor                                      |
|-----------------------|--------------------------------------------|
| Placeholder           | «Buscar en este proyecto…»                 |
| Atajo                 | **Ctrl/Cmd + K** enfoca el input           |
| Mínimo de caracteres  | 3 (sin consulta ni dropdown antes)         |
| Debounce              | 300 ms                                     |
| Resultados en dropdown| Hasta 50 del RPC; lista con scroll (~10 visibles) |
| Vacío                 | «Sin coincidencias para 'query'.»          |
| Carga                 | Spinner en el icono del input              |

Cada resultado muestra: elemento (negrita), categoría, headline con `<mark>`, fecha y autor.

**Navegación al hacer clic:**

`/dashboard/pm/actas/{code}?tab=historico&element={elementId}#entry-{logEntryId}`

### Histórico — scroll y highlight

En `ActasHistoricoElementView`, si la URL incluye `#entry-{uuid}`:

1. `scrollIntoView` suave al bloque de la entrada.
2. Pulso visual ~1 s (fondo ámbar + anillo).

## Limitaciones (V1)

- **Un solo proyecto** por búsqueda (no hay búsqueda global multi-proyecto).
- **Sin fuzzy** ni tolerancia a typos (`pg_trgm` no usado).
- **Sin frase exacta** con comillas: `plainto_tsquery` tokeniza; para frases exactas, V2 con `phraseto_tsquery`.
- Números y códigos literales (p. ej. «IBI», «Iberdrola») funcionan como tokens normales.
- Entradas borradas o elementos archivados no aparecen en resultados.

## Aplicar migración

```bash
npx supabase db push
```

Verificación:

```sql
SELECT search_vector FROM log_entry LIMIT 1;
-- search_vector no debe ser NULL en filas con content
```

## Pruebas manuales sugeridas (GQ8)

1. Buscar «Iberdrola» → entradas en Suministros u otras categorías.
2. Buscar «licencia» → entradas de tramitación, ordenadas por relevancia.
3. Clic en resultado → tab Histórico, elemento correcto, scroll + highlight.
4. **Cmd/Ctrl+K** → foco en el buscador.
5. «xyzqwerty123» → mensaje sin coincidencias.
