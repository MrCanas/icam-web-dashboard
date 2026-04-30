"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { seedProyectos } from "@/lib/seedProyectos";
import { Proyecto } from "@/lib/types";

interface UseProyectosParams {
  situacion?: string;
  tipoProyecto?: string;
}

export function useProyectos({ situacion, tipoProyecto }: UseProyectosParams = {}) {
  const [data, setData] = useState<Proyecto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const supabase = createClient();

    async function fetchProyectos() {
      setLoading(true);
      setError(null);

      let query = supabase
        .from("proyectos")
        .select("*")
        .eq("es_ultima_fila", 1)
        .order("proyecto", { ascending: true });

      if (situacion) {
        query = query.eq("situacion", situacion);
      }

      if (tipoProyecto) {
        query = query.eq("tipo_proyecto", tipoProyecto);
      }

      const { data: rows, error: queryError } = await query;

      if (queryError) {
        setError(queryError.message);
        setData([]);
      } else {
        const result = ((rows ?? []) as Proyecto[]).filter((row) => row.es_ultima_fila === 1);
        const baseRows = result.length > 0 ? result : seedProyectos;
        const filtered = baseRows
          .filter((row) => (situacion ? row.situacion === situacion : true))
          .filter((row) => (tipoProyecto ? row.tipo_proyecto === tipoProyecto : true));
        setData(filtered);
      }

      setLoading(false);
    }

    fetchProyectos();
  }, [situacion, tipoProyecto]);

  return useMemo(
    () => ({
      data,
      loading,
      error,
    }),
    [data, loading, error],
  );
}
