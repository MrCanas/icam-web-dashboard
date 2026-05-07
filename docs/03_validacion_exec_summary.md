# Validación funcional y visual · Executive Summary

## Objetivo
Este documento sirve para validar que la página web construida por Cursor reproduce correctamente la página 1 del dashboard de referencia.

## 1. Validación de datos

### 1.1 Regla crítica
- [ ] El dataset usado por la web contiene solo registros con `EsUltimaFila = 1`
- [ ] No se están usando filas históricas trimestrales duplicadas
- [ ] Existe una sola fila representativa por proyecto

### 1.2 Conteos esperados del dataset actual
Estas cifras son esperadas **solo como validación del dataset actual**:

- [ ] Nº proyectos = 28
- [ ] Proyectos activos = 11
- [ ] Proyectos culminados = 17
- [ ] Tipo Promoción = 24
- [ ] Tipo Fondo = 4

### 1.3 KPIs esperados del dataset actual
Tolerancia razonable: pequeñas diferencias por redondeo o formato.

- [ ] Inversión total ≈ 682M€
- [ ] GDV total ≈ 880M€
- [ ] Beneficio agregado ≈ 172M€
- [ ] TIR media ponderada ≈ 14.6%
- [ ] Múltiplo medio ≈ 1.51x

## 2. Validación de composición de página

### 2.1 Estructura
- [ ] Existe cabecera / header de página
- [ ] Existen 5 KPI cards principales
- [ ] Existe un gráfico Top 10 proyectos por inversión
- [ ] Existe donut por Tipo de Proyecto
- [ ] Existe donut por Situación
- [ ] Existe un bloque de Distribución del portfolio
- [ ] Existe un bloque de KPIs consolidados del portfolio
- [ ] Existen filtros de Situación y Tipo de Proyecto

### 2.2 Orden visual
- [ ] Los KPIs principales tienen máxima jerarquía
- [ ] El Top 10 es el visual más importante después de los KPIs
- [ ] Los donuts quedan agrupados y visualmente equilibrados
- [ ] Los bloques inferiores son compactos, legibles y ejecutivos

## 3. Validación visual

### 3.1 Paleta
- [ ] Azul marino principal: `#1E2A56`
- [ ] Azul secundario: `#2B3668`
- [ ] Dorado de acento: `#B89660`
- [ ] Fondo página: `#F5F5F5`
- [ ] Fondo cards: `#FFFFFF`
- [ ] Fondo sutil: `#EAEBEE`
- [ ] Texto primario: `#1E2A56`
- [ ] Texto muted: `#8A8A8A`

### 3.2 Sensación de producto
- [ ] La página se siente premium y corporativa
- [ ] No parece una demo genérica
- [ ] No hay saturación visual
- [ ] La lectura es rápida para comité
- [ ] Hay consistencia entre cards, gráficos y tablas

## 4. Validación de formato
- [ ] Importes mostrados en M€
- [ ] Porcentajes con 1 decimal cuando procede
- [ ] Múltiplos con sufijo `x`
- [ ] Enteros con separador de miles
- [ ] No hay decimales superfluos

## 5. Validación de comportamiento
- [ ] Los filtros afectan a todos los visuales relevantes
- [ ] No se rompe el layout con textos largos
- [ ] Los tooltips son útiles y discretos
- [ ] La página funciona bien en escritorio

## 6. Anti-patrones a evitar
- [ ] No hay cifras hardcodeadas del PDF en componentes
- [ ] No hay colores chillones fuera de la paleta
- [ ] No se mezclan estilos de librerías incompatibles
- [ ] No se usa un dark theme si la referencia es clara
- [ ] No se cargan todos los datos sin filtro crítico
