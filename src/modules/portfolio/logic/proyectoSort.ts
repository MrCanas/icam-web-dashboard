import type { Proyecto } from "@/modules/portfolio/types";

export type SortKey = "inversion" | "tir" | "multiplo" | "beneficio";

function toNumber(value: number | null): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

export function sanitizeSort(sort?: string): SortKey {
  if (sort === "tir" || sort === "multiplo" || sort === "beneficio") {
    return sort;
  }
  return "inversion";
}

export function sortProjects(data: Proyecto[], sort: SortKey): Proyecto[] {
  const list = [...data];

  switch (sort) {
    case "tir":
      return list.sort((a, b) => toNumber(b.tir_desp_is) - toNumber(a.tir_desp_is));
    case "multiplo":
      return list.sort((a, b) => toNumber(b.multiplo) - toNumber(a.multiplo));
    case "beneficio":
      return list.sort((a, b) => toNumber(b.beneficios) - toNumber(a.beneficios));
    case "inversion":
    default:
      return list.sort((a, b) => toNumber(b.inversion_total) - toNumber(a.inversion_total));
  }
}
