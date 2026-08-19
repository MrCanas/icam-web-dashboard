"use client";

import { createContext, useContext } from "react";

/**
 * Base de las URLs de actas del proyecto que se está viendo. La inyecta
 * ActasProjectPage y la consumen los componentes cliente que construyen
 * enlaces (pestañas, permalinks, as-of…), para que toda la navegación interna
 * se quede en /dashboard/pm/proyecto/<id>/actas en vez de saltar a la sección
 * Actas por código.
 *
 * `undefined` = sin proyecto PM detrás (hub de actas): los helpers caen a la
 * base por código.
 */
const ActasBasePathContext = createContext<string | undefined>(undefined);

export function ActasBasePathProvider({
  basePath,
  children,
}: {
  basePath?: string;
  children: React.ReactNode;
}) {
  return (
    <ActasBasePathContext.Provider value={basePath}>
      {children}
    </ActasBasePathContext.Provider>
  );
}

export function useActasBasePath(): string | undefined {
  return useContext(ActasBasePathContext);
}
