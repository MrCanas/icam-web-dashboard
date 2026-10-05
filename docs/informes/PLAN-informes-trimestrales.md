# Informes trimestrales para inversores · Plan de construcción en icam web dashboard

## 0. Contexto y decisiones
- **Qué es:** la herramienta de informes trimestrales para inversores (hoy un artifact de claude.ai y un skill de Claude Code en `ImparOS-InformesTrimestrales`) pasa a ser un módulo **nativo en React** del dashboard, `src/modules/pm/informes`. No hay iframe ni shim: un solo código en un solo repo.
- **Entradas automáticas:** las **actas** del trimestre y la **planificación** (hitos, desviaciones y avance de obra) del propio dashboard.
- **Quién lo usa:** las project managers generan, corrigen y exportan el informe desde el portal.
- **Claude:** API de Anthropic con `ANTHROPIC_API_KEY`, pago por uso. No sirve ninguna suscripción personal.
  - Modelo `claude-opus-5-5`, `effort: high`.
  - Coste estimado: 1,5–3 $ por informe.
- **Punto de partida:** se construye desde `main`. La PR #52 (iframe + shim) se cierra.
  - Su rama `feature/informes-trimestrales` queda como **referencia**: tiene la lógica de actas y planificación, la llamada a Claude y el registro de costes, ya probados contra datos reales. Se puede consultar, no se mergea.
- **Qué se retira:** el artifact de claude.ai y la carpeta `ImparOS-InformesTrimestrales`, cuando sus datos estén importados (fase 7).
- **Qué no cambia:** las slides y el PDF para inversores mantienen el design system de Impar (Baskervville, Lato, navy `#1c2e69`, dorado `#9b7f57`). La herramienta, en cambio, usa el look del dashboard.

## 1. Qué se trae del proyecto de informes (merge)
Origen: `C:\Users\Javier Canas\OneDrive - Impar Capital\Documentos\ImparOS-InformesTrimestrales` (se abrevia `ORIG`).

| Origen | Qué es | Destino en el dashboard |
|---|---|---|
| `ORIG/design-system/project/components/bundle.js` | 39 componentes de slide, escritos a mano con `React.createElement`, más `rt()` (`**negrita**`), `textoPie()` y `assets` | `src/modules/pm/informes/slides/components/*.tsx`: port 1:1 a TSX con props tipadas |
| `ORIG/design-system/project/components/bundle.css` | CSS `iq-*`, lienzo absoluto de 960×540 | `src/modules/pm/informes/slides/slides.css`, importado solo desde las páginas de informes |
| `ORIG/design-system/project/tokens.json` | Tokens de slide (navy, gold, pearl, ink…) | Variables CSS al principio de `slides.css` |
| `ORIG/design-system/project/components/index.d.ts` | API de componentes que se envía a Claude | `src/modules/pm/informes/referencia/api-componentes.d.ts.txt`. Se regenera desde los tipos TSX con un test que falla si divergen |
| `ORIG/design-system/uploads/*.png` (24) | Logos e iconos de KPI, vehículo, desinversión y mosaico de cierre | `public/informes/ds/` |
| `ORIG/.claude/skills/informe-trimestral/templates/motor.js` | `elemento()` (JSON → React), `pintar()`, `airear()` (mide y reparte el hueco; devuelve ocupación, relleno y desborde) y `marcarPendientes()` | `src/modules/pm/informes/slides/motor.ts`: cliente, TS, misma lógica |
| `ORIG/.claude/skills/informe-trimestral/reference/{layouts,redaccion,biblioteca,arquetipos,qa}.md` | Catálogo de layouts, reglas de redacción, biblioteca de 39 slides, arquetipos A–E y reglas de QA | `src/modules/pm/informes/referencia/*.md`, leídos **en servidor** para montar los prompts; la biblioteca se parsea a JSON como hacía `construir_app.py:biblioteca()` |
| `ORIG/app-equipo/src/app.html` | Especificación funcional: flujo, prompts, validación, QA, marcas y PDF | **No se copia.** Se porta por funciones (ver §4) |
| `ORIG/.claude/skills/informe-trimestral/` | Skill de Claude Code | `.claude/skills/informe-trimestral/` del dashboard, reescrito para trabajar contra el módulo (opcional, fase 7) |
| `ORIG/IMPAR_OS_Quarterly_Reporting_Master_Spec (1).md` | Especificación de producto | `docs/informes/referencia/` |
| `ORIG/informes/*/*/informe.json` + `fotos/`, `ORIG/migracion-portal/artifact-db/` | Informes ya hechos (SE84 Q2 2026, SA31-33 Q2 2026, PC25 Q3 2026, CSP10…) | **No se commitean** (son confidenciales). Se cargan con el script de importación (fase 7) |

## 2. Arquitectura
Se sigue `ARCHITECTURE.md`: `data/ · logic/ · ui/ · actions/`, `ctx: UserContext` como primer parámetro y `withAudit` en toda escritura.

- **Rutas** (route key `pm.informes`, zona `pm`):

| Ruta | Pantalla |
|---|---|
| `/dashboard/pm/informes` | Lista de informes, en el menú Configuración |
| `/dashboard/pm/proyecto/[id]/informe` | Subpestaña del proyecto: lista filtrada + «Nuevo informe» con el proyecto ya elegido |
| `/dashboard/pm/informes/[id]` | Asistente (pasos 0–3) o editor, según el estado |
| `/dashboard/pm/informes/[id]/imprimir` | Vista de impresión para el PDF |

  Hay que excluir `informe` del `match` de `pm.detalle` (`src/modules/pm/module.ts`), añadir la pestaña en `PmProjectTabs.tsx` y la entrada `pm.informes` en `PM_CONFIG_ROUTE_KEYS` de `DashboardNav.tsx`.
- **Permisos:** cualquier rol de `pm` puede ver. Generar, corregir, subir fotos, aprobar y borrar exige **editor o admin** (`checkWriteAccess(user,"pm")`, `writeAccessResponse`).
- **Prompts en servidor.** Las referencias (~21 KB) no viajan al navegador. El cliente pide «redacta la slide X del informe Y» y el servidor monta el prompt con el informe, las fuentes y las referencias.
  - La parte estable (rol + contexto del proyecto + layouts + API + reglas) lleva `cache_control`.
  - Streaming NDJSON (`{t}` · `{ok,json,uso}` · `{error:{code,message}}`), `maxDuration = 300`.
  - Una fila en `informe_uso` por petición, también si termina en `refusal` o `max_tokens`.
- **Orquestación en el navegador.** La medición de relleno (`motor.airear`) necesita layout real, así que el cliente pinta cada slide en un lienzo oculto de 960×540 y decide si pide un ajuste.
  - Cada slide terminada se guarda al momento: si se cierra la pestaña, la generación se reanuda donde se quedó.
  - 2 slides en paralelo.
- **PDF vectorial, hecho en el servidor:** el botón «PDF» del editor llama a `GET /api/informes/pdf/[id]`. Un Chromium sin ventana (`playwright-core`; en Vercel, `@sparticuz/chromium`; en local, el Edge o el Chrome instalados) abre la ruta `/imprimir?pdf=1` con la sesión de quien lo pide y la guarda como PDF: `@page { size: 960pt 540pt; margin: 0 }`, una slide por página, texto seleccionable y fuentes incrustadas. Sale igual para todos, sin diálogo de impresión.
  - La vista `/imprimir` solo se declara lista (`data-listo`) con todas las slides pintadas con sus fuentes de verdad y todas las imágenes cargadas; si algo falla pone `data-error` y no hay PDF. Los fondos salen siempre (`print-color-adjust: exact`).
  - Respaldo: la misma vista con `window.print()` (enlace «Vista de impresión»).
  - `npm run pm:informes-pdf-fidelidad` compara el PDF con las slides página a página (tamaño, texto, fuentes incrustadas e imagen por zonas); con `--pdf` comprueba uno descargado de un despliegue.
  - Sustituye a html2canvas + jsPDF, que daban PDF rasterizado.
  - **Validador de exportación y registro (migración 046):** antes de descargar el PDF o imprimir, `incidenciasExportacion()` lista lo que falta (revisión mecánica, incoherencias de Claude, páginas de Finanzas sin aportar, huecos de imagen) y obliga a marcar «Estoy seguro». La ruta del PDF es `POST` con `{ confirmado }`, vuelve a validar con lo que calcula la propia vista (`data-incidencias`) y anota cada exportación en `informe_exportacion` (quién, cuándo, medio, versión, incidencias, confirmado); el editor lo enseña al final («Exportaciones»).
- **Fotos:** bucket privado `informes-fotos`, más `GET /api/informes/fotos/[id]`, que las sirve **desde el mismo origen** para que la vista de impresión y las capturas de corrección no tengan problemas de CORS.
- **Estética:** la herramienta usa los componentes y tokens del dashboard (`tailwind.config.js`: navy `#1E2A56`, dorado `#B89660`, fondo `#F5F5F5`, Inter, tarjetas `rounded-lg border-subtle/50`). Las slides, solo `slides.css`.
  - Ojo: los `h2`/`h3` de las slides heredaban un tracking (`.02em` / `.08em`) de la herramienta antigua. Hay que fijarlo en `slides.css` (`.iq-slide h2/h3`) para que salgan igual que los informes aprobados.

## 3. Modelo de datos · migración `…_043_informes_trimestrales.sql`
Aditiva. RLS activa y **sin políticas** (se accede solo con service role desde `data/`), igual que `corp_*` (038). Se aplica con `scripts/pm/apply-migration-043.ts`: simulación por defecto y `--apply`, con el patrón de `apply-migration-042.ts`.

| Tabla | Columnas clave |
|---|---|
| `informe_proyecto` | `codigo` PK (código del informe: SE84, SA31-33…); `id_activo` → `pm_activos` (único, nullable); `nombre`; `arquetipo` A–E; `pie` jsonb (`{variante:'cnmv',fondo,isin}` \| `{variante:'sl',vehiculo,nif}`) |
| `informe` | `id` = `<codigo>_Qn-AAAA`; `codigo`; `trimestre` ('Qn AAAA', CHECK); `trimestre_anterior`; `siguiente`; `estado` (datos · fuentes · analizado · generando · borrador · aprobado); `version`; `analisis` jsonb; `seleccion` jsonb; `contenido` jsonb (`{meta, slides}`, mismo formato que `informe.json`); `qa` jsonb; `base` jsonb; auditoría (`created_by`, `updated_by`, timestamps) |
| `informe_fuente` | Una fila por fuente: `informe_id`; `tipo` (notas · documento · actas · planificacion · previo · correccion); `nombre`; `texto`; `auto` bool; `orden`; `incluida` bool |
| `informe_foto` | `id` uuid; `informe_id`; `storage_path`; `mime`; `ancho`; `alto`; `categoria` (Obra · Portada · Render · Página de Finanzas · Otra); `para` (slide de Finanzas); `pie` |
| `informe_version` | `informe_id`; `version`; `contenido` jsonb; `estado`; `created_by` |
| `informe_cambio` | Historial de cambios: `informe_id`, `texto`, `user_id` |
| `informe_uso` | `informe_id`; `user_id`; `tipo` (analisis · slide · ajuste · resumen · correccion · coherencia); `modelo`; tokens de entrada, salida, escritura de caché y lectura de caché; `coste_usd`; `stop_reason`; `duracion_ms` |
| bucket `informes-fotos` | Privado, 10 MB, jpeg/png/webp |

**Lección de la primera iteración:** hay que aplicar la migración **antes** de probar nada. Si no, falla todo con «Could not find the table … in the schema cache». Traducir ese error (código `PGRST205`) a «falta aplicar la migración 043».

## 4. Flujo funcional (a portar desde `ORIG/app-equipo/src/app.html`)
**Paso 0 · Datos del informe**
- Proyecto: los configurados más **todos los activos de `pm_activos`** no archivados. Los 13 actuales: SE84, DC-15, GQ8, CSP-10, PC25-CP6, SA-33-31, PC25-26-RESIDENCIAL, EM-RESIDENCIAL, CA1, VE1, LSE84, SICCII y VBARE.
- Nombre: `nombre_display` o, si no tiene, el del proyecto de Actas vinculado (`project.pm_activo_id` o código normalizado).
- Un activo sin configurar pide arquetipo y pie legal.
- Opción «Otro proyecto» para fondos o carteras sin activo. Si el proyecto no tiene activo, selector para vincularlo.
- Trimestres: al elegir el anterior, el nuevo es el siguiente, y al revés. Por defecto, el trimestre que acaba de cerrar o el que está cerrando.
- Si el informe ya existe, se abre donde se quedó.

**Paso 1 · Informe anterior**
- Si existe `informe` de Q-1 con slides, se usa estructurado.
- Si no: subir PDF o PPTX y extraer el texto (pdf.js o JSZip en cliente, como `textoPdf` / `textoOffice`), o marcar «No hay informe anterior».

**Paso 2 · Información del trimestre**
- Fuentes automáticas, cargadas solas y marcadas «del portal» (se pueden quitar o recargar):
  - **Actas** (`fetchActasActaView` con el rango del trimestre + RPC `reconstruct_project_at_date` al inicio y al cierre): categoría → elemento → anotaciones con fecha, autor y cambio de estado.
    - Si el proyecto no usa estados (todo «Sin empezar»), no se escribe marca de estado.
    - Lista de bloqueados al cierre. Tope de 40 000 caracteres.
  - **Planificación** (`fetchPmPortfolio` con `soloIdActivo` y `soloPublicados:false`): tabla de hitos con plan vigente, previsión en la **última foto trimestral anterior** (si no hay snapshot de Q-1, la anterior más reciente, indicando cuál), levantamiento, desviación en días y cambio en el trimestre.
    - Más el avance de obra (`fetchAvanceObraAFecha`) al cierre de Q-1 y de Q.
  - Referencia probada: `feature/informes-trimestrales:src/modules/pm/informes/logic/fuentes-{actas,planificacion}.ts`, con SE84 Q3 2026: 51 anotaciones y 15 hitos.
- Notas libres, documentos (PDF, DOCX, PPTX, XLSX, CSV, TXT; texto extraído en cliente) y fotos (redimensionadas a ≤1600 px, JPEG 0,85, con categoría).

**Análisis** (1 petición)
- Devuelve JSON: `{resumen[5–8], objetivosPrevios[{objetivo,estado,evidencia}], hechos[≤45 {tipo,texto,fecha,modulo,fuente}], estructura[{id,titulo,accion: mantener|actualizar|ocultar|nueva, motivo}], sugeridas[≤3], faltan[], contradicciones[]}`.
- Normalización: portada, índice y resumen al inicio; disclaimer y cierre al final (`normalizarEstructura`).

**Paso 3 · Biblioteca y GO**
- Resumen, objetivos, estructura editable, biblioteca con ★ sugeridas, datos que faltan, contradicciones y estimación de peticiones.

**Generación**
- Slides deterministas sin Claude: portada (foto de categoría Portada), índice, disclaimer, cierre, `mantener`, y las bloqueadas de Finanzas (`SlideBloqueado` con la página aportada o «Pendiente de Finanzas»).
- El resto: prompt de actualizar o de crear → validar (solo componentes del API, sin rutas `fotos/`) → medir → si desborda o el relleno es < 80 %, **un** ajuste.
- El resumen ejecutivo va el último.
- Después: renumerar secciones e índice, y revisar coherencia (1 petición).
- Las reglas de salida y de redacción se copian de `SALIDA()` y `redaccion.md`: no inventar, `[pendiente: …]`, nada de cifras financieras, relleno 85–95 % sin reducir la letra.

**Editor**
- Slides escaladas y chips de relleno, pendientes y origen.
- Mover, ocultar, añadir desde la biblioteca, revisar coherencia, guardar versión y aprobar (bloqueado si hay errores de QA mecánico: desborde, `[pendiente]`, trimestres mal, falta disclaimer).
- **Corregir** con instrucción, adjuntos y **marcas** sobre la slide (resaltar, subrayar, recuadro, lápiz, con el texto que queda debajo). Se envía a Claude una captura con las marcas. Devuelve `{slide, avisos}`.
- Historial de cambios y coste acumulado de Claude.

**PDF**
- Nombre: `YYYYMMDD_<CODIGO>_<Qn AAAA>_Informe Trimestral Inversores[ (borrador vN)].pdf`.
- El sello de «bloqueado» y los `[pendiente]` no salen en el PDF.

## 5. Fases · una PR (`feature/informes-nativo`), un commit por fase
0. **Preparación**
   - Rama desde `main`.
   - `ANTHROPIC_API_KEY` en `.env.local` y Vercel, con límite de gasto en Anthropic Console.
   - `DATABASE_POOLER_URL` para las migraciones.
1. **Slides nativas**
   - Portar `bundle.js` → TSX, `bundle.css` y tokens → `slides.css`, `motor.js` → `motor.ts`, assets y referencias.
   - Página interna `/dashboard/pm/informes/_galeria` que pinta un `informe.json` de ejemplo.
   - **Paridad:** comparar el estilo computado nodo a nodo (fuente, peso, tamaño, color, tracking) y el relleno de `airear` contra el visor original, con SE84 Q2 2026. Deben salir 0 diferencias.
2. **Datos y permisos**
   - Migración 043 aplicada, repositorios, rutas y navegación con permisos.
   - Lista de informes y paso 0.
3. **Claude en servidor**
   - Cliente Anthropic, montaje de prompts y caché, streaming y `informe_uso`.
   - Tests del troceado del prompt, de la lectura del JSON y del coste.
4. **Asistente (pasos 1–3)**
   - Informe anterior, fuentes automáticas de actas y planificación, notas, documentos, fotos y análisis.
5. **Generación y editor**
   - Orquestación reanudable, QA, correcciones con marcas y adjuntos, versiones y aprobación.
6. **PDF**
   - Vista `/imprimir` y descarga.
   - Comprobar que el PDF es vectorial y que coincide con el del skill.
7. **Importación y retirada**
   - `scripts/pm/importar-informes.ts`: lee `ORIG/informes/*/*/informe.json`, sus fotos y el export del artifact, sube las fotos y reescribe las rutas.
   - Se vinculan los activos; los que no casan (PC25, SA31-33) se vinculan en la app.
   - Después: el artifact queda en solo lectura, con un aviso que remite al portal, y la carpeta `ORIG` queda como archivo.
   - Opcional: el skill se muda al repo.

## 6. Lecciones de la primera iteración (PR #52)
- Sin la migración aplicada, todo falla con un mensaje técnico. Hay que aplicarla primero y traducir el error.
- Un error en «Continuar» nunca puede quedar mudo: toda cadena asíncrona termina en un aviso visible.
- La mayoría de `pm_activos.nombre_display` están vacíos: hay que tomar el nombre de Actas.
- No siempre hay snapshot de Q-1: se compara con la última foto anterior.
- En SE84 los elementos de Actas no usan estados: no hay que marcar «Sin empezar → Sin empezar».
- Las slides heredaban el tracking de `h2`/`h3` de la herramienta: se fija en `slides.css`.
- En Windows, copiar o borrar carpetas puede fallar por bloqueos. Y los heredocs largos de Bash rompen el texto: hay que escribir los ficheros con Write.
- Los clics automatizados de la extensión de Chrome no llegan en este equipo. Para probar la interfaz, usar Edge headless con `element.click()` o Playwright.

## 7. Verificación
- `npm run check` (tsc, scripts, lint y `node:test`) y `npm run build` en cada fase.
- Paridad de slides (fase 1): 0 diferencias de estilo en los 1.008 nodos de SE84 Q2 2026.
- Recorrido completo con un usuario PM editor en SE84, Q2 → Q3 2026:
  - fuentes automáticas cargadas;
  - generación sin timeouts y relleno ≥ 85 %;
  - una corrección con marcas;
  - PDF vectorial descargado.
- Con un usuario lector: puede ver, pero no generar (403).
- `informe_uso`: coste por informe dentro de lo esperado y lectura de caché > 0 desde la segunda petición.
- Importación en simulación y después `--apply`: SE84 Q2 2026 aparece como «informe anterior» estructurado del Q3.
