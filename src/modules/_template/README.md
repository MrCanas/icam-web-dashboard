# Módulo _template

Plantilla viva para nuevos módulos del portal. **No está registrada** en `src/registry/modules.ts` ni aparece en la navegación.

## Qué hace

[Describe el propósito del área de negocio.]

## Modelo de datos

- Tabla `example_items`: [columnas y relación con el dominio]

## Acciones definidas

| Clave (`module.ts`) | Uso |
|---------------------|-----|
| `template.read` | Permiso de lectura (futuro RBAC) |
| `template.write` | Permiso de escritura (futuro RBAC) |

Auditoría (`audit_log`):

| Acción | Uso |
|--------|-----|
| `template.example_item.create` | Alta de un registro de ejemplo |

## Estructura interna

- `data/`: repositorios Supabase; `ctx` primer parámetro; `withAudit` en mutaciones
- `logic/`: reglas y transformaciones sin I/O
- `ui/`: componentes React; páginas en `ui/pages/` cuando el módulo esté activo
- `module.ts`: metadatos para el registro central

## Decisiones / convenciones específicas

[Notas que no cubre `ARCHITECTURE.md` en la raíz del repo.]

## Cómo activar este módulo

1. Copia `src/modules/_template/` → `src/modules/<nombre>/`.
2. Sustituye `Example` / `template` por el nombre real en archivos y símbolos.
3. Registra el módulo en `src/registry/modules.ts`.
4. Crea rutas finas en `src/app/dashboard/<nombre>/`.
5. Sigue los 11 pasos en `ARCHITECTURE.md` → «Cómo añadir un módulo nuevo».
