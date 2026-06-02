"use client";

import { useCallback, useEffect, useState } from "react";

import {
  readActasSidebarCollapsed,
  writeActasSidebarCollapsed,
} from "@/modules/pm/actas/logic/actas-ui-cookie";
import type { ActasProjectListItem } from "@/modules/pm/actas/types";

import { ActasProjectSidebar } from "./ActasProjectSidebar";

interface ActasCollapsibleLayoutProps {
  projects: ActasProjectListItem[];
  archivedCount: number;
  hasWriteAccess?: boolean;
  children: React.ReactNode;
}

export function ActasCollapsibleLayout({
  projects,
  archivedCount,
  hasWriteAccess = true,
  children,
}: ActasCollapsibleLayoutProps) {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  useEffect(() => {
    setSidebarCollapsed(readActasSidebarCollapsed());
  }, []);

  const toggleSidebar = useCallback(() => {
    setSidebarCollapsed((prev) => {
      const next = !prev;
      writeActasSidebarCollapsed(next);
      return next;
    });
  }, []);

  return (
    <div className="flex flex-1 min-h-0 min-w-0 flex-col gap-4 lg:flex-row lg:gap-3">
      <div
        className={`relative shrink-0 transition-[width] duration-200 ease-out ${
          sidebarCollapsed ? "w-full lg:w-11" : "w-full lg:w-72"
        }`}
      >
        <button
          type="button"
          onClick={toggleSidebar}
          className={`absolute z-10 flex h-8 w-8 items-center justify-center rounded-md border border-subtle/60 bg-card text-sm text-text-muted shadow-sm hover:bg-page hover:text-icam-900 ${
            sidebarCollapsed
              ? "left-1/2 top-2 -translate-x-1/2 lg:left-1/2"
              : "right-2 top-2 lg:-right-4 lg:translate-x-0"
          }`}
          aria-expanded={!sidebarCollapsed}
          aria-label={
            sidebarCollapsed
              ? "Expandir lista de proyectos"
              : "Colapsar lista de proyectos"
          }
        >
          {sidebarCollapsed ? "»" : "«"}
        </button>

        {sidebarCollapsed ? (
          <>
            <div
              className="flex h-10 items-center justify-center rounded-lg border border-subtle/50 bg-card lg:hidden"
              aria-hidden
            />
            <aside
              className="hidden lg:block min-h-[10rem] rounded-lg border border-subtle/50 bg-card"
              aria-hidden
            />
          </>
        ) : (
          <ActasProjectSidebar
            projects={projects}
            archivedCount={archivedCount}
            hasWriteAccess={hasWriteAccess}
          />
        )}
      </div>

      <div className="flex-1 min-w-0">{children}</div>
    </div>
  );
}
