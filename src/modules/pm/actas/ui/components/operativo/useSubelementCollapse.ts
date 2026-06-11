"use client";

import { useCallback, useEffect, useState } from "react";

/**
 * Persistencia del colapso de sub-elementos por elemento (localStorage, por
 * usuario/navegador). Solo guardamos los IDs COLAPSADOS; el estado por defecto
 * es expandido, así que un elemento sin entrada se considera expandido.
 *
 * El valor se lee tras el montaje (mismo patrón que ActasCollapsibleLayout) para
 * evitar desajustes de hidratación: el servidor y la primera render del cliente
 * usan el valor por defecto, y un useEffect aplica la preferencia guardada. La
 * escritura ocurre SOLO en el toggle explícito del usuario; no sincroniza datos
 * de servidor ni dispara mutaciones de red.
 */
const STORAGE_KEY = "actas-subelementos-colapsados";

function readCollapsedMap(): Record<string, true> {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as unknown;
    return parsed && typeof parsed === "object"
      ? (parsed as Record<string, true>)
      : {};
  } catch {
    return {};
  }
}

function writeCollapsed(elementId: string, collapsed: boolean): void {
  if (typeof window === "undefined") return;
  try {
    const map = readCollapsedMap();
    if (collapsed) {
      map[elementId] = true;
    } else {
      delete map[elementId];
    }
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(map));
  } catch {
    /* localStorage no disponible / cuota: ignorar, no es crítico */
  }
}

export function useSubelementCollapse(
  elementId: string,
  defaultExpanded = true,
): [boolean, (next: boolean) => void] {
  const [expanded, setExpanded] = useState(defaultExpanded);

  useEffect(() => {
    const collapsed = readCollapsedMap()[elementId] === true;
    setExpanded(!collapsed);
  }, [elementId]);

  const setExpandedPersist = useCallback(
    (next: boolean) => {
      setExpanded(next);
      writeCollapsed(elementId, !next);
    },
    [elementId],
  );

  return [expanded, setExpandedPersist];
}
