"use client";

import { useDroppable } from "@dnd-kit/core";
import type { ReactNode } from "react";

import type { OperativoDndContainerKey } from "@/modules/pm/actas/logic/operativo-dnd";

import { useOperativoDnd } from "./ActasOperativoDndContext";

interface ActasOperativoElementContainerProps {
  containerKey: OperativoDndContainerKey;
  children: ReactNode;
  className?: string;
}

export function ActasOperativoElementContainer({
  containerKey,
  children,
  className,
}: ActasOperativoElementContainerProps) {
  const dnd = useOperativoDnd();
  const { setNodeRef, isOver } = useDroppable({
    id: containerKey,
    disabled: !dnd?.enabled,
  });

  return (
    <div
      ref={dnd?.enabled ? setNodeRef : undefined}
      className={`${className ?? ""} ${
        dnd?.enabled && isOver ? "ring-1 ring-inset ring-icam-900/25 rounded-sm" : ""
      }`}
    >
      {children}
    </div>
  );
}
