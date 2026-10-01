import type { UserContext } from "@/lib/auth/currentUser";

import { mapaDirigidas } from "../logic/dirigidas";
import type { MaterialInforme } from "../logic/prompts";
import type { Informe } from "../types";
import { listarFotos } from "./fotosRepository";
import { listarFuentes } from "./fuentesRepository";
import { obtenerInforme, obtenerPrevio } from "./informesRepository";
import { cargarReferencias } from "./referencias";

type R<T> = { data: T; error: null } | { data: null; error: string };

/**
 * Todo lo que necesita un prompt: el informe, sus fuentes incluidas, las
 * fotos, el informe anterior (estructurado o en texto) y las referencias.
 */
export async function cargarMaterial(
  ctx: UserContext,
  informeId: string,
): Promise<R<{ informe: Informe; material: MaterialInforme } | null>> {
  const inf = await obtenerInforme(ctx, informeId);
  if (inf.error !== null) return { data: null, error: inf.error };
  if (!inf.data) return { data: null, error: null };
  const informe = inf.data;
  const [fuentes, fotos, previo] = await Promise.all([
    listarFuentes(ctx, informeId),
    listarFotos(ctx, informeId),
    informe.base?.tipo === "estructurado"
      ? obtenerPrevio(ctx, informe.codigo, informe.base.id)
      : Promise.resolve({ data: null, error: null } as const),
  ]);
  if (fuentes.error !== null) return { data: null, error: fuentes.error };
  if (fotos.error !== null) return { data: null, error: fotos.error };
  const { referencias, biblioteca } = cargarReferencias();
  const previoTexto = informe.base?.tipo === "texto" ? (fuentes.data.find((f) => f.tipo === "previo")?.texto ?? null) : null;
  return {
    data: {
      informe,
      material: {
        informe: {
          proyecto: informe.proyecto.nombre,
          codigo: informe.codigo,
          arquetipo: informe.proyecto.arquetipo ?? "A",
          trimestre: informe.trimestre,
          trimestreAnterior: informe.trimestreAnterior,
          siguiente: informe.siguiente,
        },
        referencias,
        biblioteca,
        fuentes: fuentes.data.filter((f) => f.incluida),
        dirigidas: mapaDirigidas(informe.seleccion),
        previoTexto,
        previo: previo.data ?? null,
        fotos: fotos.data,
        analisis: informe.analisis,
      },
    },
    error: null,
  };
}
