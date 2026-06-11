"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

import { actasProjectPath } from "@/modules/pm/actas/logic/actas-paths";
import type { ActasProjectListItem } from "@/modules/pm/actas/types";

import { ActasProjectPhaseBadge } from "./ActasProjectPhaseBadge";

interface ActasProjectSidebarItemProps {
  project: ActasProjectListItem;
  active: boolean;
  onDuplicate: (project: ActasProjectListItem) => void;
  onArchive: (project: ActasProjectListItem) => void;
}

function KebabIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="currentColor"
      aria-hidden
    >
      <circle cx="8" cy="3" r="1.25" />
      <circle cx="8" cy="8" r="1.25" />
      <circle cx="8" cy="13" r="1.25" />
    </svg>
  );
}

export function ActasProjectSidebarItem({
  project,
  active,
  onDuplicate,
  onArchive,
}: ActasProjectSidebarItemProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const href = actasProjectPath(project.code);

  useEffect(() => {
    if (!menuOpen) return;
    const onPointerDown = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMenuOpen(false);
    };
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [menuOpen]);

  return (
    <div
      className={`group relative flex items-stretch rounded-md border transition ${
        active
          ? "border-icam-900/40 bg-icam-900/5 shadow-sm"
          : "border-transparent hover:border-subtle/50 hover:bg-page"
      }`}
    >
      <Link
        href={href}
        className="flex min-w-0 flex-1 flex-col gap-1 px-3 py-2.5 pr-1 text-left"
      >
        <div className="flex items-start justify-between gap-2">
          <span className="font-mono text-xs font-semibold text-icam-900">
            {project.code}
          </span>
          <ActasProjectPhaseBadge phase={project.phase} />
        </div>
        <span className="text-sm leading-snug text-text-primary line-clamp-2 pr-6">
          {project.name}
        </span>
      </Link>

      <div
        ref={menuRef}
        className={`absolute right-1 top-2 z-10 transition-opacity ${
          menuOpen ? "opacity-100" : "opacity-0 group-hover:opacity-100 focus-within:opacity-100"
        }`}
      >
        <button
          type="button"
          aria-label={`Opciones de ${project.code}`}
          aria-expanded={menuOpen}
          aria-haspopup="menu"
          className="flex h-8 w-8 items-center justify-center rounded-md text-text-muted hover:bg-icam-900/10 hover:text-icam-900"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setMenuOpen((v) => !v);
          }}
        >
          <KebabIcon />
        </button>

        {menuOpen ? (
          <div
            role="menu"
            className="absolute right-0 top-full mt-0.5 min-w-[11rem] rounded-md border border-subtle/60 bg-card py-1 shadow-lg"
          >
            <button
              type="button"
              role="menuitem"
              className="w-full px-3 py-2 text-left text-sm text-text-primary hover:bg-page"
              onClick={(e) => {
                e.stopPropagation();
                setMenuOpen(false);
                onDuplicate(project);
              }}
            >
              Duplicar proyecto…
            </button>
            <button
              type="button"
              role="menuitem"
              className="w-full px-3 py-2 text-left text-sm text-text-primary hover:bg-page"
              onClick={(e) => {
                e.stopPropagation();
                setMenuOpen(false);
                onArchive(project);
              }}
            >
              Archivar proyecto
            </button>
          </div>
        ) : null}
      </div>
    </div>
  );
}
