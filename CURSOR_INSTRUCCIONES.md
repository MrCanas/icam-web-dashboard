# Instrucciones: Montar Page 1 Executive Summary con Cursor + pbi-tools

## Resumen
Este documento te guía para construir la Página 1 (Executive Summary) del dashboard
`DashboardMaestro.pbix` usando **Cursor IDE con Claude Opus** y **pbi-tools** para
extraer, modificar y recompilar el archivo .pbix.

---

## PASO 0 — Requisitos previos

1. **Power BI Desktop** instalado y funcionando (ya lo tienes).
2. **.NET SDK 8.0+** — descárgalo de https://dotnet.microsoft.com/download si no lo tienes.
3. **pbi-tools** — instala con:
   ```
   dotnet tool install -g pbi-tools
   ```
   Verifica con `pbi-tools info`. Si no reconoce el comando, añade `%USERPROFILE%\.dotnet\tools` al PATH.
4. **Cursor IDE** con Claude Opus como modelo.

---

## PASO 1 — Extraer el .pbix

1. **Cierra Power BI Desktop** (obligatorio — el archivo debe estar desbloqueado).
2. Abre una terminal en la carpeta donde está `DashboardMaestro.pbix`.
3. Ejecuta:
   ```
   pbi-tools extract DashboardMaestro.pbix
   ```
4. Se creará una carpeta `DashboardMaestro` con esta estructura:
   ```
   DashboardMaestro/
   ├── Model/
   │   ├── model.tmdl          ← modelo tabular (tablas, medidas, relaciones)
   │   ├── tables/
   │   │   ├── Tabla madre.tmdl
   │   │   └── ...
   │   └── ...
   ├── Report/
   │   ├── report.json         ← configuración del report
   │   └── pages/
   │       └── Pagina1/
   │           ├── page.json   ← configuración de la página
   │           └── visuals/    ← cada visual en su propio archivo
   └── ...
   ```

> **ALTERNATIVA si pbi-tools no funciona:**
> Abre `DashboardMaestro.pbix` en Power BI Desktop → Archivo → Guardar como →
> selecciona formato **Power BI Project (.pbip)**. Esto genera la misma estructura
> editable, sin necesidad de pbi-tools para la extracción.

---

## PASO 2 — Abrir en Cursor

1. Abre Cursor IDE.
2. `File → Open Folder` → selecciona la carpeta `DashboardMaestro` extraída.
3. Explora la estructura para familiarizarte.

---

## PASO 3 — Inyectar las medidas DAX

### Opción A: Si la estructura es TMDL (pbi-tools v2+)

Abre el archivo `Model/tables/Tabla madre.tmdl` y añade al final todas las medidas
del archivo `MEDIDAS_DAX_ExecSummary.tmdl` que se adjunta.

El formato es:
```
measure 'Tabla madre'[Nº Proyectos] = COUNTROWS('Tabla madre')
    formatString: #,##0
```

### Opción B: Si la estructura es JSON (model.bim / database.json)

Busca el array `"measures"` dentro del objeto de `Tabla madre` en `model.bim` y añade
cada medida como un objeto JSON:
```json
{
  "name": "Nº Proyectos",
  "expression": "COUNTROWS('Tabla madre')",
  "formatString": "#,##0"
}
```

### Prompt para Cursor (medidas)

Pega esto en el chat de Cursor:

```
Abre el archivo del modelo tabular de esta carpeta pbi-tools / PBIP.
Busca la tabla 'Tabla madre'.
Añade las siguientes medidas DAX (si ya existen, reemplázalas).
Usa el archivo MEDIDAS_DAX_ExecSummary.tmdl como referencia para todas las fórmulas.
Son 25 medidas en total. Respeta los formatString exactos.
NO modifiques ninguna tabla, columna ni relación existente.
```

---

## PASO 4 — Importar el tema corporativo

1. Copia el archivo `ICAM_Theme_Executive.json` a la carpeta del proyecto.
2. **Después de recompilar**, en Power BI Desktop:
   Vista → Temas → Buscar temas → selecciona `ICAM_Theme_Executive.json`.

---

## PASO 5 — Construir la Página 1 (layout visual)

Este es el paso más importante. Usa el siguiente prompt en Cursor, adjuntando
también el archivo `ExecSummary_Layout.json` como referencia:

### Prompt completo para Cursor (layout)

```
Eres un especialista en Power BI Report JSON / PBIP layout.
Necesito que construyas la Página 1 "Executive Summary" del dashboard.

CONTEXTO:
- El modelo tiene una tabla principal llamada 'Tabla madre'
- Las medidas ya están creadas (ver MEDIDAS_DAX_ExecSummary.tmdl)
- El filtro crítico [Es Ultima Fila ] = 1 ya está en Power Query (28 proyectos)
- Formato apaisado 1280x720

ESTRUCTURA DE LA PÁGINA (de arriba a abajo):

### HEADER (Y: 0–50)
- Rectángulo azul marino (#1E2A56) ancho completo, alto 50px
- Texto "ICAM Real Estate Portfolio" en blanco, 14pt, Segoe UI Semibold
- Barra de navegación con 5 pestañas: 1·Exec | 2·Mapa | 3·Rentab | 4·Proyectos | 5·Tendencias
- Subrayado dorado (#B89660) de 3px bajo la pestaña "1·Exec"

### KPI CARDS (Y: 56–130)
5 tarjetas card equiespaciadas, cada una ~230x70px:
1. "Nº Proyectos"       → medida [Nº Proyectos]       — formato: entero
2. "Inversión Total"    → medida [Inversión Total]    — formato: M€
3. "GDV Total"          → medida [GDV Total]          — formato: M€
4. "Beneficio Agregado" → medida [Beneficio Total]    — formato: M€
5. "TIR Media Pond."    → medida [TIR Pond.]          — formato: %

Cada card: fondo blanco, borde #EAEBEE redondeado 6px, valor 28pt #1E2A56 Segoe UI Semibold,
título 8pt #8A8A8A debajo del valor. Sin visual header.
Debajo de cada card, un subtítulo en textbox 8pt #8A8A8A (ej: "X activos · Y culminados").

### SECCIÓN CENTRAL (Y: 140–330)
Dividida en 3 columnas:

**Columna izquierda (X: 16–430):**
Título: "Top 10 Proyectos por Inversión"
Visual: barChart horizontal
- Eje Y (categoría): 'Tabla madre'[Proyecto]
- Eje X (valor): medida [Inversión Total]
- TopN filter: Top 10 por [Inversión Total]
- Color barras: #1E2A56
- Labels: mostrar valores en M€
- Fondo blanco, borde redondeado

**Columna centro (X: 440–650):**
Título: "Distribución por Tipo"
Visual: donutChart
- Categoría: 'Tabla madre'[Tipo de Proyecto]
- Valor: [Inversión Total]
- Leyenda: derecha, 9pt
- Labels: categoría + % del total

**Columna derecha (X: 660–870):**
Título: "Distribución por Situación"
Visual: donutChart
- Categoría: 'Tabla madre'[Situacion]
- Valor: [Inversión Total]
- Leyenda: derecha, 9pt
- Labels: categoría + % del total

### DISTRIBUCIÓN INFERIOR IZQ (Y: 338–510, X: 16–430)
Bloque "Distribución del Portfolio" con 4 sub-secciones:
- Por Situación: "X activos | Y culminados" con barrita proporcional
- Por Tipo: los tipos principales con conteo
- TIR > 15%: "X de Y proyectos" con indicador visual
- Inversión media: valor en M€

### KPIs CONSOLIDADOS (Y: 338–510, X: 440–870)
Título: "KPIs Consolidados del Portfolio"
Tabla de 2 columnas (Portfolio | En Marcha | Culminado) con métricas:
- TIR Media Ponderada
- ROE Medio
- Múltiplo Medio
- Beneficio Medio
- Inversión Media
- Unidades Medias

Subtítulo: "28 proyectos · Solo fila representativa por proyecto"

### SLICERS (X: 880–1264)
2 segmentadores verticales en zona derecha:
1. Slicer "Situación" → 'Tabla madre'[Situacion], dropdown
2. Slicer "Tipo de Proyecto" → 'Tabla madre'[Tipo de Proyecto], dropdown

### FOOTER (Y: 696–720)
Rectángulo azul marino ancho completo, 24px alto
Texto "ICAM · Portfolio Inmobiliario · Dashboard Ejecutivo" centrado, blanco, 7pt

PALETA:
- Primary: #1E2A56 (azul marino)
- Accent: #B89660 (dorado)
- Background: #F5F5F5
- Cards: #FFFFFF
- Subtle: #EAEBEE
- Text primary: #1E2A56
- Text body: #2C2C2C
- Text muted: #8A8A8A

REGLAS:
- Página en formato 1280x720 (16:9 apaisado)
- Fondo de página: #F5F5F5
- Todos los visuales sin visual header (ocultar los 3 puntos)
- Bordes redondeados de 6px en cards y visuales
- Segoe UI como fuente principal, Segoe UI Semibold para títulos/valores
- No generes datos ficticios; todo debe apuntar a medidas reales del modelo
- Respeta los nombres exactos de columnas y medidas
```

---

## PASO 6 — Recompilar el .pbix

1. Guarda todos los archivos en Cursor.
2. En terminal, desde la carpeta padre (donde está `DashboardMaestro/`):
   ```
   pbi-tools compile DashboardMaestro
   ```
   Esto genera un nuevo `DashboardMaestro.pbix`.
3. Si usaste PBIP en lugar de pbi-tools, simplemente abre el `.pbip` en Power BI Desktop.

---

## PASO 7 — Verificar en Power BI Desktop

1. Abre el `.pbix` recompilado en Power BI Desktop.
2. **Checklist de validación:**

| Verificación | Esperado |
|---|---|
| Se abre sin error | ✅ |
| Página "Executive Summary" visible | ✅ |
| 5 KPI cards con valores | 28 / ~682M€ / ~880M€ / ~172M€ / ~14.6% |
| Top 10 barras visibles | 10 barras horizontales |
| 2 donuts con leyendas | Tipo + Situación |
| Slicers funcionales | Filtran todos los visuales |
| Tema aplicado | Colores corporativos |
| Nº Proyectos = 28 | Confirma filtro Es Ultima Fila |

3. **Aplicar tema** (si no se aplicó automáticamente):
   Vista → Temas → Buscar temas → `ICAM_Theme_Executive.json`

---

## PASO 8 — Ajustes finos

Una vez verificado el layout base:
- Ajusta posiciones y tamaños si algo no está perfectamente alineado
- Verifica que los subtítulos dinámicos se muestran correctamente
- Comprueba que los slicers filtran cross-filter a todos los visuales
- Revisa el formato de números (M€, %, x)

---

## Archivos adjuntos necesarios

Asegúrate de tener estos archivos en la misma carpeta:

1. `MEDIDAS_DAX_ExecSummary.tmdl` — Las 25 medidas DAX en formato TMDL
2. `ICAM_Theme_Executive.json` — Tema corporativo de Power BI
3. `DashboardMaestro.pbix` — El archivo original

---

## Troubleshooting

**pbi-tools no se instala:**
- Asegúrate de tener .NET SDK 8+ (`dotnet --version`)
- Intenta: `dotnet tool install -g pbi-tools --version 1.0.0-rc.7`

**pbi-tools extract falla:**
- Cierra Power BI Desktop antes de extraer
- Verifica que el .pbix no esté corrupto abriéndolo primero en PBI Desktop

**El .pbix recompilado no abre:**
- Revisa errores del `pbi-tools compile` en la terminal
- Verifica que no haya JSON malformado en los archivos de layout
- Haz backup del original antes de cada intento

**Alternativa PBIP:**
- Si pbi-tools no funciona, usa el flujo PBIP:
  1. Abre .pbix en Power BI Desktop
  2. Guardar como → Power BI Project (.pbip)
  3. Edita los archivos JSON/TMDL en Cursor
  4. Vuelve a abrir el .pbip en Power BI Desktop
