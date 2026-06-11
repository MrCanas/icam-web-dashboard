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

/**
 * CLIENT: fetches identity from GET /api/me (backed by getCurrentUser on the server).
 * Wrap the app (or dashboard layout) with CurrentUserProvider.
 */
export function CurrentUserProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<UserContext | null>(null);
  const [loading, setLoading] = useState(true);
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
    void refresh();
  }, [refresh]);

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
