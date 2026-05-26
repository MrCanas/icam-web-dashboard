/** Título visible de categoría; sufijo de sub-lote tipo Monday ("Estado Proyecto — East"). */
export function formatCategoryDisplayName(
  name: string,
  sublotLabel: string | null,
): string {
  const base = name.trim();
  if (!sublotLabel?.trim()) return base;

  const sub = formatSublotSuffix(sublotLabel);
  const normSub = sublotLabel.trim().toLowerCase();
  const lower = base.toLowerCase();

  if (
    lower.endsWith(normSub) ||
    lower.endsWith(` - ${normSub}`) ||
    lower.endsWith(` — ${sub.toLowerCase()}`)
  ) {
    return base;
  }

  return `${base} — ${sub}`;
}

function formatSublotSuffix(label: string): string {
  const t = label.trim();
  if (t.length <= 4 && t === t.toUpperCase()) return t;
  return t.charAt(0).toUpperCase() + t.slice(1).toLowerCase();
}
