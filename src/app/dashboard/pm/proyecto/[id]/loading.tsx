/**
 * Esqueleto del panel de proyecto. Renderiza DENTRO de proyecto/[id]/layout.tsx,
 * que ya pinta las PmProjectTabs reales — aquí solo el contenido.
 */
export default function Loading() {
  return (
    <div className="animate-pulse space-y-4" aria-hidden="true">
      <div className="h-7 w-64 rounded-md bg-subtle/60" />
      <div className="h-24 rounded-lg border border-subtle/50 bg-card" />
      <div className="h-80 rounded-lg border border-subtle/50 bg-card" />
      <div className="h-64 rounded-lg border border-subtle/50 bg-card" />
    </div>
  );
}
