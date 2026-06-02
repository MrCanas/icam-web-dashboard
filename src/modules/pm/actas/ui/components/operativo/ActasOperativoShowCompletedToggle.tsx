"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback } from "react";

export const SHOW_DONE_QUERY = "showDone";

export function useShowCompletedOperativo(): {
  showCompleted: boolean;
  setShowCompleted: (value: boolean) => void;
} {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const showCompleted = searchParams.get(SHOW_DONE_QUERY) === "1";

  const setShowCompleted = useCallback(
    (value: boolean) => {
      const params = new URLSearchParams(searchParams.toString());
      if (value) {
        params.set(SHOW_DONE_QUERY, "1");
      } else {
        params.delete(SHOW_DONE_QUERY);
      }
      const qs = params.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    },
    [pathname, router, searchParams],
  );

  return { showCompleted, setShowCompleted };
}

interface ActasOperativoShowCompletedToggleProps {
  className?: string;
}

export function ActasOperativoShowCompletedToggle({
  className = "",
}: ActasOperativoShowCompletedToggleProps) {
  const { showCompleted, setShowCompleted } = useShowCompletedOperativo();

  return (
    <label
      className={`inline-flex cursor-pointer select-none items-center gap-2 rounded-md border border-subtle/60 bg-card px-3 py-2 text-sm text-text-body shadow-sm ${className}`}
    >
      <input
        type="checkbox"
        checked={showCompleted}
        onChange={(e) => setShowCompleted(e.target.checked)}
        className="rounded border-subtle text-icam-900 focus:ring-icam-900/30"
      />
      <span>Mostrar completados</span>
    </label>
  );
}
