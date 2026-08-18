"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useId, useRef, useState } from "react";

import { actasProjectOperativoPath } from "@/modules/pm/actas/logic/actas-paths";
import {
  formatAsOfDisplay,
  parseAsOfDateParam,
} from "@/modules/pm/actas/logic/operativo-asof";
import { useActasBasePath } from "@/modules/pm/actas/ui/ActasBasePathContext";

interface ActasOperativoAsOfPickerProps {
  projectCode: string;
}

export function ActasOperativoAsOfPicker({
  projectCode,
}: ActasOperativoAsOfPickerProps) {
  const basePath = useActasBasePath();
  const router = useRouter();
  const searchParams = useSearchParams();
  const inputId = useId();
  const panelRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);

  const asOfParam = searchParams.get("asOf") ?? "";
  const parsedAsOf = parseAsOfDateParam(asOfParam || undefined);

  useEffect(() => {
    const onPointerDown = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, []);

  const navigateAsOf = (isoDate: string | null) => {
    setOpen(false);
    if (isoDate) {
      router.push(actasProjectOperativoPath(projectCode, { asOf: isoDate, basePath }));
    } else {
      router.push(actasProjectOperativoPath(projectCode, { basePath }));
    }
  };

  return (
    <div ref={panelRef} className="relative shrink-0">
      <button
        type="button"
        className={`flex h-9 w-9 items-center justify-center rounded-md border text-base transition-colors ${
          parsedAsOf
            ? "border-amber-400/60 bg-amber-50 text-amber-900"
            : "border-subtle/60 bg-page text-text-muted hover:border-icam-900/30 hover:text-icam-900"
        }`}
        aria-expanded={open}
        aria-controls={`${inputId}-panel`}
        title="Ver estado en fecha…"
        onClick={() => setOpen((v) => !v)}
      >
        <span aria-hidden>📅</span>
        <span className="sr-only">Ver estado en fecha</span>
      </button>

      {open ? (
        <div
          id={`${inputId}-panel`}
          className="absolute right-0 top-full z-20 mt-1 w-64 rounded-md border border-subtle/60 bg-card p-3 shadow-lg"
        >
          <label
            htmlFor={inputId}
            className="block text-xs font-medium text-text-muted mb-1.5"
          >
            Ver estado en fecha…
          </label>
          <input
            id={inputId}
            type="date"
            className="w-full rounded-md border border-subtle/60 bg-page px-2 py-1.5 text-sm text-text-primary"
            defaultValue={parsedAsOf ?? ""}
            onChange={(e) => {
              const v = e.target.value;
              if (!v) {
                navigateAsOf(null);
                return;
              }
              const iso = parseAsOfDateParam(v);
              if (iso) navigateAsOf(iso);
            }}
          />
          {parsedAsOf ? (
            <p className="mt-2 text-[11px] text-text-muted">
              Viendo snapshot del {formatAsOfDisplay(parsedAsOf)}.
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
