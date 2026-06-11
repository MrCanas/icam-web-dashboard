import type {
  ActasOperativoCategory,
  ActasOperativoElement,
} from "@/modules/pm/actas/types";

function mergeElementNode(
  fullNode: ActasOperativoElement | undefined,
  visibleNode: ActasOperativoElement,
): ActasOperativoElement {
  const visibleChildIds = new Set(visibleNode.children.map((c) => c.id));
  const hiddenChildren =
    fullNode?.children.filter((c) => !visibleChildIds.has(c.id)) ?? [];

  const mergedChildren = visibleNode.children.map((visChild) => {
    const fullChild = fullNode?.children.find((c) => c.id === visChild.id);
    return mergeElementNode(fullChild, visChild);
  });

  return {
    ...(fullNode ?? visibleNode),
    ...visibleNode,
    children: [...mergedChildren, ...hiddenChildren],
  };
}

function mergeRootElements(
  fullRoots: ActasOperativoElement[],
  visibleRoots: ActasOperativoElement[],
): ActasOperativoElement[] {
  const fullById = new Map(fullRoots.map((r) => [r.id, r]));
  const visibleIds = new Set(visibleRoots.map((r) => r.id));
  const merged = visibleRoots.map((vis) =>
    mergeElementNode(fullById.get(vis.id), vis),
  );
  const hiddenRoots = fullRoots.filter((r) => !visibleIds.has(r.id));
  return [...merged, ...hiddenRoots];
}

/** Conserva elementos ocultos (p. ej. «Hecho» sin mostrar) al aplicar cambios del árbol visible. */
export function mergeVisibleOperativoTrees(
  fullCategories: ActasOperativoCategory[],
  visibleCategories: ActasOperativoCategory[],
): ActasOperativoCategory[] {
  const visibleById = new Map(visibleCategories.map((c) => [c.id, c]));

  return fullCategories.map((fullCat) => {
    const visibleCat = visibleById.get(fullCat.id);
    if (!visibleCat) return fullCat;
    return {
      ...fullCat,
      elements: mergeRootElements(fullCat.elements, visibleCat.elements),
    };
  });
}
