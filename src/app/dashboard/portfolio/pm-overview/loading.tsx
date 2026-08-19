/** Esqueleto del Overview PM (header + KPIs + Gantt). */
export default function Loading() {
  return (
    <div className="animate-pulse space-y-4" aria-hidden="true">
      <div className="h-20 rounded-lg border border-subtle/50 bg-card" />
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="h-24 rounded-lg border border-subtle/50 bg-card" />
        <div className="h-24 rounded-lg border border-subtle/50 bg-card" />
        <div className="h-24 rounded-lg border border-subtle/50 bg-card" />
        <div className="h-24 rounded-lg border border-subtle/50 bg-card" />
      </div>
      <div className="h-96 rounded-lg border border-subtle/50 bg-card" />
    </div>
  );
}
