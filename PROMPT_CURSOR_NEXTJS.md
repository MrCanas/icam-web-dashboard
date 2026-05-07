# Prompt inicial para Cursor — ICAM Dashboard (Next.js + Supabase + Vercel)

Copia el bloque completo de abajo y pégalo en Cursor como primer mensaje del chat.

---

```text
Quiero construir un dashboard ejecutivo de portfolio inmobiliario para ICAM Asset Manager.
Empezamos con la página 1 "Executive Summary" y luego añadiremos 4 páginas más.

## STACK TÉCNICO

- **Framework**: Next.js 14+ (App Router)
- **Lenguaje**: TypeScript estricto
- **Estilos**: Tailwind CSS 3
- **Gráficos**: Recharts
- **Base de datos**: Supabase (PostgreSQL)
- **Auth**: Supabase Auth (email/password o magic link, decide lo más sencillo)
- **Repositorio**: GitHub → usuario `MrCanas`
- **Deploy**: Vercel (conectado al repo)
- **Nombre del proyecto**: `icam-web-dashboard`

## PASO 1 — SETUP DEL PROYECTO

1. Crea el proyecto Next.js con:
   ```bash
   npx create-next-app@latest icam-web-dashboard --typescript --tailwind --eslint --app --src-dir --import-alias "@/*"
   ```
2. Instala dependencias:
   ```bash
   npm install recharts @supabase/supabase-js @supabase/ssr
   ```
3. Crea `.env.local` con:
   ```
   NEXT_PUBLIC_SUPABASE_URL=https://psptnfjitmfukuboeamu.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=sb_publishable_SzXzj3fF53Ir3QXQmupHlQ_aBO-vq8x
   ```
4. Inicializa git y conecta al repo `MrCanas/icam-web-dashboard`.

## PASO 2 — BASE DE DATOS (Supabase)

Crea una tabla `proyectos` con este schema:

```sql
CREATE TABLE proyectos (
  id SERIAL PRIMARY KEY,
  proyecto TEXT NOT NULL,
  situacion TEXT NOT NULL,
  tipo_proyecto TEXT NOT NULL,
  inversion_total NUMERIC DEFAULT 0,
  total_ingresos_venta NUMERIC DEFAULT 0,
  beneficios NUMERIC DEFAULT 0,
  unidades_totales INTEGER DEFAULT 0,
  tir_desp_is NUMERIC DEFAULT 0,
  roe_desp_is NUMERIC DEFAULT 0,
  multiplo NUMERIC DEFAULT 0,
  project_irr NUMERIC DEFAULT 0,
  bcr NUMERIC DEFAULT 0,
  ubicacion TEXT,
  equity NUMERIC DEFAULT 0,
  holding_period INTEGER DEFAULT 0,
  superficie_edificable NUMERIC DEFAULT 0,
  es_ultima_fila INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS: solo lectura para usuarios autenticados
ALTER TABLE proyectos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "read_all" ON proyectos FOR SELECT TO authenticated USING (true);

-- Índices útiles
CREATE INDEX idx_proyectos_situacion ON proyectos(situacion);
CREATE INDEX idx_proyectos_tipo ON proyectos(tipo_proyecto);
CREATE INDEX idx_proyectos_ultima_fila ON proyectos(es_ultima_fila);
```

Después, inserta estos datos REALES (28 proyectos extraídos del Excel maestro):

```sql
INSERT INTO proyectos (proyecto, situacion, tipo_proyecto, inversion_total, total_ingresos_venta, beneficios, unidades_totales, tir_desp_is, roe_desp_is, multiplo, project_irr, bcr, ubicacion, equity, holding_period, superficie_edificable, es_ultima_fila) VALUES
('BA49', 'Culminado', 'Promoción', 9533509, 10079498, 2413514, 18, 0.168, 0.45, 1.45, 0.263, 0.253161, 'Barquillo 49', 5367722, 50, 1798, 1),
('TO123', 'Culminado', 'Promoción', 5089316, 6461312, 1429421, 22, 0.216, 0.358, 1.36, 0.296, 0.280867, 'Toledo 123', 3153195, 44, 1462, 1),
('CA82', 'Culminado', 'Promoción', NULL, 1912000, NULL, 0, NULL, NULL, NULL, NULL, NULL, 'Castello 82', NULL, 24, 410, 1),
('GV61', 'Culminado', 'Promoción', NULL, 2516000, NULL, 0, NULL, NULL, NULL, NULL, NULL, 'Gran Via 61', NULL, 30, 431.3, 1),
('CR20', 'Culminado', 'Promoción', 3940905, 5432225, 1499779, 7, 0.158, 0.623, 1.62, 0.172, 0.380567, 'Cruz 20', 2407505, 49, 803, 1),
('FR02', 'Culminado', 'Promoción', 22646555, 26296684, 4024447.57, 20, 0.101, 0.426, 1.47, 0.068, 0.177707, 'Francisco de Rojas 02', 8500000, 56, 4374, 1),
('FU149', 'Culminado', 'Promoción', NULL, 1600000, NULL, 0, NULL, NULL, NULL, NULL, NULL, 'Fuencarral 149', NULL, 10, 178, 1),
('DRC26', 'Culminado', 'Promoción', 25832554, 30359899, 4902907, 15, 0.158, 0.656, 1.66, 0.075, 0.189796, 'Don Ramon de la Cruz 26', 7962925, 59, 3114, 1),
('NB86', 'Culminado', 'Promoción', 32013681, 39478446, 6506771, 11, 0.128, 0.723, 1.72, 0.073, 0.20325, 'Nuñez de Balboa 86', 9003000, 62, 4090, 1),
('CO13', 'Culminado', 'Promoción', 3810253, 4550000, 976223, 6, 0.254, 0.609, 1.58, 0.354, 0.256209, 'Coruña 13', 1601925, 29, 1965, 1),
('GA91', 'Culminado', 'Promoción', 15234455, 17786200, 2660070, 29, 0.108, 0.591, 1.59, 0.085, 0.174609, 'Galileo 91', 4500000, 56, 2595, 1),
('LST5', 'Culminado', 'Promoción', 7163031, 7790000, 627214, 7, 0.057, 0.251, 1.25, 0.054, 0.087563, 'Lorenzo S Tendero 5-7', 2500000, 53, 1322, 1),
('LDH171', 'Culminado', 'Promoción', 51288221, 63836950, 13148729, 3, 0.1404, 0.497, 1.77, 0.095, 0.256369, 'LDH171-V1', 26475000, 51, 17770, 1),
('GA09', 'Culminado', 'Promoción', 12174001, 14152070, 1699994, 24, 0.101, 0.472, 1.47, 0.1234, 0.139641, 'Galileo 9', 3600000, 53, 2151, 1),
('FU27', 'Culminado', 'Promoción', 9431187, 9108460, 6032, 24, 0.001, 0.002, 1.0, 0.0011, 0.00064, 'Calle Fundadores 27', 2700000, 46, 1550, 1),
('PA', 'Culminado', 'Promoción', 10735041, 11441358, 2283836, 173, 0.075, 0.535, 1.54, 0.072, 0.212746, 'Papa Luna', 4265000, 82, 3537, 1),
('FICC I', 'Culminado', 'Fondo', 10152812, 13600000, 2277471, 34, 0.1315, 0.3233, 1.3233, 0.1827, 0.224319, 'Doctor Cortezo 15', 7045000, 33, 2038, 1),
('FICC II', 'En Marcha', 'Fondo', 12383320, 18368533, 4484982, 33, 0.1678, 0.4869, 1.4869, 0.2115, 0.362179, 'Santa Engracia 84', 8400000, 37, 1616, 1),
('GQ8', 'En Marcha', 'Promoción', 22075088, 32903226, 7589418, 50, 0.1549, 0.5241, 1.5241, 0.1549, 0.3438, 'Glorieta de Quevedo 8', 14500000, 35, 2100, 1),
('IBIZA CE', 'En Marcha', 'Promoción', 34626442, 35388262, 1232307, 94, 0.0217, 0.176, 1.176, 0.0217, 0.035589, 'Can Espanyol', 7000000, 94, 9636, 1),
('IBIZA HS', 'En Marcha', 'Promoción', 24732645, 40000000, 19494341, 118, 0.1325, 1.0799, 2.0799, 0.1325, 0.788203, 'Paseo Salamera 7', 18062200, 82, 3757, 1),
('RETAIL SE84', 'En Marcha', 'Promoción', 8140000, 9914427.02, 1672800, 2, 0.1812, 0.328, 1.328, 0.1812, 0.205504, 'Santa Engracia 84', 5100000, 22, 628, 1),
('SICC I', 'En Marcha', 'Fondo', 98024675, 130623500, 27316074, 88, 0.1829, 0.8124, 1.8124, 0.1992, 0.278665, 'Sagasta 31-33', 31500000, 44, 10014.05, 1),
('SICC II', 'En Marcha', 'Fondo', 71702333, 95690898, 21978517, 278, 0.2466, 0.5861, 1.5861, 0.3524, 0.306524, 'VBARE', 37500000, 47, 17426, 1),
('CSP10', 'En Marcha', 'Promoción', 28193117, 44444774, 11312460, 66, 0.1699, 0.5985, 1.5985, 0.1699, 0.401249, 'Costanilla de San Pedro 10', 18900000, 36, 3200, 1),
('PC25', 'En Marcha', 'Promoción', 67344476, 86425000, 14297740, 196, 0.1773, 0.5375, 1.5375, 0.1773, 0.212308, 'Padre Claret 25', 26600000, 32, 13010, 1),
('VE1', 'En Marcha', 'Promoción', 15076288, 19103000, 2789242, 28, 0.245, 0.2999, 1.2999, 0.3058, 0.185009, 'Velarde 1', 9300000, 19, 1671, 1),
('CA1', 'En Marcha', 'Promoción', 80578681, 100862466, 15327200, 69, 0.1668, 0.5474, 1.5474, 0.1668, 0.190214, 'Camino 1', 28000000, 43, 6949, 1);
```

**NOTA IMPORTANTE sobre datos nulos:** 3 proyectos históricos (CA82, GV61, FU149) tienen inversión y beneficios NULL. Tu código debe manejar NULLs con seguridad (no sumar NULL, no dividir por NULL). Estos proyectos SÍ cuentan en Nº Proyectos pero NO en métricas financieras.

## PASO 3 — ESTRUCTURA DE ARCHIVOS

```
src/
├── app/
│   ├── layout.tsx              ← layout raíz con Supabase provider
│   ├── page.tsx                ← redirect a /dashboard
│   ├── login/
│   │   └── page.tsx            ← página de login (sencilla)
│   └── dashboard/
│       ├── layout.tsx          ← layout del dashboard (header + nav + footer)
│       ├── page.tsx            ← Página 1: Executive Summary
│       ├── mapa/page.tsx       ← Página 2 (placeholder)
│       ├── rentabilidad/page.tsx ← Página 3 (placeholder)
│       ├── proyectos/page.tsx  ← Página 4 (placeholder)
│       └── tendencias/page.tsx ← Página 5 (placeholder)
├── components/
│   ├── layout/
│   │   ├── Header.tsx
│   │   ├── NavTabs.tsx
│   │   └── Footer.tsx
│   ├── dashboard/
│   │   ├── KPICard.tsx
│   │   ├── Top10BarChart.tsx
│   │   ├── DonutChart.tsx
│   │   ├── DistributionBlock.tsx
│   │   ├── ConsolidatedKPIs.tsx
│   │   └── FilterBar.tsx
│   └── ui/                     ← componentes genéricos si los necesitas
├── lib/
│   ├── supabase/
│   │   ├── client.ts           ← createBrowserClient
│   │   ├── server.ts           ← createServerClient
│   │   └── middleware.ts       ← refresh session
│   ├── calculations.ts         ← toda la lógica de KPIs
│   ├── formatters.ts           ← fmtM€, fmtPct, fmtMult, fmtInt
│   └── types.ts                ← interfaces TypeScript
├── hooks/
│   └── useProyectos.ts         ← hook que trae datos de Supabase
└── middleware.ts               ← proteger rutas /dashboard/*
```

## PASO 4 — REGLA CRÍTICA DE NEGOCIO

**OBLIGATORIO**: toda query a Supabase DEBE filtrar `es_ultima_fila = 1`.
Esto asegura que solo se use la fila representativa de cada proyecto (no filas históricas trimestrales).
El resultado correcto son 28 proyectos, 11 activos y 17 culminados.

## PASO 5 — CAPA DE CÁLCULOS (`lib/calculations.ts`)

Implementa estas funciones puras que reciben un array de proyectos filtrados:

```typescript
interface Proyecto {
  id: number;
  proyecto: string;
  situacion: 'En Marcha' | 'Culminado';
  tipo_proyecto: 'Promoción' | 'Fondo';
  inversion_total: number;
  total_ingresos_venta: number;
  beneficios: number;
  unidades_totales: number;
  tir_desp_is: number;
  roe_desp_is: number;
  multiplo: number;
  project_irr: number;
  bcr: number;
  ubicacion: string;
}

// KPIs principales
function computeKPIs(data: Proyecto[]) → {
  nProyectos, nActivos, nCulminados,
  inversionTotal, gdvTotal, beneficioTotal,
  tirPonderada, tirMedia, roeMedia, multiploMedio,
  inversionMedia, beneficioMedio, unidadesTotales, unidadesMedia,
  tirSup15, tirValidCount
}

// TIR ponderada = Σ(TIR × Inversión) / Σ(Inversión) donde TIR > 0
// Múltiplo medio = media aritmética de Múltiplo donde Múltiplo > 0
// ROE medio = media aritmética de ROE donde ROE > 0

// Top 10 por inversión
function getTop10(data: Proyecto[]) → Proyecto[]

// Agrupaciones
function groupByField(data: Proyecto[], field: string) → Record<string, { count, inversion }>

// KPIs segmentados
function segmentKPIs(data: Proyecto[]) → { portfolio, enMarcha, culminado }
```

## PASO 6 — FORMATTERS (`lib/formatters.ts`)

```typescript
fmtMEuros(value: number) → "682,0 M€"        // dividir entre 1M, 1 decimal, separador coma
fmtPct(value: number)    → "14,6%"            // multiplicar por 100, 1 decimal
fmtMult(value: number)   → "1,51x"            // 2 decimales + x
fmtInt(value: number)    → "1.245"            // separador de miles español
```

## PASO 7 — PÁGINA EXECUTIVE SUMMARY

### Layout de la página:
1. **Barra de filtros** — Situación (dropdown) + Tipo (dropdown) + botón limpiar
2. **5 KPI cards en fila** (responsive: 5 cols desktop, 3+2 tablet, 1 col mobile)
   - Nº Proyectos (subtítulo: "X activos · Y culminados")
   - Inversión Total (subtítulo: "Media: X M€")
   - GDV Total (subtítulo: "Margen: X%")
   - Beneficio Agregado (subtítulo: "Media: X M€")
   - TIR Media Ponderada (subtítulo: "X de Y proy > 15%") ← esta con acento dorado
3. **Grid 2 columnas:**
   - Izq: Top 10 proyectos (barras horizontales con Recharts)
   - Der: 2 donuts (por Tipo + por Situación)
4. **Grid 2 columnas inferior:**
   - Izq: Distribución del portfolio (barras proporcionales + tags)
   - Der: Tabla KPIs consolidados (Portfolio / En Marcha / Culminado)

### Interacciones:
- Los filtros afectan a TODOS los componentes de la página
- Server-side data fetching con filtros como searchParams o client-side filtering
- Los donuts y el bar chart deben tener tooltips con valor en M€

## PASO 8 — PALETA CORPORATIVA

Configura en `tailwind.config.ts`:

```typescript
colors: {
  icam: {
    900: '#1E2A56',    // azul marino — headers, títulos, barras
    800: '#2B3668',    // hover azul
    gold: '#B89660',   // acento dorado — tab activa, highlights
    'gold-hover': '#A0824F',
  },
  page: '#F5F5F5',     // fondo página
  card: '#FFFFFF',     // fondo cards
  subtle: '#EAEBEE',  // bordes, separadores, fondos sutiles
  'text-primary': '#1E2A56',
  'text-body': '#2C2C2C',
  'text-muted': '#8A8A8A',
}
```

### Reglas de diseño:
- Fondo de página: `bg-page` (#F5F5F5)
- Cards: blanco con `shadow-sm` y borde `border border-subtle/50`, radius `rounded-lg`
- Cada KPI card tiene una línea superior de 3px en `icam-900` (la de TIR en `icam-gold`)
- Header: fondo `icam-900`, texto blanco, pestaña activa con borde inferior dorado
- Footer: fondo `icam-900`, texto blanco/45% opacidad, 10px
- Tipografía: Inter o system-ui, pesos 400/500/600/700
- Sensación: premium, corporativa, ejecutiva, apta para comité
- NO usar colores chillones, NO dark mode, NO emojis

## PASO 9 — HEADER Y NAVEGACIÓN

```tsx
// Header.tsx
<header className="bg-icam-900 h-14 px-8 flex items-center justify-between">
  <div className="text-white font-semibold text-base tracking-wide">
    <span className="text-icam-gold">ICAM</span> Asset Manager
  </div>
  <NavTabs />
  <div className="text-white/40 text-[10px] text-right leading-tight">
    Confidencial · Comité<br />Datos actualizados
  </div>
</header>
```

NavTabs con links a:
- `/dashboard` → "1 · Executive" (active)
- `/dashboard/mapa` → "2 · Mapa"
- `/dashboard/rentabilidad` → "3 · Rentabilidad"
- `/dashboard/proyectos` → "4 · Proyectos"
- `/dashboard/tendencias` → "5 · Tendencias"

Pestaña activa: `text-white border-b-[3px] border-icam-gold`
Inactivas: `text-white/60 hover:text-white/90`

## PASO 10 — VALIDACIÓN

Cuando la página esté montada, estos son los valores que DEBEN aparecer con los datos seed:

| KPI | Valor esperado |
|-----|---------------|
| Nº Proyectos | 28 |
| Activos | 11 |
| Culminados | 17 |
| Promoción (conteo) | 24 |
| Fondo (conteo) | 4 |
| Inversión Total | ~681,9 M€ |
| GDV Total | ~880,1 M€ |
| Beneficio Total | ~172,0 M€ |
| TIR Ponderada | ~15,8% |
| Múltiplo Medio | ~1,51x |

**Nota:** 3 proyectos (CA82, GV61, FU149) tienen inversión NULL. Se cuentan como proyectos pero NO suman en métricas financieras.
Si las cifras no cuadran, revisa que estés filtrando `es_ultima_fila = 1`, que no dupliques filas, y que manejes NULLs correctamente.

## QUÉ QUIERO QUE HAGAS AHORA

1. Crea toda la estructura del proyecto
2. Configura Supabase client
3. Implementa la capa de cálculos con tests
4. Construye todos los componentes
5. Monta la página Executive Summary completa
6. Asegura que se ve premium y corporativa
7. Prepara el deploy a Vercel (config correcta)

## REGLAS PARA TI

- No me des teoría, implementa directamente
- Si algo es ambiguo, decide y documenta la decisión en un comentario
- TypeScript estricto, sin `any`
- Componentes client-side solo cuando sea necesario (usa Server Components donde puedas)
- Código limpio y organizado
- No hardcodees cifras del dataset en los componentes
- Todos los cálculos deben ser dinámicos desde Supabase
- Si un campo es null o 0, manéjalo con seguridad (no NaN, no Infinity)
- Prepara el proyecto para que sea fácil añadir las otras 4 páginas después
```
