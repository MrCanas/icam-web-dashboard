"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { UserContext } from "@/lib/auth/currentUser";

interface CurrentUserContextValue {
  user: UserContext | null;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

const CurrentUserContext = createContext<CurrentUserContextValue | null>(null);

interface CurrentUserProviderProps {
  children: ReactNode;
  /**
   * Identidad ya resuelta por el layout en el servidor. Si llega, no se pide
   * /api/me al montar: el guard puede pintar la página en el primer render en
   * vez de esconderla tras un «Cargando…» hasta que responda la API.
   * `undefined` = no sembrado (se pide a la API); `null` = sin sesión válida.
   */
  initialUser?: UserContext | null;
}

/**
 * CLIENT: identity from GET /api/me (backed by getCurrentUser on the server),
 * or seeded from the server via `initialUser`.
 * Wrap the app (or dashboard layout) with CurrentUserProvider.
 */
export function CurrentUserProvider({
  children,
  initialUser,
}: CurrentUserProviderProps) {
  const seeded = initialUser !== undefined;
  const [user, setUser] = useState<UserContext | null>(initialUser ?? null);
  const [loading, setLoading] = useState(!seeded);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/me", { credentials: "include" });
      if (res.status === 401) {
        setUser(null);
        return;
      }
      if (!res.ok) {
        throw new Error(`Error al cargar usuario (${res.status})`);
      }
      const data = (await res.json()) as UserContext;
      setUser(data);
    } catch (e) {
      setUser(null);
      setError(e instanceof Error ? e.message : "Error desconocido");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (seeded) return;
    void refresh();
  }, [seeded, refresh]);

  // router.refresh() vuelve a renderizar el layout con la identidad al día
  // (p. ej. tras cambiar roles): se sincroniza sin otra llamada a /api/me.
  // Ajuste durante el render, no en un efecto, para no pintar dos veces.
  const [prevInitialUser, setPrevInitialUser] = useState(initialUser);
  if (initialUser !== prevInitialUser) {
    setPrevInitialUser(initialUser);
    if (initialUser !== undefined) setUser(initialUser);
  }

  const value = useMemo(
    () => ({ user, loading, error, refresh }),
    [user, loading, error, refresh],
  );

  return (
    <CurrentUserContext.Provider value={value}>{children}</CurrentUserContext.Provider>
  );
}

export function useCurrentUser(): CurrentUserContextValue {
  const ctx = useContext(CurrentUserContext);
  if (!ctx) {
    throw new Error("useCurrentUser debe usarse dentro de CurrentUserProvider");
  }
  return ctx;
}
