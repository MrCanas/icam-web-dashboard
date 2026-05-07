# Contexto funcional y visual · Executive Summary

## Objetivo funcional
Construir una web que replique la **página 1 — Executive Summary** del dashboard de portfolio inmobiliario de ICAM Asset Manager.

## Alcance exacto
La página debe incluir como mínimo:

1. **KPI Cards**
   - Nº Proyectos
   - Inversión Total
   - GDV Total
   - Beneficio Agregado
   - TIR Media Ponderada

2. **Visual principal**
   - Top 10 proyectos por inversión real

3. **Visuales de distribución**
   - Donut por Tipo de Proyecto
   - Donut por Situación

4. **Bloques de resumen**
   - Distribución del portfolio
   - KPIs consolidados del portfolio

5. **Filtros / segmentadores**
   - Situación
   - Tipo de Proyecto

## Regla crítica de negocio
Todo debe calcularse con una única fila representativa por proyecto:

- usar solo registros con `EsUltimaFila = 1`
- excluir filas históricas trimestrales

## Métricas esperadas en el dataset actual
Estas cifras son de referencia para validación del dataset actual. **No deben hardcodearse** en la interfaz.

- Proyectos en cartera: 28
- Proyectos activos: 11
- Proyectos culminados: 17
- Inversión total: ~682M€
- GDV total: ~880M€
- Beneficio agregado: ~172M€
- TIR media ponderada: ~14.6%
- Múltiplo medio: ~1.51x

## Distribuciones esperadas en el dataset actual
- Tipo de proyecto:
  - Promoción: 24
  - Fondo: 4
- Situación:
  - En Marcha: 11
  - Culminado: 17

## Jerarquía visual esperada
### Franja superior
- marca / título del dashboard
- navegación de pestañas o tabs simuladas
- metadata de confidencialidad / fecha / fuente

### Fila principal de KPIs
Cinco cards destacadas con gran jerarquía numérica:
- Nº Proyectos
- Inversión Total
- GDV Total
- Beneficio Agregado
- TIR Media Ponderada

### Zona media izquierda
- gráfico horizontal de Top 10 proyectos por inversión

### Zona media derecha
- donut por Tipo
- donut por Situación

### Zona inferior
- bloque de distribución del portfolio
- tabla o bloque compacto de KPIs consolidados del portfolio

## Estilo visual corporativo
### Paleta
- `primary-900`: `#1E2A56`
- `primary-800`: `#2B3668`
- `accent-gold`: `#B89660`
- `accent-gold-hover`: `#A0824F`
- `bg-page`: `#F5F5F5`
- `bg-card`: `#FFFFFF`
- `bg-subtle`: `#EAEBEE`
- `text-primary`: `#1E2A56`
- `text-body`: `#2C2C2C`
- `text-muted`: `#8A8A8A`

### Reglas visuales
- fondo general claro: `#F5F5F5`
- tarjetas y contenedores principales en blanco
- uso del dorado solo como acento
- títulos en azul marino
- labels y notas en gris muted
- layout limpio, premium, ejecutivo y corporativo
- densidad visual controlada, sin ruido
- estética cercana a comité / board reporting

## Reglas de formato numérico
- importes grandes en M€
- porcentajes con 1 decimal
- múltiplos en formato `1.51x`
- enteros con separador de miles
- evitar decimales innecesarios

## Reglas de implementación web
- no usar cifras fijas del PDF para pintar la UI
- calcular dinámicamente desde el CSV
- encapsular cálculos en utilidades reutilizables
- separar datos, componentes y estilos
- priorizar legibilidad y rapidez de lectura
