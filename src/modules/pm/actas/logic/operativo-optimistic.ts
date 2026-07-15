import type {
  ActasOperativoCategory,
  ActasOperativoElement,
  ElementStatus,
} from "@/modules/pm/actas/types";

export type OperativoOptimisticAction =
  | {
      type: "addElement";
      categoryId: string;
      parentElementId: string | null;
      elementId: string;
      name: string;
    }
  | {
      type: "addCategory";
      categoryId: string;
      name: string;
      displayName: string;
    }
  | {
      type: "removeCategory";
      categoryId: string;
    };

function createOptimisticElement(
  elementId: string,
  name: string,
  parentElementId: string | null,
  orderIndex: number,
): ActasOperativoElement {
  return {
    id: elementId,
    name,
    status: "not_started" as ElementStatus,
    orderIndex,
    parentElementId,
    canHaveSubelements: parentElementId === null,
    owners: [],
    timelineStart: null,
    timelineEnd: null,
    lastEntryContent: null,
    lastEntryDate: null,
    lastEntryId: null,
    lastEntryAuthorId: null,
    lastEntrySource: null,
    children: [],
  };
}

function appendChildToElement(
  element: ActasOperativoElement,
  parentElementId: string,
  child: ActasOperativoElement,
): ActasOperativoElement {
  if (element.id === parentElementId) {
    return {
      ...element,
      children: [...element.children, child],
    };
  }
  return {
    ...element,
    children: element.children.map((c) =>
      appendChildToElement(c, parentElementId, child),
    ),
  };
}

function addElementToCategories(
  categories: ActasOperativoCategory[],
  action: Extract<OperativoOptimisticAction, { type: "addElement" }>,
): ActasOperativoCategory[] {
  return categories.map((cat) => {
    if (cat.id !== action.categoryId) return cat;

    const orderIndex = action.parentElementId
      ? (cat.elements
          .flatMap((r) => r.children)
          .reduce((max, c) => Math.max(max, c.orderIndex), -1) + 1)
      : cat.elements.reduce((max, e) => Math.max(max, e.orderIndex), -1) + 1;

    const element = createOptimisticElement(
      action.elementId,
      action.name,
      action.parentElementId,
      orderIndex,
    );

    if (!action.parentElementId) {
      return { ...cat, elements: [...cat.elements, element] };
    }

    return {
      ...cat,
      elements: cat.elements.map((root) =>
        appendChildToElement(root, action.parentElementId!, element),
      ),
    };
  });
}

function addCategoryToCategories(
  categories: ActasOperativoCategory[],
  action: Extract<OperativoOptimisticAction, { type: "addCategory" }>,
): ActasOperativoCategory[] {
  const maxOrder = categories.reduce(
    (max, c) => Math.max(max, c.orderIndex),
    -1,
  );
  return [
    ...categories,
    {
      id: action.categoryId,
      name: action.name,
      displayName: action.displayName,
      orderIndex: maxOrder + 1,
      sublotLabel: null,
      masterGroupId: null,
      elements: [],
    },
  ];
}

export function applyOperativoOptimisticAction(
  current: ActasOperativoCategory[],
  action: OperativoOptimisticAction,
): ActasOperativoCategory[] {
  switch (action.type) {
    case "addElement":
      return addElementToCategories(current, action);
    case "addCategory":
      return addCategoryToCategories(current, action);
    case "removeCategory":
      return current.filter((cat) => cat.id !== action.categoryId);
    default:
      return current;
  }
}
