import type { UserContext } from "@/lib/auth/currentUser";

import { puedeEditarInformes } from "../../actions/acceso";
import { listarFotos } from "../../data/fotosRepository";
import { listarFuentes } from "../../data/fuentesRepository";
import { listarPrevios, obtenerInforme, obtenerPrevio } from "../../data/informesRepository";
import { cargarReferencias } from "../../data/referencias";
import { resumenUsoInforme } from "../../data/usoRepository";
import { Aviso } from "../componentes";
import { InformeApp } from "../InformeApp";

/** Un informe: asistente (pasos 1–3) o editor, según su estado. */
export default async function InformePage({ ctx, id, existia }: { ctx: UserContext; id: string; existia: boolean }) {
  const inf = await obtenerInforme(ctx, id);
  if (inf.error !== null) return <Aviso tipo="error">No se ha podido abrir el informe: {inf.error}</Aviso>;
  if (!inf.data) return <Aviso tipo="error">Ese informe ya no existe.</Aviso>;
  const informe = inf.data;
  const [fuentes, fotos, previo, candidatos, uso] = await Promise.all([
    listarFuentes(ctx, id),
    listarFotos(ctx, id),
    informe.base?.tipo === "estructurado"
      ? obtenerPrevio(ctx, informe.codigo, informe.base.id)
      : Promise.resolve({ data: null, error: null } as const),
    listarPrevios(ctx, informe.codigo, informe.trimestre),
    resumenUsoInforme(ctx, id),
  ]);
  const error = fuentes.error ?? fotos.error ?? previo.error ?? candidatos.error;
  if (error) return <Aviso tipo="error">No se ha podido abrir el informe: {error}</Aviso>;
  return (
    <InformeApp
      informe={informe}
      fuentes={fuentes.data ?? []}
      fotos={fotos.data ?? []}
      previo={previo.data ?? null}
      candidatos={candidatos.data ?? []}
      biblioteca={cargarReferencias().biblioteca}
      puedeEditar={puedeEditarInformes(ctx)}
      existia={existia}
      uso={uso.data ?? null}
    />
  );
}
