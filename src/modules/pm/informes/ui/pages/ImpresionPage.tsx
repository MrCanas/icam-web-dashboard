import type { UserContext } from "@/lib/auth/currentUser";

import { obtenerInforme } from "../../data/informesRepository";
import { Aviso } from "../componentes";
import { VistaImpresion } from "../impresion/VistaImpresion";

/** Vista de impresión (PDF) de un informe. */
export default async function ImpresionPage({ ctx, id }: { ctx: UserContext; id: string }) {
  const r = await obtenerInforme(ctx, id);
  if (r.error !== null) return <Aviso tipo="error">No se ha podido abrir el informe: {r.error}</Aviso>;
  if (!r.data) return <Aviso tipo="error">Ese informe ya no existe.</Aviso>;
  if (!r.data.contenido?.slides?.length) return <Aviso>Este informe todavía no tiene slides.</Aviso>;
  return (
    <VistaImpresion
      id={r.data.id}
      codigo={r.data.codigo}
      trimestre={r.data.trimestre}
      estado={r.data.estado}
      version={r.data.version}
      contenido={r.data.contenido}
    />
  );
}
