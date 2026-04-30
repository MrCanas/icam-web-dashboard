interface KPICardProps {
  title: string;
  value: string;
  subtitle: string;
  highlight?: boolean;
}

export function KPICard({ title, value, subtitle, highlight = false }: KPICardProps) {
  return (
    <article className="bg-card rounded-lg border border-subtle/50 shadow-sm overflow-hidden">
      <div className={`h-[3px] ${highlight ? "bg-icam-gold" : "bg-icam-900"}`} />
      <div className="p-4">
        <p className="text-xs font-medium text-text-muted uppercase tracking-wider">{title}</p>
        <p className="mt-2 text-3xl font-semibold text-text-primary">{value}</p>
        <p className="mt-1 text-sm text-text-muted">{subtitle}</p>
      </div>
    </article>
  );
}
