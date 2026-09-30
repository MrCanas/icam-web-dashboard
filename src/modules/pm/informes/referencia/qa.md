# QA antes de publicar cada versión

`scripts/qa.py` (lo ejecuta `construir.py`) cubre lo mecánico: estructura, `[pendiente]`, límites por layout,
trimestre anterior citado fuera de Antecedentes, fechas `MM/AA`, fotos vacías. Además, **tú** revisas:

## Coherencia entre slides (spec §41.3)
Construye una tabla mental de los datos clave y comprueba que coinciden en todos los slides donde aparecen:
- % avance de obra: KPI ↔ Resumen ejecutivo ↔ Obra ↔ Calendario.
- Fechas de fin de obra, CFO, LPO, entrega, desinversión: Resumen ejecutivo ↔ Hitos reseñables ↔ Timeline ↔ KPIs ↔ Vehículo.
- % BREEAM: KPI ↔ Sostenibilidad ↔ Resumen ejecutivo.
- Operador, constructora, financiador: mismo nombre oficial en todo el informe.
- Estado de licencia ↔ timeline (`hecho`).
- Timeline: los hitos con fecha ≤ cierre del trimestre y cumplidos → `hecho: true`; los futuros → `false`.

## Periodo (§41.2)
- Ningún «Q-1» como si fuera actual; títulos con el trimestre correcto; «Objetivos Q+1» en el slide de KPIs.
- Frases heredadas en futuro que ya han ocurrido.
- Ficha «Siguiente informe trimestral» del vehículo actualizada.

## Contenido caducado (§41.4)
Compara cada slide `actualizada`/`heredada` con el informe anterior: texto casi idéntico con fechas o verbos
de periodo («durante el trimestre») → reescribir o confirmar con el usuario.

## Lenguaje (§41.7)
Erratas, frases duplicadas, repeticiones de fórmula, nombres del proyecto inconsistentes, abreviaturas sin explicar
la primera vez (CFO, LPO, DR, FF&E).

## Salida
Resume al usuario en tres grupos: **Bloqueantes** (impiden la versión final), **Avisos**, **Recomendaciones**,
cada uno con el nº de slide. Nunca corrijas en silencio un dato material: pregunta.
