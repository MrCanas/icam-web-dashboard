"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import type { ElementStatus } from "@/modules/pm/actas/types";

type ActasOperativoSelectionContextValue = {
  enabled: boolean;
  selectedIds: Set<string>;
  selectionActive: boolean;
  liveStatusById: Record<string, ElementStatus>;
  isSelected: (elementId: string) => boolean;
  toggle: (elementId: string) => void;
  clearAll: () => void;
  applyStatusLive: (elementIds: string[], status: ElementStatus) => void;
};

const ActasOperativoSelectionContext =
  createContext<ActasOperativoSelectionContextValue | null>(null);

export function useOperativoSelection(): ActasOperativoSelectionContextValue | null {
  return useContext(ActasOperativoSelectionContext);
}

interface ActasOperativoSelectionProviderProps {
  enabled: boolean;
  onStatusLiveChange: (elementId: string, status: ElementStatus) => void;
  children: ReactNode;
}

export function ActasOperativoSelectionProvider({
  enabled,
  onStatusLiveChange,
  children,
}: ActasOperativoSelectionProviderProps) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());
  const [liveStatusById, setLiveStatusById] = useState<
    Record<string, ElementStatus>
  >({});

  const toggle = useCallback((elementId: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(elementId)) {
        next.delete(elementId);
      } else {
        next.add(elementId);
      }
      return next;
    });
  }, []);

  const clearAll = useCallback(() => {
    setSelectedIds(new Set());
    setLiveStatusById({});
  }, []);

  const isSelected = useCallback(
    (elementId: string) => selectedIds.has(elementId),
    [selectedIds],
  );

  const applyStatusLive = useCallback(
    (elementIds: string[], status: ElementStatus) => {
      setLiveStatusById((prev) => {
        const next = { ...prev };
        for (const id of elementIds) {
          next[id] = status;
        }
        return next;
      });
      for (const id of elementIds) {
        onStatusLiveChange(id, status);
      }
    },
    [onStatusLiveChange],
  );

  const value = useMemo<ActasOperativoSelectionContextValue>(
    () => ({
      enabled,
      selectedIds,
      selectionActive: selectedIds.size > 0,
      liveStatusById,
      isSelected,
      toggle,
      clearAll,
      applyStatusLive,
    }),
    [
      enabled,
      selectedIds,
      liveStatusById,
      isSelected,
      toggle,
      clearAll,
      applyStatusLive,
    ],
  );

  if (!enabled) {
    return <>{children}</>;
  }

  return (
    <ActasOperativoSelectionContext.Provider value={value}>
      {children}
    </ActasOperativoSelectionContext.Provider>
  );
}
