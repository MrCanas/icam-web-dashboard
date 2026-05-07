# Prompt para Cursor — Página de Administración de Datos

Copia el bloque completo de abajo y pégalo en Cursor.

---

```text
Necesito crear una nueva sección "Data" en el dashboard para que el equipo pueda actualizar los datos del portfolio subiendo el Excel maestro directamente desde la web. Esta sección tiene dos pestañas: "Subir datos" y "Actividad" (logs).

## CONTEXTO

El dashboard ya funciona con Supabase (tabla `proyectos`) y los datos fueron insertados manualmente con SQL. Ahora quiero que los datos se puedan actualizar subiendo el Excel maestro (.xlsm) desde una pantalla de administración dentro del propio dashboard. El archivo es "MAESTRO - VEHICULOS ICAM.xlsm" y tiene una hoja llamada "Tabla madre" con ~85 filas históricas por proyecto. Solo debemos usar las filas donde la columna "Es Ultima Fila " (columna G, puede tener espacio final) = 1. Eso da 28 proyectos representativos.

## ESTRUCTURA DE ARCHIVOS A CREAR

```
src/
├── app/
│   └── dashboard/
│       └── data/
│           └── page.tsx              ← Página principal "Data" con tabs
├── components/
│   └── data/
│       ├── DataUpload.tsx            ← Componente de subida de archivo
│       ├── DataPreview.tsx           ← Vista previa de datos antes de confirmar
│       ├── ActivityLog.tsx           ← Tabla de logs de actividad
│       └── ProcessingStatus.tsx      ← Estado del procesamiento en tiempo real
├── app/
│   └── api/
│       └── upload-excel/
│           └── route.ts             ← API Route que procesa el Excel
└── lib/
    └── excel-parser.ts              ← Lógica de parsing del Excel
```

## 1. NAVEGACIÓN

- Añade "Data" como nueva pestaña en la navegación del dashboard (Header/NavTabs), después de "Tendencias"
- Usa el mismo estilo de pestaña que las demás (azul marino #1E2A56, subrayado dorado #B89660 cuando activa)
- La pestaña debe ser visible solo si el usuario está autenticado (ya lo está por el middleware)

## 2. PÁGINA DATA (`/dashboard/data`)

La página tiene dos tabs internos:

### Tab 1: "Subir datos"

Diseño:
- Card blanca centrada con el flujo de subida
- Título: "Actualizar datos del portfolio"
- Subtítulo: "Sube el archivo Excel maestro (.xlsm) para actualizar los datos de todos los proyectos"

Flujo de subida paso a paso:

**Paso 1 — Selección de archivo**
- Zona de drag & drop con borde punteado (#EAEBEE) y texto "Arrastra el archivo Excel aquí o haz clic para seleccionar"
- Icono de documento/upload sutil
- Acepta solo `.xlsx` y `.xlsm`
- Tamaño máximo: 50MB
- Al seleccionar el archivo, muestra nombre del archivo, tamaño y fecha de modificación

**Paso 2 — Procesamiento y preview**
- Al subir el archivo, llama a la API Route `/api/upload-excel`
- Muestra un spinner/barra de progreso con el texto "Procesando archivo..."
- La API parsea el Excel, extrae los datos de "Tabla madre" con el filtro EsUltimaFila = 1
- Devuelve un resumen ANTES de escribir en la base de datos:
  - Nº de proyectos detectados
  - Nº de proyectos activos / culminados
  - Inversión total
  - GDV total
  - Lista de proyectos encontrados (nombre + situación + tipo)
  - Warnings si hay (campos vacíos, proyectos sin inversión, etc.)

**Paso 3 — Confirmación**
- Muestra el resumen en una card con fondo sutil (#EAEBEE)
- Compara con los datos actuales en Supabase:
  - "Datos actuales: 28 proyectos | Nuevos datos: 28 proyectos"
  - Resalta si hay diferencias (proyectos nuevos, eliminados o cambios significativos)
- Dos botones:
  - "Confirmar y actualizar" (azul marino #1E2A56) → ejecuta el upsert
  - "Cancelar" (outline gris) → vuelve al paso 1
- Checkbox: "Entiendo que esto reemplazará todos los datos actuales del portfolio"

**Paso 4 — Resultado**
- Mensaje de éxito: "Datos actualizados correctamente" con icono ✓ verde
- Resumen: "28 proyectos actualizados a las HH:MM del DD/MM/YYYY"
- Botón: "Ver dashboard" → navega a Executive Summary

### Tab 2: "Actividad"

Tabla de logs con el historial de todas las subidas. Columnas:

| Fecha | Usuario | Archivo | Proyectos | Estado | Duración | Detalle |
|-------|---------|---------|-----------|--------|----------|---------|

- **Fecha**: timestamp en formato DD/MM/YYYY HH:MM
- **Usuario**: siempre "ImparCapital" por ahora (hardcodeado del login)
- **Archivo**: nombre del archivo subido
- **Proyectos**: nº de proyectos procesados
- **Estado**: badge con color
  - "Completado" → verde (#22C55E)
  - "Error" → rojo (#EF4444)
  - "En proceso" → dorado (#B89660)
- **Duración**: tiempo en segundos que tardó el proceso
- **Detalle**: botón/link que abre un modal o expande la fila con:
  - Lista de proyectos procesados
  - Warnings encontrados
  - Errores si los hubo
  - Comparativa antes/después (nº proyectos, inversión total)

Ordenada por fecha descendente (más reciente arriba).

## 3. API ROUTE (`/api/upload-excel/route.ts`)

```typescript
// POST /api/upload-excel
// Content-Type: multipart/form-data
// Body: file (Excel .xlsm/.xlsx)
// Query param: ?confirm=true (para ejecutar el upsert real)

// Sin ?confirm → solo parsea y devuelve preview
// Con ?confirm=true → parsea + hace upsert en Supabase
```

Lógica del parsing:
- Instala la dependencia `xlsx` (SheetJS): `npm install xlsx`
- Abre el workbook con `XLSX.read(buffer, { type: 'buffer' })`
- Accede a la hoja "Tabla madre"
- Mapea las columnas por posición (no por nombre de cabecera, que puede variar):
  - Columna E (5) → Proyecto
  - Columna F (6) → Ubicacion
  - Columna G (7) → EsUltimaFila
  - Columna H (8) → Trimestre
  - Columna I (9) → HoldingPeriod
  - Columna J (10) → FechaInicio
  - Columna K (11) → EndQuarter
  - Columna M (13) → SuperficieEdificable
  - Columna U (21) → UnidadesTotales
  - Columna AY (51) → Equity
  - Columna BG (59) → InversionTotal
  - Columna BW (75) → TotalIngresosVenta
  - Columna CT (98) → TIRDespuesIS
  - Columna CU (99) → ROEDespuesIS
  - Columna CY (103) → ProjectIRR
  - Columna DK (115) → Beneficios
  - Columna DL (116) → Multiplo
  - Columna DM (117) → BCR
  - Columna DS (125) → TipoProyecto
  - Columna DT (126) → Situacion

- Filtra solo filas donde EsUltimaFila = 1
- Detiene el escaneo si encuentra más de 5 filas vacías consecutivas
- Maneja valores NULL para proyectos como CA82, GV61, FU149

Respuesta de preview (sin confirm):
```json
{
  "success": true,
  "preview": {
    "totalProyectos": 28,
    "activos": 11,
    "culminados": 17,
    "inversionTotal": 682000000,
    "gdvTotal": 880000000,
    "proyectos": [
      { "nombre": "BA49", "situacion": "Culminado", "tipo": "Promoción", "inversion": 9533509 },
      ...
    ],
    "warnings": ["CA82: inversión y beneficios vacíos", ...]
  }
}
```

Lógica del upsert (con confirm=true):
- Usa Supabase Admin Client (con service role key) para escritura
- Estrategia: DELETE all + INSERT all (reemplazo completo, más seguro que upsert individual)
- Envuelve en una transacción si es posible, o al menos:
  1. Inserta los nuevos datos en una tabla temporal o con un flag
  2. Si todo OK, elimina los datos antiguos y activa los nuevos
  3. Si hay error, no toca los datos existentes
- Registra el log en una nueva tabla `upload_logs`

## 4. TABLA DE LOGS EN SUPABASE

La tabla `upload_logs` ya existe en Supabase con estas columnas: id, fecha, usuario, archivo, num_proyectos, estado, duracion_ms, detalle (JSONB), created_at. Úsala directamente, no la crees.

## 5. VARIABLE DE ENTORNO NECESARIA

Para poder escribir en Supabase desde la API Route, necesito el Service Role Key (no el anon key). Añade a `.env.local`:

```
SUPABASE_SERVICE_ROLE_KEY=<la pondré yo manualmente>
```

Usa este key SOLO en la API Route del servidor, NUNCA en el cliente.

En el código de la API Route:
```typescript
import { createClient } from '@supabase/supabase-js'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)
```

## 6. ESTILOS VISUALES

Misma paleta que el resto del dashboard:
- Fondo página: #F5F5F5
- Cards: fondo blanco, border-radius 8px, sombra sutil
- Títulos: #1E2A56 (azul marino)
- Texto secundario: #8A8A8A
- Acento/progreso: #B89660 (dorado)
- Éxito: #22C55E
- Error: #EF4444
- Zona de drop: borde punteado #EAEBEE, hover borde #B89660

Los tabs internos ("Subir datos" / "Actividad") deben usar el mismo estilo que los filtros del dashboard: botones tipo pill con fondo azul cuando activo.

## 7. SEGURIDAD

- La página /dashboard/data está protegida por el mismo middleware de auth que el resto del dashboard
- La API Route /api/upload-excel debe verificar que el usuario está autenticado antes de procesar
- El Service Role Key nunca se expone al cliente
- Validar que el archivo subido es realmente un Excel (.xlsx/.xlsm) comprobando el content-type y los magic bytes

## 8. DEPENDENCIAS

Instala:
```bash
npm install xlsx
```

## 9. PULL REQUEST

Crea una nueva pull request en GitHub con todos estos cambios.
```
