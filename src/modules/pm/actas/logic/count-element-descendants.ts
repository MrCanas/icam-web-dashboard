import type { ActasOperativoElement } from "@/modules/pm/actas/types";

/** Cuenta sub-elementos directos e indirectos (para el modal de archivar). */
export function countElementDescendants(element: ActasOperativoElement): number {
  let n = 0;
  for (const child of element.children) {
    n += 1 + countElementDescendants(child);
  }
  return n;
}
