# pm/informes — Informes trimestrales para inversores

Las PMs generan desde el portal el informe trimestral de un proyecto. Las **actas** y la **planificación** del trimestre entran como fuentes automáticamente, y Claude redacta los slides con el design system de Impar.

## Cómo está montado

La herramienta es la misma app que funcionaba como artifact de claude.ai (motor de slides + design system + flujo guiado). Se reutiliza sin reescribirla.

- `public/informes-app/` es la app compilada. **No se edita a mano.** La fuente vive en el repo del motor de informes (`ImparOS-InformesTrimestrales/app-equipo`) y se regenera con:
  ```
  python construir_app.py --destino dashboard --salida <ruta a este repo>/public/informes-app
  ```
- `claude-shim.js`, incluido en esa build, sustituye `window.claude.*` por las rutas de `/api/informes/*`:

| Artifact (`window.claude`) | Portal |
|---|---|
| `sample.json` | `POST /api/informes/claude`: API de Anthropic, NDJSON en streaming |
| `db` | `/api/informes/db/<coleccion>[/<id>]` → tablas `informe_*` |
| `assets` | `POST /api/informes/assets`, `GET/DELETE /api/informes/assets/<id>` |
| `downloads` | descarga directa del navegador |

- `window.ICAM` (lo define el shim) activa los ganchos propios del portal en la app: la lista de proyectos sale de `pm_activos` y las fuentes automáticas se cargan en el paso 2.

## Tablas (migración 043)

| Tabla | Contenido |
|---|---|
| `informe_proyecto` | Arquetipo y pie legal por código de informe. `id_activo` es el puente con actas y planificación. |
| `informe` | Un informe por proyecto y trimestre. `datos` es el documento completo de la app. |
| `informe_fuente` | Notas, documentos (incluidas las fuentes automáticas) y el texto del informe anterior. |
| `informe_version` | Instantáneas al guardar versión. |
| `informe_asset` | Fotos; el binario está en el bucket privado `informes-fotos`. |
| `informe_uso` | Una fila por petición a Claude, con tokens y coste en USD. |

Todas tienen RLS sin políticas: se sirven solo con service role desde los route handlers, después de comprobar la zona `pm`.

## Permisos

- **Ver informes:** cualquier rol de la zona `pm` (route key `pm.informes`).
- **Generar, corregir, subir fotos o borrar:** editor o admin de `pm`. `/api/informes/claude` devuelve 403 a un lector.

## Claude

- Modelo `claude-opus-5-5` con `effort: high`. Se puede cambiar con `INFORMES_CLAUDE_MODEL` / `INFORMES_CLAUDE_EFFORT`.
- La parte estable de cada prompt de slide (rol, contexto, catálogo de layouts, API y reglas, ≈21 KB) se envía con `cache_control`. Desde la segunda petición de un informe, esa parte se cobra a precio de lectura de caché.
- Cada petición se registra en `informe_uso`, incluidas las que terminan en `refusal` o `max_tokens`, porque también se facturan.
- `ANTHROPIC_API_KEY` es una key de Anthropic Console. Una suscripción Pro/Max no sirve: es de uso personal.

## Auditoría

Todas las escrituras pasan por `withAudit`: `pm.informe.<coleccion>.set|delete`, `pm.informe.asset.create|delete` y `pm.informe.claude.call`.
