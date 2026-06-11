# P8.2 — Exportación PDF del acta

Generación **server-side** del acta con los mismos filtros y rango que la vista P8.1.

## Librería

**[@react-pdf/renderer](https://react-pdf.org/)** (v4+):

- Mismo lenguaje React que el portal; layout declarativo (`Document`, `Page`, `View`, `Text`).
- `renderToBuffer()` en la API Route (Node.js, `runtime = "nodejs"`).
- Sin headless Chrome → más ligero que Puppeteer en Vercel (cold start y tamaño de función).

No se usa caché: cada export lee datos en vivo.

## Endpoint

`POST /api/actas/projects/{projectId}/export-pdf`

| Aspecto | Detalle |
|---------|---------|
| Auth | Sesión ICAM (`getCurrentUser`) + RLS al leer proyecto y logs |
| Body | Mismo schema que `getActaView` / `ActasActaQueryInput` |
| Respuesta | `application/pdf`, `Content-Disposition: attachment`, `Cache-Control: no-store` |
| Filename | `acta-{CODE}-{FROM}-{TO}.pdf` |

## Flujo

1. Validar body (`dateFrom`, `dateTo` en `YYYY-MM-DD`).
2. Comprobar acceso al proyecto (`project`, no archivado).
3. `fetchActasActaView` (reutiliza P8.1).
4. `buildActaPdfFilterLines` para la portada.
5. `renderActaPdfBuffer` → `ActaPdfDocument` → buffer PDF.

## Estructura del PDF

### Portada (1ª página)

- Título: **ACTA — {CODE}**
- Nombre completo del proyecto
- Período (dd/mm/yyyy – dd/mm/yyyy)
- Fecha de generación (dd/mm/yyyy hh:mm)
- Líneas de filtros activos (si aplica)
- **Entradas: N**
- Si N = 0: nota “0 entradas en este período…”

### Contenido

- **Una página nueva por categoría** (facilita impresión por bloques).
- Cabecera de categoría con color `master_group` (misma paleta que operativo).
- Por elemento: subtítulo bold + entradas en orden **cronológico ascendente**.
- Cada entrada: fecha/hora, autor, contenido; línea “Estado: X → Y” si hay transición.
- Sangría por `depth` en sub-elementos.

### Pie de página (todas las páginas)

`Acta {CODE} — Página X de Y` (callback `render` de react-pdf).

### Tipografía

| Uso | Tamaño | Fuente |
|-----|--------|--------|
| Título portada | 18pt | Helvetica-Bold |
| Subtítulos | 11–12pt | Helvetica-Bold |
| Cuerpo | 10pt | Helvetica |
| Meta / pie | 8–9pt | Helvetica |

Interlineado ~1.45 en cuerpo.

Logo ICAM: omitido en V1 (sin asset SVG/PNG estable en repo).

## UI (tab Acta)

Botón **Exportar PDF** → `POST` con filtros actuales → spinner “Generando…” → descarga automática del blob.

## Performance y límites

| Escenario | Comportamiento esperado |
|-----------|-------------------------|
| GQ8, último mes | 2–5 s, PDF legible |
| SA31 / PC25, trimestre (~200–300 entradas) | &lt; 10 s en local; Vercel Pro ~30 s límite |
| &gt; 500 entradas | PDF largo (&gt;50 páginas); aceptable en V1 |
| Acta vacía | PDF de 1 página (solo portada) |

Si en producción aparece timeout (&gt;30 s en Hobby), documentar como limitación o subir `maxDuration` en la ruta (plan Pro).

## Archivos

| Archivo | Rol |
|---------|-----|
| `pdf/ActaPdfDocument.tsx` | Layout PDF |
| `pdf/render-acta-pdf.ts` | `renderToBuffer` |
| `pdf/acta-pdf-types.ts` | Tipos, filename, filtros portada |
| `app/api/actas/projects/[projectId]/export-pdf/route.ts` | HTTP POST |
| `ui/components/acta/ActasActaTab.tsx` | Botón export + descarga |
