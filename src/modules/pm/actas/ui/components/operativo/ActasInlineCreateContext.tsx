"use client";

import { createContext, useCallback, useContext, useMemo, useState } from "react";

/**
 * Señal de "auto-edición": cuando se crea un elemento / sub-elemento inline,
 * su fila debe aparecer con el nombre ya en modo edición y el foco puesto.
 *
 * Es solo estado de UI (qué fila debe abrirse en edición); NO dispara escrituras
 * ni sincroniza datos de servidor, así que no incurre en el antipatrón de estado
 * derivado. El Provider no renderiza DOM, por lo que no afecta al CSS Grid.
 */
interface InlineCreateContextValue {
  /** Id del elemento recién creado que debe entrar en edición (una sola vez). */
  autoEditId: string | null;
  /** Marca un id para auto-edición tras crearlo. */
  requestAutoEdit: (elementId: string) => void;
  /** Consume la señal: devuelve true si coincide y la limpia. */
  consumeAutoEdit: (elementId: string) => boolean;
}

const InlineCreateContext = createContext<InlineCreateContextValue | null>(null);

export function ActasInlineCreateProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [autoEditId, setAutoEditId] = useState<string | null>(null);

  const requestAutoEdit = useCallback((elementId: string) => {
    setAutoEditId(elementId);
  }, []);

  const consumeAutoEdit = useCallback(
    (elementId: string) => {
      let matched = false;
      setAutoEditId((current) => {
        if (current === elementId) {
          matched = true;
          return null;
        }
        return current;
      });
      return matched || autoEditId === elementId;
    },
    [autoEditId],
  );

  const value = useMemo<InlineCreateContextValue>(
    () => ({ autoEditId, requestAutoEdit, consumeAutoEdit }),
    [autoEditId, requestAutoEdit, consumeAutoEdit],
  );

  return (
    <InlineCreateContext.Provider value={value}>
      {children}
    </InlineCreateContext.Provider>
  );
}

export function useInlineCreate(): InlineCreateContextValue | null {
  return useContext(InlineCreateContext);
}
