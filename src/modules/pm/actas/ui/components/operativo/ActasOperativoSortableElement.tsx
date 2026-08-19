"use client";

import { useDroppable } from "@dnd-kit/core";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type { ReactNode } from "react";

import { nestDropId } from "@/modules/pm/actas/logic/operativo-dnd";

import { useOperativoDnd } from "./ActasOperativoDndContext";

export type ElementDragHandleProps = {
  ref: (node: HTMLElement | null) => void;
  onPointerDown: (event: React.PointerEvent) => void;
  onKeyDown: (event: React.KeyboardEvent) => void;
  "aria-describedby"?: string;
  tabIndex?: number;
  role?: string;
};

interface ActasOperativoSortableElementProps {
  elementId: string;
  /** Raíz con capacidad de anidar: muestra zona «soltar como sub-elemento». */
  showNestDropZone?: boolean;
  children: (opts: {
    dragHandle: ReactNode;
    isDragging: boolean;
  }) => ReactNode;
}

function DragHandleIcon() {
  return (
    <svg width="12" height="16" viewBox="0 0 12 16" fill="currentColor" aria-hidden>
      <circle cx="3" cy="3" r="1.25" />
      <circle cx="9" cy="3" r="1.25" />
      <circle cx="3" cy="8" r="1.25" />
      <circle cx="9" cy="8" r="1.25" />
      <circle cx="3" cy="13" r="1.25" />
      <circle cx="9" cy="13" r="1.25" />
    </svg>
  );
}

function NestDropZone({ parentElementId }: { parentElementId: string }) {
  const dnd = useOperativoDnd();
  const { setNodeRef, isOver } = useDroppable({
    id: nestDropId(parentElementId),
    disabled: !dnd?.enabled,
  });

  if (!dnd?.enabled) return null;

  const draggingOther =
    dnd.activeDragId != null && dnd.activeDragId !== parentElementId;

  if (!draggingOther) return null;

  return (
    <div
      ref={setNodeRef}
      className={`mx-3 mb-1 rounded border border-dashed px-2 py-1 text-[11px] transition-colors ${
        isOver
          ? "border-icam-900 bg-icam-900/10 text-icam-900"
          : "border-subtle/60 text-text-muted"
      }`}
    >
      Soltar como sub-elemento
    </div>
  );
}

export function ActasOperativoSortableElement(props: ActasOperativoSortableElementProps) {
  const dnd = useOperativoDnd();

  // Con el drag&drop desactivado no se monta el cuerpo que usa useSortable. La
  // decisión es QUÉ componente renderizar, no si llamar un hook: así ningún hook
  // queda detrás de un return condicional (antes rompía las reglas de hooks y
  // podía tumbar el tablero al cambiar `enabled`).
  if (!dnd?.enabled) {
    return <>{props.children({ dragHandle: null, isDragging: false })}</>;
  }
  return <SortableElementBody {...props} />;
}

function SortableElementBody({
  elementId,
  showNestDropZone = false,
  children,
}: ActasOperativoSortableElementProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: elementId });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const dragHandle = (
    <button
      type="button"
      ref={setActivatorNodeRef}
      className="flex h-7 w-6 shrink-0 cursor-grab items-center justify-center rounded text-text-muted hover:bg-icam-900/10 hover:text-icam-900 active:cursor-grabbing touch-none"
      aria-label="Arrastrar elemento"
      {...attributes}
      {...listeners}
      onClick={(e) => e.stopPropagation()}
    >
      <DragHandleIcon />
    </button>
  );

  return (
    <div ref={setNodeRef} style={style} className={isDragging ? "opacity-40" : undefined}>
      {children({ dragHandle, isDragging })}
      {showNestDropZone ? <NestDropZone parentElementId={elementId} /> : null}
    </div>
  );
}
