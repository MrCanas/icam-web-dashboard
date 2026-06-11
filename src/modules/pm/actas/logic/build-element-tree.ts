import type { ActasOperativoElement } from "@/modules/pm/actas/types";

type FlatElement = Omit<ActasOperativoElement, "children">;

/** Ordena por order_index y anida hijos bajo su padre (árbol por categoría). */
export function buildElementTree(flat: FlatElement[]): ActasOperativoElement[] {
  const nodes = new Map<string, ActasOperativoElement>();
  for (const el of flat) {
    nodes.set(el.id, { ...el, children: [] });
  }

  const roots: ActasOperativoElement[] = [];

  for (const el of flat) {
    const node = nodes.get(el.id)!;
    if (el.parentElementId && nodes.has(el.parentElementId)) {
      nodes.get(el.parentElementId)!.children.push(node);
    } else {
      roots.push(node);
    }
  }

  const sortRec = (list: ActasOperativoElement[]) => {
    list.sort((a, b) => a.orderIndex - b.orderIndex);
    for (const n of list) sortRec(n.children);
  };
  sortRec(roots);

  return roots;
}
