import type {
  ActasOperativoCategory,
  ActasOperativoElement,
} from "@/modules/pm/actas/types";

export function findOperativoElementInTree(
  elements: ActasOperativoElement[],
  elementId: string,
): ActasOperativoElement | null {
  for (const element of elements) {
    if (element.id === elementId) return element;
    const nested = findOperativoElementInTree(element.children, elementId);
    if (nested) return nested;
  }
  return null;
}

export function findOperativoElementInCategories(
  categories: ActasOperativoCategory[],
  elementId: string,
): ActasOperativoElement | null {
  for (const category of categories) {
    const found = findOperativoElementInTree(category.elements, elementId);
    if (found) return found;
  }
  return null;
}
