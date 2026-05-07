# Diccionario de campos · Executive Summary

Este documento define los **campos mínimos recomendados** para exportar el CSV que usará Cursor.

## Convención
- `campo_original_excel`: nombre tal como puede venir del Excel
- `alias_limpio_recomendado`: nombre recomendado para CSV / código
- `tipo`: tipo esperado
- `uso`: para qué se utiliza en la página 1

| campo_original_excel | alias_limpio_recomendado | tipo | uso |
|---|---|---:|---|
| Proyecto | Proyecto | string | nombre de proyecto |
| Situacion | Situacion | string | filtros, donut, conteos |
| Tipo de Proyecto | TipoProyecto | string | filtros, donut, conteos |
| Inversión total | InversionTotal | number | KPI, Top 10, medias, distribuciones |
| Total Ingresos por venta | TotalIngresosVenta | number | KPI GDV |
| Beneficios | Beneficios | number | KPI beneficio, márgenes |
| Unidades Totales | UnidadesTotales | number | distribución y medias |
| TIR desp. IS | TIRDespuesIS | number | TIR media, TIR ponderada, distribución |
| ROE desp. IS | ROEDespuesIS | number | KPIs consolidados |
| Múltiplo | Multiplo | number | KPIs consolidados |
| Project IRR | ProjectIRR | number | opcional en resumen consolidado |
| BCR | BCR | number | opcional en resumen consolidado |
| Ubicación | Ubicacion | string | no esencial en página 1, útil para tooltips |
| Fecha Inicio | FechaInicio | date/string | opcional |
| End Quarter | EndQuarter | date/string | opcional |
| Es Ultima Fila / Es Ultima Fila  | EsUltimaFila | number/boolean | filtro crítico |

## Campos derivados recomendados en código
Cursor puede derivar estas métricas o agrupaciones:

| campo_derivado | tipo | fórmula / lógica |
|---|---:|---|
| EsActivo | boolean | `Situacion === "En Marcha"` |
| EsCulminado | boolean | `Situacion === "Culminado"` |
| TieneDatosFinancieros | boolean | `InversionTotal > 0` |
| TIRValida | boolean | `TIRDespuesIS > 0` |
| ROEValido | boolean | `ROEDespuesIS > 0` |
| MultiploValido | boolean | `Multiplo > 0` |
| BeneficioSobreInversion | number | `Beneficios / InversionTotal` |

## Recomendación de headers del CSV limpio
Usar exactamente estos nombres en `01_tabla_madre_filtrada_clean_headers.csv`:

```csv
Proyecto,Situacion,TipoProyecto,InversionTotal,TotalIngresosVenta,Beneficios,UnidadesTotales,TIRDespuesIS,ROEDespuesIS,Multiplo,ProjectIRR,BCR,Ubicacion,FechaInicio,EndQuarter,EsUltimaFila
```

## Observaciones importantes
- Si en el Excel real hay espacios finales o caracteres extraños en cabeceras, limpiarlos antes de exportar.
- Mantener una sola fila por proyecto.
- Validar que el CSV final contiene solo proyectos con `EsUltimaFila = 1`.
- Si un campo no existe exactamente con este nombre, mapearlo en el proceso de exportación o normalización.
