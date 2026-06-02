import type { ActasOperativoCategory } from "@/modules/pm/actas/types";

export type ActasRootElementOption = {
  id: string;
  name: string;
  categoryId: string;
  categoryName: string;
};

export function collectRootElementOptions(
  categories: ActasOperativoCategory[],
): ActasRootElementOption[] {
  const out: ActasRootElementOption[] = [];
  for (const cat of categories) {
    for (const el of cat.elements) {
      if (el.canHaveSubelements) {
        out.push({
          id: el.id,
          name: el.name,
          categoryId: cat.id,
          categoryName: cat.displayName,
        });
      }
    }
  }
  return out;
}
