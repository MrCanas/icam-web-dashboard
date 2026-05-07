# Prompt de contexto para Cursor — Archivos de referencia

Copia el bloque de abajo y pégalo en Cursor como mensaje previo o junto al prompt principal.

---

```text
En este proyecto tienes varios archivos de apoyo que he preparado. Antes de escribir código, léelos para entender el contexto. Aquí te explico cada uno y para qué sirve:

## Archivos de referencia visual y funcional

### `references/ICAM_Dashboard_final (1).pdf`
PDF de 7 páginas con el dashboard OBJETIVO. Es la referencia visual principal.
- Página 1 = Executive Summary (la que vamos a construir primero)
- Páginas 2-5 = las otras vistas del dashboard (para más adelante)
- ÚSALO PARA: layout, composición, jerarquía visual, disposición de elementos, look & feel
- NO COPIES cifras del PDF al código; los números son para validación, no para hardcodear

### `references/ICAM_Guia_PowerBI_v2.docx`
Documento normativo con la lógica de negocio, las métricas y las reglas de datos.
- Define qué columnas existen y cómo se llaman
- Define las fórmulas DAX (que tú traducirás a TypeScript)
- Define la REGLA CRÍTICA: usar solo filas con `Es Ultima Fila = 1`
- ÚSALO PARA: lógica de cálculo, nombres de campos, reglas de filtrado, definición de KPIs

**Si hay conflicto entre el PDF y la guía:** prioriza la guía para lógica de negocio, prioriza el PDF para estética.

## Archivos de documentación preparados para ti

### `docs/01_contexto_exec_summary.md`
Contexto funcional y visual de la página Executive Summary: qué debe incluir, qué métricas, qué jerarquía visual, la paleta de colores y las reglas de formato numérico.
→ LÉELO PRIMERO, es el resumen ejecutivo del proyecto.

### `docs/02_diccionario_campos_exec_summary.md`
Diccionario de datos: mapea los nombres de columna del Excel/CSV a aliases limpios, define tipos de dato y explica para qué se usa cada campo. También lista campos derivados que debes calcular en código.
→ LÉELO para saber qué campos esperar del CSV y cómo nombrarlos en TypeScript.

### `docs/03_validacion_exec_summary.md`
Checklist de validación con los valores esperados del dataset actual. Incluye validación de datos, composición de página, estilo visual, formato numérico y comportamiento.
→ ÚSALO al final para verificar que todo cuadra.

### `docs/04_prompt_cursor_exec_summary_web.md`
Prompt original pensado para una versión web con CSV estático. Tiene buenas ideas de componentes y estructura pero el stack ha cambiado: ahora usamos Next.js + Supabase en lugar de CSV estático. Tómalo como referencia de arquitectura de componentes, no como instrucción literal.

## Archivo de datos

### `data/01_tabla_madre_filtrada_clean_headers.csv`
CSV con los 28 proyectos del portfolio (solo filas representativas, ya filtrado por EsUltimaFila = 1).
- Cabeceras: Proyecto, Situacion, TipoProyecto, InversionTotal, TotalIngresosVenta, Beneficios, UnidadesTotales, TIRDespuesIS, ROEDespuesIS, Multiplo, ProjectIRR, BCR, Ubicacion, EsUltimaFila
- ÚSALO PARA: generar el seed SQL de Supabase y como fuente de verdad para validar los KPIs
- Los valores numéricos de TIR, ROE, Múltiplo están en decimal (0.1226 = 12,26%)

## Archivos de soporte Power BI (referencia secundaria)

### `ICAM_Theme_Executive.json`
Tema de Power BI con la paleta corporativa. No lo usarás directamente en la web, pero contiene la definición canónica de colores, estilos de texto y configuración visual.
→ Referencia si necesitas confirmar un color o estilo.

### `MEDIDAS_DAX_ExecSummary.tmdl`
Las 25 medidas DAX en formato TMDL. No las ejecutarás, pero te sirven como especificación exacta de cada cálculo que debes replicar en TypeScript.
→ Consulta cuando implementes `lib/calculations.ts` para asegurarte de que la lógica coincide.

### `CURSOR_INSTRUCCIONES.md`
Instrucciones antiguas para un flujo con pbi-tools. Ya no aplican. Ignóralo.

## Resumen de prioridades de lectura

1. `docs/01_contexto_exec_summary.md` ← léelo primero
2. `docs/02_diccionario_campos_exec_summary.md` ← para el schema de datos
3. `data/01_tabla_madre_filtrada_clean_headers.csv` ← para el seed SQL
4. `references/ICAM_Dashboard_final (1).pdf` ← para el diseño visual
5. `references/ICAM_Guia_PowerBI_v2.docx` ← para lógica de negocio
6. `MEDIDAS_DAX_ExecSummary.tmdl` ← para replicar cálculos en TS
7. `docs/03_validacion_exec_summary.md` ← para verificar al final
```
