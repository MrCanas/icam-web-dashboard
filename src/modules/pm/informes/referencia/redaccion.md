# Redacción: tono, herencia entre trimestres y reglas de hechos

## Regla de oro: nada se inventa

Todo dato material (fecha, %, importe, empresa, licencia, hito, nº de inversores, puntuación) debe salir de:
el informe anterior, lo que aporta el usuario este trimestre (notas, correos, actas, documentos, Excel) o
los datos del vehículo. Cada dato nuevo se anota en `hechos.json` con su fuente.

- Falta un dato que el slide necesita → `[pendiente: qué falta]` en el texto y se lista en el resumen al usuario.
- Dos fuentes se contradicen → no elijas: pregunta y muestra ambas versiones.
- Puedes **interpretar y redactar** libremente: sintetizar, priorizar, explicar por qué importa un hito, proponer riesgos
  y objetivos. Todo lo que propongas sin respaldo directo (riesgos u objetivos sugeridos) se marca en la propuesta
  como «sugerido» y el usuario lo confirma.
- Las cifras financieras (TIR, ROE, varianzas, NOI…) nunca se calculan ni se redactan: son slides bloqueados de Finanzas.
- Fotos: solo las que aporta el usuario (o las del informe anterior si él lo confirma). Un pie de foto describe solo lo confirmado.

## Tiempo

Distingue siempre: hecho histórico · hecho del trimestre anterior · hecho de este trimestre · previsión.
- Nunca presentes una previsión como cumplida ni un hecho de Q-1 como logro de Q.
- Frases heredadas con «próximo trimestre», «previsto para…», «se iniciará…»: revisa si ya ocurrió; reescribe en pasado o actualiza la fecha.
- Usa el trimestre explícito («Q4 2026»), no «el próximo trimestre».

## Herencia desde el informe anterior (spec §69)

| Tipo | Ejemplos | Qué hacer |
|---|---|---|
| Persistente | estrategia, descripción del activo, compraventa, financiación, colaboradores, datos del vehículo | Se copia tal cual salvo cambio aportado. `origen: heredada`. |
| Del trimestre | «Durante el trimestre…», Novedades, logros | Solo como contexto: Novedades Q-1 → se resume en **Antecedentes Q** (≤ 400). Nunca se reutiliza como texto actual. |
| Estructurado | KPIs, hitos, riesgos, objetivos | Se arrastran los objetos y se actualizan: KPI con valor nuevo; hitos marcados como hechos o con fecha movida; riesgos activos/resueltos; objetivos Q-1 → estado. |
| Legal | disclaimer, pie | Texto vigente del design system; datos del vehículo del informe anterior. |
| Bloqueado | financiero, varianzas | Placeholder `SlideBloqueado` «Pendiente de Finanzas» hasta que llegue la página. |

Módulo sin cambios: conserva lo persistente; si el slide necesita una frase del periodo, «No se han producido cambios materiales en este ámbito durante el trimestre.» (no la pongas en todos lados; a menudo es mejor ocultar el slide).

## Bucle de objetivos

Los «Objetivos Qn» del informe anterior son el guion de este trimestre. Para cada uno infiere de las notas:
Cumplido · Parcial · No cumplido · Ya no aplica, con la evidencia. Los cumplidos alimentan Logros; los no cumplidos,
riesgos o retrasos (con su explicación) y, si siguen vigentes, los nuevos objetivos Q+1.

## Tono (spec §66)

Español institucional, factual y sobrio. Sin adjetivos promocionales, sin exclamaciones, sin emojis.
Fórmulas habituales, sin repetirlas mecánicamente: «Durante el trimestre…», «Se ha avanzado…», «Se mantiene…»,
«En paralelo…», «Asimismo…», «El foco continúa en…», «Se prevé…», «Se ha iniciado…», «Se ha formalizado…».
Evita relleno corporativo («se sigue trabajando para…») y afirmaciones positivas sin dato.

## Resumen ejecutivo (spec §67) — se escribe al final

Jerarquía: 1) fase actual; 2) logro(s) más material(es); 3) retrasos o incidencias relevantes y su mitigación;
4) avance hacia el siguiente gran hito; 5) operador / comercialización / desinversión; 6) próximas fechas críticas.
No concatenes módulos. Coherente al dígito con KPIs y calendario.

## Logros (spec §68)

Hechos concretos y, si hay fecha, fechados. 6 recomendados, 9 máximo. El usuario puede fijar uno.
- Bien: «Obtención de la licencia de obras el 8 de junio de 2026.»
- Mal: «Se continuó trabajando en el proyecto durante el trimestre.»

## Espacio: cada slide llena, sin tocar la letra

- Objetivo: **relleno ≥ 85 %** del área de contenido de cada slide (lo mide `construir.py`). Nunca se reduce el cuerpo de letra
  ni se cambian estilos: el tamaño es el del design system.
- Primero se llena con **información real**: el texto completo del informe anterior cuando sigue vigente (no lo resumas de
  más), las notas y documentos del trimestre, las condiciones y datos concretos (importes, fechas, nombres, pólizas,
  expedientes). Prefiere el detalle útil al resumen genérico.
- Si no hay más información real: 1) agranda fotos o usa una disposición mayor; 2) fusiona dos slides cortas del mismo
  ámbito; 3) cambia a un layout más compacto; 4) mueve un bloque de una slide llena a una vacía del mismo tema.
- Nunca rellenes con frases vacías («se sigue trabajando…») ni repitas datos de otra slide solo para ocupar.
- El visor reparte automáticamente el hueco restante entre las partes de la slide (entre bloques, párrafos y filas de
  tabla). Un subtítulo, o una frase que termina en «:», va siempre pegada a lo que introduce.
- Desborde (el texto no cabe): resume lo menos relevante o parte el slide; es bloqueante.

## Formatos

- Trimestres «Q3 2026». Cifras españolas: `12.000.000 €`, `76 %`, `1.907 m²`. Fechas del timeline `MM/AA`.
- Negrita solo para el dato clave de la frase. Viñetas con rótulo: «**Inicio de obra**: enero de 2026».
- Nombres oficiales tal cual (operadores, marcas, organismos, constructoras). Mismo nombre en todo el informe.
- Notas: «**Nota:** …».
- Archivo: `YYYYMMDD_{PROYECTO}_Qn AAAA_Informe Trimestral Inversores.pdf` (fecha = cierre del trimestre).
