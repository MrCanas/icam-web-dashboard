# Módulo Portfolio

## Qué hace

Dashboard financiero del portfolio inmobiliario ICAM: KPIs ejecutivos, análisis de rentabilidad (TIR, ROE, múltiplos), listado de proyectos activos y tendencias (vintage, holding period). Los datos maestros se cargan desde Excel (hoja «Tabla madre») vía el workspace **Data**; este módulo solo los consume y visualiza.

## Modelo de datos

- Tabla **`proyectos`**: una fila por proyecto (y filas históricas con `es_ultima_fila = 0`). El dashboard filtra siempre `es_ultima_fila = 1`. Campos clave: `proyecto`, `situacion`, `tipo_proyecto`, métricas financieras (`inversion_total`, `tir_desp_is`, `roe_desp_is`, `multiplo`, etc.).
- Tabla **`upload_logs`**: historial de cargas Excel del portfolio (`archivo`, `num_proyectos`, `estado`, `duracion_ms`, `detalle` jsonb).
- RPC **`replace_proyectos`**: reemplazo atómico del snapshot de proyectos tras un upload.

> Esquema versionado en `supabase/migrations/` (`017_proyectos`, `018_replace_proyectos_rpc`). Los scripts en `scripts/supabase/` quedan como referencia/uso manual.

## Acciones definidas

Claves en `module.ts` (permisos futuros / RBAC):

| Clave | Uso |
|-------|-----|
| `portfolio.read` | Ver dashboards y listados |
| `portfolio.write` | Subir Excel / mutar datos (vía APIs Data) |
| `portfolio.delete` | Reservado para borrados explícitos |

Rutas secundarias (`routes`):

| Clave | Path | Pantalla |
|-------|------|----------|
| `portfolio.executive` | `/dashboard/portfolio` | Executive |
| `portfolio.rentabilidad` | `/dashboard/portfolio/rentabilidad` | Rentabilidad |
| `portfolio.proyectos` | `/dashboard/portfolio/proyectos` | Proyectos activos |
| `portfolio.tendencias` | `/dashboard/portfolio/tendencias` | Tendencias |

Auditoría (`audit_log`):

| Acción | Uso |
|--------|-----|
| `portfolio.proyecto.replace` | RPC `replace_proyectos` tras upload |
| `portfolio.upload_log.create` | Insert en `upload_logs` |

## Estructura interna

- **`data/`**: `proyectosRepository`, `uploadLogsRepository`, `readClient`, `excel-parser` (parseo del maestro Excel, no es query Supabase).
- **`logic/`**: `calculations`, `loadPortfolioPage`, `pageViewModels`, `portfolio-diff`, `proyectoSort`, `paths` (rutas derivadas del registro).
- **`ui/`**: gráficos y tablas del módulo; `ui/pages/*` implementan las pantallas; las entradas en `app/dashboard/portfolio/**` solo re-exportan.
- **`types.ts`**: `Proyecto`, `KPIBundle`, enums de situación/tipo.
- **`module.ts`**: metadatos registrados en `src/registry/modules.ts`.

## Decisiones / convenciones específicas

- **Lecturas en servidor** usan `getPortfolioReadSupabase` (browser en cliente, service role en servidor si está configurado).
- **Escrituras** siempre `getPortfolioWriteSupabase` (service role) + `withAudit`.
- **Filtro de negocio** `es_ultima_fila = 1` en repositorio; `filterUltimaFilaRows` en logic por defensa.
- **Cálculos de pantalla** en `logic/pageViewModels.ts`; las páginas solo cargan datos, aplican filtros URL y renderizan.
- **Rutas en UI**: usar `portfolioPaths` (`logic/paths.ts`) enlazado a `module.ts`, no strings sueltas.
- **Data workspace** vive en `src/components/data` + `platform-nav.ts`; las APIs `upload-excel` y `upload-logs` llaman a los repositorios de este módulo.
- **Componentes compartidos**: layout en `src/components/layout`; no hay chart genérico en `components/` — los gráficos son específicos de portfolio (`ui/`). PM reutiliza `KPICard` de este módulo (deuda: extraer a `components/` si se generaliza).
- **`seedProyectos.ts`**: datos mock locales; no toca Supabase.

Módulo de referencia del patrón del portal — ver también `src/modules/_template/` y `ARCHITECTURE.md`.
