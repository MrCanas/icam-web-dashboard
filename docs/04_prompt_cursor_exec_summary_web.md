# Prompt para Cursor · Construcción web del Executive Summary

Usa este prompt directamente en Cursor:

```text
Quiero que construyas una **web** en React / Next.js que replique la **página 1 — Executive Summary** del dashboard de ICAM Asset Manager.

CONTEXTO
Tienes disponibles estos archivos de referencia:
- `references/ICAM_Guia_PowerBI_v2.docx`
- `references/ICAM_Dashboard_final (1).pdf`
- `data/01_tabla_madre_filtrada_clean_headers.csv`
- `cursor_docs/01_contexto_exec_summary.md`
- `cursor_docs/02_diccionario_campos_exec_summary.md`
- `cursor_docs/03_validacion_exec_summary.md`

OBJETIVO
Construir solo la página `Executive Summary` con una estética premium, corporativa y muy cercana al PDF, pero calculando todo dinámicamente desde el CSV.

REGLA CRÍTICA
Debes usar solo filas representativas del portfolio:
- filtrar `EsUltimaFila = 1`
- no sumar ni contar filas históricas trimestrales duplicadas

ALCANCE
La página debe incluir:
1. 5 KPI cards
   - Nº Proyectos
   - Inversión Total
   - GDV Total
   - Beneficio Agregado
   - TIR Media Ponderada

2. Un gráfico principal:
   - Top 10 proyectos por inversión

3. Dos donuts:
   - distribución por Tipo de Proyecto
   - distribución por Situación

4. Dos bloques inferiores:
   - Distribución del portfolio
   - KPIs consolidados del portfolio

5. Filtros visibles:
   - Situación
   - Tipo de Proyecto

STACK DESEADO
- Next.js
- React
- TypeScript
- Tailwind CSS
- Recharts

PALETA CORPORATIVA
- primary-900: #1E2A56
- primary-800: #2B3668
- accent-gold: #B89660
- accent-gold-hover: #A0824F
- bg-page: #F5F5F5
- bg-card: #FFFFFF
- bg-subtle: #EAEBEE
- text-primary: #1E2A56
- text-body: #2C2C2C
- text-muted: #8A8A8A

REGLAS VISUALES
- fondo general claro
- cards blancas con borde sutil o sombra suave
- uso del dorado solo para acentos
- títulos en azul marino
- labels en gris muted
- layout ejecutivo, limpio, aireado y elegante
- parecido máximo con el PDF, sin copiar cifras manualmente

FORMATO DE DATOS
- importes en M€
- porcentajes con 1 decimal
- múltiplos en formato `x`
- miles con separador

QUÉ QUIERO QUE HAGAS
1. Lee el CSV y crea una capa de transformación / utilidades para calcular:
   - número de proyectos
   - activos
   - culminados
   - inversión total
   - GDV total
   - beneficio agregado
   - TIR media ponderada
   - unidades totales
   - TIR media
   - ROE medio
   - múltiplo medio
   - top 10 por inversión
   - conteo por tipo
   - conteo por situación

2. Crea una página con componentes reutilizables:
   - Header
   - KPICard
   - HorizontalBarChart
   - DonutChart
   - SummaryStatList
   - FilterBar

3. Implementa una composición muy parecida a la del Executive Summary del PDF.

4. No hardcodees números del PDF.

5. Si hay valores nulos o faltantes, manéjalos con seguridad.

6. Deja el código ordenado y listo para seguir con el resto de páginas más adelante.

ENTREGABLES QUE QUIERO DE TI
- estructura de archivos propuesta
- componentes creados
- utilidades de cálculo
- página montada
- estilos aplicados
- breve nota final explicando cómo ejecutar el proyecto

REGLAS
- no me des teoría
- empieza a implementar
- si falta algún dato del CSV, usa fallback seguro y documenta la suposición
- prioriza legibilidad, elegancia y fidelidad visual
```
