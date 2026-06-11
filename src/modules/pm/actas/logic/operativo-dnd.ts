import type {
  ActasOperativoCategory,
  ActasOperativoElement,
} from "@/modules/pm/actas/types";

export type OperativoDndContainerKey = string;

export function rootContainerKey(categoryId: string): OperativoDndContainerKey {
  return `container:root:${categoryId}`;
}

export function childContainerKey(parentElementId: string): OperativoDndContainerKey {
  return `container:child:${parentElementId}`;
}

export function nestDropId(parentElementId: string): string {
  return `nest:${parentElementId}`;
}

export function isNestDropId(id: string): boolean {
  return id.startsWith("nest:");
}

export function isContainerId(id: string): boolean {
  return id.startsWith("container:");
}

export function parseContainerKey(key: OperativoDndContainerKey): {
  categoryId: string;
  parentElementId: string | null;
} {
  if (key.startsWith("container:root:")) {
    return { categoryId: key.slice("container:root:".length), parentElementId: null };
  }
  if (key.startsWith("container:child:")) {
    const parentElementId = key.slice("container:child:".length);
    return { categoryId: "", parentElementId };
  }
  throw new Error(`Contenedor DnD inválido: ${key}`);
}

export type FlatOperativoElement = ActasOperativoElement & {
  categoryId: string;
};

export function flattenOperativoElements(
  categories: ActasOperativoCategory[],
): Map<string, FlatOperativoElement> {
  const map = new Map<string, FlatOperativoElement>();

  const walk = (
    list: ActasOperativoElement[],
    categoryId: string,
    parentId: string | null,
  ) => {
    for (const el of list) {
      map.set(el.id, {
        ...el,
        categoryId,
        parentElementId: parentId,
        canHaveSubelements: parentId === null,
      });
      walk(el.children, categoryId, el.id);
    }
  };

  for (const cat of categories) {
    walk(cat.elements, cat.id, null);
  }

  return map;
}

export function buildContainersFromCategories(
  categories: ActasOperativoCategory[],
): Record<OperativoDndContainerKey, string[]> {
  const containers: Record<OperativoDndContainerKey, string[]> = {};

  for (const cat of categories) {
    containers[rootContainerKey(cat.id)] = cat.elements.map((e) => e.id);
    for (const root of cat.elements) {
      containers[childContainerKey(root.id)] = root.children.map((c) => c.id);
    }
  }

  return containers;
}

export function findContainerForElementId(
  elementId: string,
  containers: Record<OperativoDndContainerKey, string[]>,
): OperativoDndContainerKey | null {
  for (const [key, ids] of Object.entries(containers)) {
    if (!key.startsWith("container:")) continue;
    if (ids.includes(elementId)) return key;
  }
  return null;
}

export function resolveCategoryIdForContainer(
  containerKey: OperativoDndContainerKey,
  elementsById: Map<string, FlatOperativoElement>,
): string {
  const parsed = parseContainerKey(containerKey);
  if (parsed.parentElementId === null) {
    return parsed.categoryId;
  }
  const parent = elementsById.get(parsed.parentElementId);
  if (!parent) {
    throw new Error("Padre no encontrado para contenedor hijo");
  }
  return parent.categoryId;
}

export function rebuildCategoriesFromContainers(
  baseCategories: ActasOperativoCategory[],
  containers: Record<OperativoDndContainerKey, string[]>,
  elementsById: Map<string, FlatOperativoElement>,
): ActasOperativoCategory[] {
  const buildNode = (
    elementId: string,
    categoryId: string,
    parentId: string | null,
  ): ActasOperativoElement => {
    const base = elementsById.get(elementId);
    if (!base) {
      throw new Error(`Elemento ${elementId} no encontrado en el estado local`);
    }
    const childIds = containers[childContainerKey(elementId)] ?? [];
    return {
      ...base,
      parentElementId: parentId,
      canHaveSubelements: parentId === null,
      children: childIds.map((childId) => buildNode(childId, categoryId, elementId)),
    };
  };

  return baseCategories.map((cat) => {
    const rootIds = containers[rootContainerKey(cat.id)] ?? [];
    return {
      ...cat,
      elements: rootIds.map((id) => buildNode(id, cat.id, null)),
    };
  });
}

export function moveBetweenContainers(
  containers: Record<OperativoDndContainerKey, string[]>,
  activeId: string,
  sourceKey: OperativoDndContainerKey,
  destKey: OperativoDndContainerKey,
  destIndex: number,
): Record<OperativoDndContainerKey, string[]> {
  const next = { ...containers };
  const sourceItems = [...(next[sourceKey] ?? [])];
  const fromIndex = sourceItems.indexOf(activeId);
  if (fromIndex < 0) return containers;

  sourceItems.splice(fromIndex, 1);
  next[sourceKey] = sourceItems;

  const destItems =
    sourceKey === destKey ? [...sourceItems] : [...(next[destKey] ?? [])];

  const insertAt = Math.max(0, Math.min(destIndex, destItems.length));
  destItems.splice(insertAt, 0, activeId);
  next[destKey] = destItems;

  return next;
}
