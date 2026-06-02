export type ElementParentRow = {
  id: string;
  parentElementId: string | null;
};

/** Un elemento no puede colgar de sí mismo ni de ningún descendiente. */
export function wouldCreateParentCycle(
  elementId: string,
  newParentElementId: string | null,
  parentById: Map<string, string | null>,
): boolean {
  if (!newParentElementId) return false;

  let current: string | null = newParentElementId;
  while (current) {
    if (current === elementId) return true;
    current = parentById.get(current) ?? null;
  }
  return false;
}

export function countDirectChildren(
  elementId: string,
  parentById: Map<string, string | null>,
): number {
  let count = 0;
  for (const [, parentId] of parentById) {
    if (parentId === elementId) count += 1;
  }
  return count;
}
