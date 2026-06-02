"use client";

import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { useRouter } from "next/navigation";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  useTransition,
  type ReactNode,
} from "react";

import { moveElement } from "@/modules/pm/actas/actions/move-element";
import {
  buildContainersFromCategories,
  childContainerKey,
  findContainerForElementId,
  flattenOperativoElements,
  isContainerId,
  isNestDropId,
  moveBetweenContainers,
  nestDropId,
  parseContainerKey,
  rebuildCategoriesFromContainers,
  resolveCategoryIdForContainer,
  rootContainerKey,
  type FlatOperativoElement,
  type OperativoDndContainerKey,
} from "@/modules/pm/actas/logic/operativo-dnd";
import type { ActasOperativoCategory } from "@/modules/pm/actas/types";

type OperativoDndContextValue = {
  enabled: true;
  activeDragId: string | null;
  containers: Record<OperativoDndContainerKey, string[]>;
  elementsById: Map<string, FlatOperativoElement>;
};

const OperativoDndCtx = createContext<OperativoDndContextValue | null>(null);

export function useOperativoDnd(): OperativoDndContextValue | null {
  return useContext(OperativoDndCtx);
}

interface ActasOperativoDndProviderProps {
  projectId: string;
  projectCode: string;
  baseCategories: ActasOperativoCategory[];
  onCategoriesChange: (categories: ActasOperativoCategory[]) => void;
  onMutatingChange?: (mutating: boolean) => void;
  onError: (message: string) => void;
  children: ReactNode;
}

export function ActasOperativoDndProvider({
  projectId,
  projectCode,
  baseCategories,
  onCategoriesChange,
  onMutatingChange,
  onError,
  children,
}: ActasOperativoDndProviderProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [activeDragId, setActiveDragId] = useState<string | null>(null);
  const [containers, setContainers] = useState(() =>
    buildContainersFromCategories(baseCategories),
  );

  const elementsById = useMemo(
    () => flattenOperativoElements(baseCategories),
    [baseCategories],
  );

  useEffect(() => {
    setContainers(buildContainersFromCategories(baseCategories));
  }, [baseCategories]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  const applyContainers = useCallback(
    (nextContainers: Record<OperativoDndContainerKey, string[]>) => {
      setContainers(nextContainers);
      onCategoriesChange(
        rebuildCategoriesFromContainers(
          baseCategories,
          nextContainers,
          elementsById,
        ),
      );
    },
    [baseCategories, elementsById, onCategoriesChange],
  );

  const handleDragStart = (event: DragStartEvent) => {
    setActiveDragId(String(event.active.id));
  };

  const handleDragEnd = (event: DragEndEvent) => {
    setActiveDragId(null);
    const { active, over } = event;
    if (!over || pending) return;

    const activeId = String(active.id);
    const overId = String(over.id);
    if (activeId === overId) return;

    const sourceKey = findContainerForElementId(activeId, containers);
    if (!sourceKey) return;

    let destKey: OperativoDndContainerKey;
    let destIndex: number;

    if (isNestDropId(overId)) {
      const parentId = overId.slice("nest:".length);
      destKey = childContainerKey(parentId);
      destIndex = containers[destKey]?.length ?? 0;
    } else if (isContainerId(overId)) {
      destKey = overId as OperativoDndContainerKey;
      destIndex = containers[destKey]?.length ?? 0;
    } else {
      destKey = findContainerForElementId(overId, containers) ?? sourceKey;
      const overIndex = containers[destKey]?.indexOf(overId) ?? -1;
      destIndex = overIndex >= 0 ? overIndex : (containers[destKey]?.length ?? 0);
    }

    let nextContainers: Record<OperativoDndContainerKey, string[]>;

    if (sourceKey === destKey && !isNestDropId(overId) && !isContainerId(overId)) {
      const items = containers[sourceKey] ?? [];
      const oldIndex = items.indexOf(activeId);
      const newIndex = items.indexOf(overId);
      if (oldIndex < 0 || newIndex < 0) return;
      nextContainers = {
        ...containers,
        [sourceKey]: arrayMove(items, oldIndex, newIndex),
      };
    } else {
      nextContainers = moveBetweenContainers(
        containers,
        activeId,
        sourceKey,
        destKey,
        destIndex,
      );
    }

    const targetCategoryId = resolveCategoryIdForContainer(destKey, elementsById);
    const { parentElementId: targetParentElementId } = parseContainerKey(destKey);
    const orderedSiblingIds = nextContainers[destKey] ?? [];

    const previousContainers = containers;
    applyContainers(nextContainers);

    startTransition(async () => {
      onMutatingChange?.(true);
      try {
        const result = await moveElement({
          projectId,
          projectCode,
          elementId: activeId,
          targetCategoryId,
          targetParentElementId,
          orderedSiblingIds,
        });

        if (!result.ok) {
          setContainers(previousContainers);
          onCategoriesChange(
            rebuildCategoriesFromContainers(
              baseCategories,
              previousContainers,
              elementsById,
            ),
          );
          onError(result.error);
          return;
        }

        router.refresh();
      } finally {
        onMutatingChange?.(false);
      }
    });
  };

  const handleDragCancel = () => {
    setActiveDragId(null);
  };

  const ctxValue = useMemo<OperativoDndContextValue>(
    () => ({
      enabled: true,
      activeDragId,
      containers,
      elementsById,
    }),
    [activeDragId, containers, elementsById],
  );

  return (
    <OperativoDndCtx.Provider value={ctxValue}>
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
        onDragCancel={handleDragCancel}
      >
        <div className={pending ? "pointer-events-none opacity-80" : undefined}>
          {children}
        </div>
        <DragOverlay dropAnimation={null}>
          {activeDragId ? (
            <div className="rounded-md border border-icam-900/30 bg-card px-3 py-2 text-sm font-medium text-icam-900 shadow-lg">
              {elementsById.get(activeDragId)?.name ?? "Elemento"}
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>
    </OperativoDndCtx.Provider>
  );
}

export function OperativoElementSortableList({
  containerKey,
  categoryId,
  parentElementId,
  children,
}: {
  containerKey: OperativoDndContainerKey;
  categoryId: string;
  parentElementId: string | null;
  children: (itemIds: string[]) => ReactNode;
}) {
  const dnd = useOperativoDnd();
  const itemIds = dnd?.containers[containerKey] ?? [];

  if (!dnd?.enabled) {
    return <>{children(itemIds)}</>;
  }

  return (
    <SortableContext items={itemIds} strategy={verticalListSortingStrategy}>
      {children(itemIds)}
    </SortableContext>
  );
}

export function OperativoRootContainerKey(categoryId: string) {
  return rootContainerKey(categoryId);
}

export function OperativoChildContainerKey(parentElementId: string) {
  return childContainerKey(parentElementId);
}

export function OperativoNestDropId(parentElementId: string) {
  return nestDropId(parentElementId);
}
