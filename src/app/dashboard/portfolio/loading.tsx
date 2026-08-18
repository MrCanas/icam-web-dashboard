/** Esqueleto genérico de la zona Dashboard (pm-overview tiene el suyo propio). */
export default function Loading() {
  return (
    <div className="animate-pulse space-y-4" aria-hidden="true">
      <div className="h-20 rounded-lg border border-subtle/50 bg-card" />
      <div className="h-72 rounded-lg border border-subtle/50 bg-card" />
      <div className="h-72 rounded-lg border border-subtle/50 bg-card" />
    </div>
  );
}
