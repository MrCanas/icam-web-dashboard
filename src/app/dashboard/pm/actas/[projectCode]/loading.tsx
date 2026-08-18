/** Esqueleto de la página de actas de un proyecto (tabs + tablero). */
export default function Loading() {
  return (
    <div className="animate-pulse space-y-4" aria-hidden="true">
      <div className="h-12 rounded-t-lg border border-subtle/50 bg-card" />
      <div className="h-28 rounded-lg border border-subtle/50 bg-card" />
      <div className="h-[480px] rounded-lg border border-subtle/50 bg-card" />
    </div>
  );
}
