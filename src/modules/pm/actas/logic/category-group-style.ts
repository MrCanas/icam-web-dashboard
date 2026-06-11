/** Paleta aproximada de grupos Monday (por master_group.id del catálogo ICAM). */
const MASTER_GROUP_STYLES: Record<string, { bg: string; text: string }> = {
  "1678bc10-3d55-4002-aaef-4e8bdaab9206": { bg: "#037f4c", text: "#ffffff" },
  "e7cc6933-ff96-4724-8eba-ac51c1f1cd94": { bg: "#579bfc", text: "#ffffff" },
  "d67279aa-cdcf-4311-964f-90952dc3e4fa": { bg: "#ff5ac4", text: "#ffffff" },
  "a322a613-14af-4ac5-86eb-a57ee3aa486b": { bg: "#fdab3d", text: "#1e1e1e" },
  "ff390dae-443e-4a50-9132-bed05868c7ed": { bg: "#a25ddc", text: "#ffffff" },
  "0df44280-8f19-466d-af91-1002fe7ac79f": { bg: "#bb3354", text: "#ffffff" },
  "240d7b5b-6573-478e-b6e7-3f1cbe29609a": { bg: "#cab641", text: "#1e1e1e" },
  "20bb0156-b275-414a-862a-c374c03ee714": { bg: "#66ccff", text: "#1e1e1e" },
};

const FALLBACK_COLORS = [
  { bg: "#579bfc", text: "#ffffff" },
  { bg: "#037f4c", text: "#ffffff" },
  { bg: "#fdab3d", text: "#1e1e1e" },
  { bg: "#a25ddc", text: "#ffffff" },
  { bg: "#bb3354", text: "#ffffff" },
  { bg: "#ff5ac4", text: "#ffffff" },
];

export interface CategoryGroupStyle {
  bg: string;
  text: string;
}

export function getCategoryGroupStyle(
  masterGroupId: string | null,
  categoryId: string,
): CategoryGroupStyle {
  if (masterGroupId && MASTER_GROUP_STYLES[masterGroupId]) {
    return MASTER_GROUP_STYLES[masterGroupId];
  }

  let hash = 0;
  for (let i = 0; i < categoryId.length; i++) {
    hash = (hash * 31 + categoryId.charCodeAt(i)) >>> 0;
  }
  return FALLBACK_COLORS[hash % FALLBACK_COLORS.length]!;
}
