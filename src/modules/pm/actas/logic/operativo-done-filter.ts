import type {
  ActasOperativoCategory,
  ActasOperativoElement,
  ElementStatus,
} from "@/modules/pm/actas/types";

export function getEffectiveElementStatus(
  element: ActasOperativoElement,
  statusOverrides: Record<string, ElementStatus>,
): ElementStatus {
  return statusOverrides[element.id] ?? element.status;
}

export function isDoneStatus(status: ElementStatus): boolean {
  return status === "done";
}

export function shouldShowInOperativoBoard(
  status: ElementStatus,
  showCompleted: boolean,
): boolean {
  if (!isDoneStatus(status)) return true;
  return showCompleted;
}

function filterElementTree(
  elements: ActasOperativoElement[],
  showCompleted: boolean,
  statusOverrides: Record<string, ElementStatus>,
): ActasOperativoElement[] {
  const result: ActasOperativoElement[] = [];

  for (const element of elements) {
    const status = getEffectiveElementStatus(element, statusOverrides);
    const children = filterElementTree(
      element.children,
      showCompleted,
      statusOverrides,
    );

    if (!shouldShowInOperativoBoard(status, showCompleted)) {
      // Hecho fuera del tablero: al ocultar un elemento "done" se va con TODO su
      // subárbol (no promocionamos sus hijos al nivel del padre). Marcar Hecho un
      // padre lo archiva con sus sub-elementos.
      continue;
    }

    result.push({
      ...element,
      status,
      children,
    });
  }

  return result;
}

export function filterOperativoCategories(
  categories: ActasOperativoCategory[],
  showCompleted: boolean,
  statusOverrides: Record<string, ElementStatus> = {},
): ActasOperativoCategory[] {
  const filtered: ActasOperativoCategory[] = [];

  for (const category of categories) {
    const elements = filterElementTree(
      category.elements,
      showCompleted,
      statusOverrides,
    );
    if (!showCompleted && elements.length === 0) {
      continue;
    }
    filtered.push({ ...category, elements });
  }

  return filtered;
}

export type ActasDoneElementRef = {
  element: ActasOperativoElement;
  categoryId: string;
  categoryDisplayName: string;
  depth: number;
};

function walkDoneElements(
  elements: ActasOperativoElement[],
  category: ActasOperativoCategory,
  statusOverrides: Record<string, ElementStatus>,
  depth: number,
  out: ActasDoneElementRef[],
  parentDone = false,
): void {
  for (const element of elements) {
    const status = getEffectiveElementStatus(element, statusOverrides);
    const done = isDoneStatus(status);
    // Si el padre está Hecho, todo su subárbol se muestra en Completados (se
    // archiva con sus sub-elementos), aunque algún hijo no esté Hecho.
    if (done || parentDone) {
      out.push({
        element: { ...element, status },
        categoryId: category.id,
        categoryDisplayName: category.displayName,
        depth,
      });
    }
    walkDoneElements(
      element.children,
      category,
      statusOverrides,
      depth + 1,
      out,
      done || parentDone,
    );
  }
}

export function collectDoneElements(
  categories: ActasOperativoCategory[],
  statusOverrides: Record<string, ElementStatus> = {},
): ActasDoneElementRef[] {
  const out: ActasDoneElementRef[] = [];
  for (const category of categories) {
    walkDoneElements(category.elements, category, statusOverrides, 0, out);
  }
  return out;
}

export function groupDoneElementsByCategory(
  items: ActasDoneElementRef[],
): Map<string, { displayName: string; items: ActasDoneElementRef[] }> {
  const map = new Map<
    string,
    { displayName: string; items: ActasDoneElementRef[] }
  >();
  for (const item of items) {
    const group = map.get(item.categoryId);
    if (group) {
      group.items.push(item);
    } else {
      map.set(item.categoryId, {
        displayName: item.categoryDisplayName,
        items: [item],
      });
    }
  }
  return map;
}

export type SplitOperativoCategory = {
  category: ActasOperativoCategory;
  activeElements: ActasOperativoElement[];
  completedElements: ActasDoneElementRef[];
};

/** Separa elementos activos y completados por categoría (tablero operativo). */
export function splitOperativoCategory(
  category: ActasOperativoCategory,
  statusOverrides: Record<string, ElementStatus> = {},
): SplitOperativoCategory {
  const activeElements = filterElementTree(
    category.elements,
    false,
    statusOverrides,
  );
  const completedElements: ActasDoneElementRef[] = [];
  walkDoneElements(category.elements, category, statusOverrides, 0, completedElements);
  return { category, activeElements, completedElements };
}

export function splitOperativoCategories(
  categories: ActasOperativoCategory[],
  statusOverrides: Record<string, ElementStatus> = {},
): SplitOperativoCategory[] {
  // Renderizamos TODAS las categorías del proyecto, incluidas las vacías: un
  // grupo recién creado (sin elementos) debe aparecer con su cabecera y su
  // botón "Añadir elemento". No filtramos por contenido.
  return categories.map((category) =>
    splitOperativoCategory(category, statusOverrides),
  );
}
