"use client";

import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useState, useTransition } from "react";

import { reorderProjects } from "@/modules/pm/actas/actions/reorder-projects";
import { actasProjectPath } from "@/modules/pm/actas/logic/actas-paths";
import type { ActasProjectListItem } from "@/modules/pm/actas/types";

import { ActasProjectSidebarItem } from "./ActasProjectSidebarItem";

interface ActasSortableProjectListProps {
  projects: ActasProjectListItem[];
  onDuplicate: (project: ActasProjectListItem) => void;
  onArchive: (project: ActasProjectListItem) => void;
  onReorderError?: (message: string) => void;
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

interface SortableRowProps {
  project: ActasProjectListItem;
  active: boolean;
  onDuplicate: (project: ActasProjectListItem) => void;
  onArchive: (project: ActasProjectListItem) => void;
}

function SortableProjectRow({
  project,
  active,
  onDuplicate,
  onArchive,
}: SortableRowProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: project.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`flex items-stretch gap-0.5 ${isDragging ? "z-20 opacity-90" : ""}`}
    >
      <button
        type="button"
        ref={setActivatorNodeRef}
        className="mt-2 flex h-8 w-7 shrink-0 cursor-grab items-center justify-center rounded-md text-text-muted hover:bg-page hover:text-icam-900 active:cursor-grabbing touch-none"
        aria-label={`Reordenar ${project.code}`}
        {...attributes}
        {...listeners}
      >
        <DragHandleIcon />
      </button>
      <div className="min-w-0 flex-1">
        <ActasProjectSidebarItem
          project={project}
          active={active}
          onDuplicate={onDuplicate}
          onArchive={onArchive}
        />
      </div>
    </div>
  );
}

export function ActasSortableProjectList({
  projects,
  onDuplicate,
  onArchive,
  onReorderError,
}: ActasSortableProjectListProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [ordered, setOrdered] = useState(projects);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    setOrdered(projects);
  }, [projects]);

  const projectIds = useMemo(() => ordered.map((p) => p.id), [ordered]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = ordered.findIndex((p) => p.id === active.id);
    const newIndex = ordered.findIndex((p) => p.id === over.id);
    if (oldIndex < 0 || newIndex < 0) return;

    const next = [...ordered];
    const [moved] = next.splice(oldIndex, 1);
    next.splice(newIndex, 0, moved!);
    setOrdered(next);

    startTransition(async () => {
      const result = await reorderProjects({
        orderedProjectIds: next.map((p) => p.id),
      });
      if (!result.ok) {
        setOrdered(projects);
        onReorderError?.(result.error);
        return;
      }
      router.refresh();
    });
  };

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragEnd={handleDragEnd}
    >
      <SortableContext items={projectIds} strategy={verticalListSortingStrategy}>
        <div
          className={`flex flex-col gap-0.5 ${pending ? "pointer-events-none opacity-70" : ""}`}
          aria-busy={pending}
        >
          {ordered.map((project) => {
            const href = actasProjectPath(project.code);
            const active =
              pathname === href || pathname.startsWith(`${href}/`);
            return (
              <SortableProjectRow
                key={project.id}
                project={project}
                active={active}
                onDuplicate={onDuplicate}
                onArchive={onArchive}
              />
            );
          })}
        </div>
      </SortableContext>
    </DndContext>
  );
}
