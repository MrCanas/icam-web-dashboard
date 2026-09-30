# Piloto · Informes trimestrales en el portal

Objetivo: que una PM genere de principio a fin el informe **SE84 · Q3 2026** desde el portal, con las actas y la planificación cargadas solas, y medir el coste real antes de abrirlo al resto de proyectos.

## Antes de empezar (una vez)

1. **Migración 043**
   - `npm run pm:apply-migration-043`: simulación, aplica y revierte.
   - `npm run pm:apply-migration-043 -- --apply`
   - Necesita `DATABASE_POOLER_URL` en `.env.local` (la conexión directa de Supabase es solo IPv6).
2. **API key de Anthropic**
   - Crear la key en console.anthropic.com → API Keys.
   - En la misma consola, fijar un **límite de gasto mensual** (50 $ sobran para el piloto).
   - Guardarla como `ANTHROPIC_API_KEY` en `.env.local` y en Vercel (Production y Preview).
   - No sirve la suscripción Pro/Max de nadie: es de uso personal.
3. **Informes anteriores**
   - `python app-equipo/exportar_para_portal.py` en el repo del motor de informes.
   - `npm run pm:importar-informes -- --origen "<…>/migracion-portal/paquete"` (simulación), y después con `--apply`.
   - Deja SE84 Q2 2026 como «informe anterior» estructurado del Q3.
4. **Permisos:** la PM del piloto necesita rol **editor** en la zona Proyectos (`npm run auth:grant` o desde Administración → Usuarios).

## Recorrido de la PM

1. Proyectos → SE84 → pestaña **Informe trimestral** → «Nuevo informe».
   - Comprobar que SE84 sale ya elegido.
   - Trimestres: Q2 2026 → Q3 2026.
2. **Paso 1:** debe decir que usa el informe Q2 2026 guardado (22 slides) sin pedir nada.
3. **Paso 2:** deben aparecer, marcados «del portal»:
   - «Actas Q3 2026 · SE84»: unas 50 anotaciones del 01/07 al 30/09.
   - «Planificación y avance Q3 2026 · SE84»: 15 hitos, comparados con la foto de Q1 2026 porque no hay snapshot de Q2.
   - La PM añade notas propias, las páginas de Finanzas y las fotos del trimestre.
4. **Analizar → Paso 3:** revisar el resumen, los objetivos de Q2 y la estructura propuesta; GO.
5. **Generación:** 15–25 minutos con la pestaña abierta. Al terminar se abre el editor.
6. **Editor:**
   - Hacer al menos una corrección con «Marcar» y otra con un adjunto.
   - «Revisar coherencia».
   - Exportar el PDF.
7. **Permisos:** con un usuario **lector** de Proyectos, la misma pantalla deja consultar, pero no generar ni subir fotos. `/api/informes/claude` le devuelve 403.

## Qué medir

- `npm run pm:informes-uso` da el coste por informe y por tipo de petición, la mediana de duración y el porcentaje de caché.
  - Coste esperado: 1,5–3 $ por informe completo con Opus 5.5 y effort `high`.
  - Caché: a partir de la segunda petición de slide, la parte estable (~6 000 tokens) debe leerse de caché. Si el porcentaje sale ~0, algo cambia el prefijo entre peticiones.
  - Peticiones cortadas (`max_tokens`) o rechazadas (`refusal`): deberían ser 0.
- **Calidad**, comparando con el informe Q3 que se habría hecho a mano:
  - ¿Los hitos y retrasos coinciden con la planificación?
  - ¿Se usan las actas para logros e incidencias?
  - ¿Cuántos `[pendiente]` quedan?
  - ¿Cuántas correcciones hicieron falta?
- **Tiempo:** el total de la PM, desde «Nuevo informe» hasta el PDF.

## Palancas si algo no convence

| Síntoma | Ajuste |
|---|---|
| Caro y la calidad sobra | `INFORMES_CLAUDE_EFFORT=medium` (Vercel) y repetir un informe |
| Las actas de un proyecto grande se recortan | Subir `MAX_CARACTERES_ACTAS` en `logic/fuentes-actas.ts` o filtrar categorías |
| Timeouts en Vercel (>300 s) | Mirar la mediana de duración por tipo en `pm:informes-uso`; bajar el effort de ese tipo de petición |
| La PM no ve la pestaña | Revisar la denegación de la ruta `pm.informes` en Administración → Usuarios |
