# README · Archivos de apoyo para Cursor

Estos archivos están preparados para ayudar a Cursor a construir la **versión web** del dashboard **ICAM Asset Manager · Executive Summary**.

## Objetivo
Construir **solo la página 1 — Executive Summary** en una web moderna, preferiblemente con **React / Next.js**, replicando lo máximo posible el dashboard de referencia sin hardcodear cifras.

## Fuentes de verdad
1. `ICAM_Guia_PowerBI_v2.docx` → lógica de negocio, métricas, estructura y regla crítica de filtrado.
2. `ICAM_Dashboard_final (1).pdf` → referencia visual, layout, jerarquía y composición.
3. `data/01_tabla_madre_filtrada_clean_headers.csv` → datos reales a renderizar en la web.

## Regla crítica que Cursor debe respetar
La web debe calcular todo el portfolio **solo** con las filas donde:

- `EsUltimaFila = 1`

Nunca debe sumar ni contar todas las filas históricas trimestrales de un mismo proyecto.

## Archivos incluidos
- `01_contexto_exec_summary.md`
- `02_diccionario_campos_exec_summary.md`
- `03_validacion_exec_summary.md`
- `04_prompt_cursor_exec_summary_web.md`

## Archivo de datos esperado
Debes colocar en la carpeta `data/` un CSV llamado:

- `01_tabla_madre_filtrada_clean_headers.csv`

## Estructura sugerida
```text
/project
  /data
    01_tabla_madre_filtrada_clean_headers.csv
  /references
    ICAM_Guia_PowerBI_v2.docx
    ICAM_Dashboard_final (1).pdf
  /cursor_docs
    00_README_uso_en_cursor.md
    01_contexto_exec_summary.md
    02_diccionario_campos_exec_summary.md
    03_validacion_exec_summary.md
    04_prompt_cursor_exec_summary_web.md
```

## Qué debería hacer Cursor
- leer el CSV limpio
- calcular KPIs y agregados en frontend o en capa de utilidades
- construir una página ejecutiva responsive con estética premium
- replicar la página 1 del PDF
- no usar Power BI ni depender del `.pbix`
- no hardcodear cifras del PDF en el UI

## Stack recomendado
- Next.js
- React
- TypeScript
- Tailwind CSS
- Recharts para gráficos

## Nota importante
Los valores numéricos mostrados en el PDF y en la guía sirven como **validación** del dataset actual, pero la app debe calcularlos dinámicamente desde el CSV.
