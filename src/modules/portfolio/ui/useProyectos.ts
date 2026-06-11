"use client";



import { useEffect, useMemo, useState } from "react";

import { useCurrentUser } from "@/lib/auth/useCurrentUser";

import { listProyectos } from "@/modules/portfolio/data/proyectosRepository";

import { filterProyectosForClient } from "@/modules/portfolio/logic/pageViewModels";

import { Proyecto } from "@/modules/portfolio/types";



interface UseProyectosParams {

  situacion?: string;

  tipoProyecto?: string;

}



export function useProyectos({ situacion, tipoProyecto }: UseProyectosParams = {}) {

  const { user, loading: userLoading } = useCurrentUser();

  const [data, setData] = useState<Proyecto[]>([]);

  const [loading, setLoading] = useState(true);

  const [error, setError] = useState<string | null>(null);



  useEffect(() => {

    if (userLoading) return;

    if (!user) {

      setData([]);

      setError(null);

      setLoading(false);

      return;

    }



    async function fetchProyectos() {

      if (!user) return;

      setLoading(true);

      setError(null);



      const { data: rows, error: queryError } = await listProyectos(user, {

        filters: { situacion, tipoProyecto },

      });



      if (queryError) {

        setError(queryError.message);

        setData([]);

      } else {

        const result = filterProyectosForClient((rows ?? []) as unknown as Proyecto[], {

          situacion,

          tipoProyecto,

        });

        setData(result);

      }



      setLoading(false);

    }



    void fetchProyectos();

  }, [user, userLoading, situacion, tipoProyecto]);



  return useMemo(

    () => ({

      data,

      loading: loading || userLoading,

      error,

    }),

    [data, loading, userLoading, error],

  );

}

