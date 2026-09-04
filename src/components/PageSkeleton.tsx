/**
 * Esqueleto genérico de carga para páginas del dashboard. Renderiza dentro del
 * layout (la nav ya está pintada), así que solo cubre el área de contenido.
 *
 * `variant` elige una silueta parecida a la de la página que va a llegar. No es
 * decoración: un esqueleto con la forma equivocada obliga a releer la pantalla
 * cuando el contenido aparece y se percibe como un salto. Por defecto mantiene
 * exactamente la silueta que tenía antes de existir esta prop, de modo que los
 * `loading.tsx` que ya lo usaban no cambian.
 *
 * Se anuncia con `role="status"`: las cajas son `aria-hidden` porque no
 * significan nada, pero quien navega con lector de pantalla necesita oír que se
 * está cargando algo. Antes el componente entero era `aria-hidden` y el lector
 * se quedaba en silencio.
 */
export type PageSkeletonVariant = "kpis" | "tabla" | "lista" | "board";

interface PageSkeletonProps {
  variant?: PageSkeletonVariant;
  /** Lo que se anuncia al lector de pantalla mientras carga. */
  label?: string;
}

/** Barra del título, común a todas las siluetas. */
function Titulo() {
  return <div className="h-7 w-64 rounded-md bg-subtle/60" />;
}

function Caja({ className }: { className: string }) {
  return <div className={`rounded-lg border border-subtle/50 bg-card ${className}`} />;
}

function Kpis() {
  return (
    <>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Caja className="h-20" />
        <Caja className="h-20" />
        <Caja className="h-20" />
        <Caja className="h-20" />
      </div>
      <Caja className="h-72" />
      <Caja className="h-48" />
    </>
  );
}

/** Cabecera de tabla + filas: para rejillas y listados densos. */
function Tabla() {
  return (
    <div className="overflow-hidden rounded-lg border border-subtle/50 bg-card">
      <div className="h-10 border-b border-subtle/40 bg-subtle/30" />
      {Array.from({ length: 8 }, (_, i) => (
        <div key={i} className="h-11 border-b border-subtle/20 last:border-b-0" />
      ))}
    </div>
  );
}

/** Rejilla de tarjetas: para los índices de proyectos. */
function Lista() {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: 6 }, (_, i) => (
        <Caja key={i} className="h-24" />
      ))}
    </div>
  );
}

/** Un bloque alto que ocupa el ancho: tableros de actas y planificación. */
function Board() {
  return (
    <>
      <div className="flex gap-2">
        <Caja className="h-9 w-32" />
        <Caja className="h-9 w-32" />
        <Caja className="h-9 w-24" />
      </div>
      <Caja className="h-[28rem]" />
    </>
  );
}

export function PageSkeleton({ variant = "kpis", label = "Cargando…" }: PageSkeletonProps) {
  return (
    <div role="status" aria-live="polite" className="animate-pulse space-y-4">
      <span className="sr-only">{label}</span>
      <div aria-hidden="true" className="space-y-4">
        <Titulo />
        {variant === "tabla" ? <Tabla /> : null}
        {variant === "lista" ? <Lista /> : null}
        {variant === "board" ? <Board /> : null}
        {variant === "kpis" ? <Kpis /> : null}
      </div>
    </div>
  );
}
