"use client";

import { useCallback, useEffect, useState } from "react";
import { useCurrentUser } from "@/lib/auth/useCurrentUser";
import {
  createExampleItem,
  listExampleItems,
  mapExampleRows,
} from "@/modules/_template/data/exampleRepository";
import { countExampleItems, sortExampleItemsByName } from "@/modules/_template/logic/exampleService";
import type { ExampleItem } from "@/modules/_template/types";

/**
 * Componente de ejemplo — no está montado en ninguna ruta de `app/`.
 * Al crear un módulo real, copia el patrón en `ui/pages/` y delega datos al repositorio.
 */
export function ExampleList() {
  const { user, loading: userLoading } = useCurrentUser();
  const [items, setItems] = useState<ExampleItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    setError(null);
    const { data, error: queryError } = await listExampleItems(user);
    if (queryError) {
      setError(queryError.message);
      setItems([]);
    } else {
      setItems(sortExampleItemsByName(mapExampleRows(data)));
    }
    setLoading(false);
  }, [user]);

  useEffect(() => {
    if (userLoading) return;
    if (!user) {
      setItems([]);
      setLoading(false);
      return;
    }
    void load();
  }, [user, userLoading, load]);

  async function handleCreate() {
    if (!user) return;
    const stamp = new Date().toISOString();
    const { error: insertError } = await createExampleItem(user, {
      name: `Ejemplo ${stamp}`,
    });
    if (insertError) {
      setError(insertError.message);
      return;
    }
    await load();
  }

  if (userLoading || loading) {
    return <p className="text-sm text-text-muted">Cargando…</p>;
  }

  if (!user) {
    return <p className="text-sm text-text-muted">Inicia sesión para ver ejemplos.</p>;
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-text-muted">
        {countExampleItems(items)} elemento(s) — plantilla de módulo (tabla `example_items` opcional).
      </p>
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      <ul className="list-disc pl-5 text-sm">
        {items.map((item) => (
          <li key={item.id}>{item.name}</li>
        ))}
      </ul>
      <button
        type="button"
        onClick={() => void handleCreate()}
        className="rounded-md bg-icam-900 px-3 py-2 text-sm text-white"
      >
        Crear ejemplo
      </button>
    </div>
  );
}
