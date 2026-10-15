import Link from "next/link";

import { Aviso } from "@/components/ui/Aviso";
import { Ayuda } from "@/components/ui/Ayuda";
import { fmtInt } from "@/lib/formatters";
import { esFiltro, ETIQUETA_FILTRO } from "@/modules/comunicaciones/logic/analitica";
import { comunicacionAnaliticaPath } from "@/modules/comunicaciones/logic/paths";
import type { ComComunicacionRow } from "@/modules/comunicaciones/types";

/** Si la comunicación es un seguimiento: de cuál sale, con qué filtro y qué cambió respecto a aquel envío. */
export function AvisoDeSeguimiento({ comunicacion }: { comunicacion: ComComunicacionRow }) {
  if (comunicacion.audiencia !== "reenvio") return null;
  const filtro = comunicacion.reenvio_filtro;
  const diferencias = filtro?.diferencias;
  return (
    <Aviso tipo="info" titulo="Es un seguimiento">
      Sale de{" "}
      {comunicacion.origen_comunicacion_id ? (
        <Link href={comunicacionAnaliticaPath(comunicacion.origen_comunicacion_id)} className="font-medium underline underline-offset-2">
          otra comunicación
        </Link>
      ) : (
        "otra comunicación"
      )}
      , con el filtro «{esFiltro(filtro?.filtro) ? ETIQUETA_FILTRO[filtro.filtro] : "desconocido"}».
      {diferencias && (diferencias.seCaen.length > 0 || diferencias.nuevas.length > 0) ? (
        <>
          {" "}
          Respecto a aquel envío:{" "}
          {diferencias.seCaen.length > 0 ? `${fmtInt(diferencias.seCaen.length)} ${diferencias.seCaen.length === 1 ? "cuenta se cae" : "cuentas se caen"}` : ""}
          {diferencias.seCaen.length > 0 && diferencias.nuevas.length > 0 ? " y " : ""}
          {diferencias.nuevas.length > 0 ? `${fmtInt(diferencias.nuevas.length)} ${diferencias.nuevas.length === 1 ? "dirección es nueva" : "direcciones son nuevas"}` : ""}
          .
        </>
      ) : null}
      <Ayuda className="ml-1">
        Un seguimiento solo puede incluir cuentas que estuvieran en el envío original, con las direcciones de hoy. Una
        cuenta con una dirección que no estaba en aquel envío nace excluida, con el aviso «Dirección nueva»: mírala y
        vuelve a incluirla solo si es correcta.
        {diferencias && diferencias.seCaen.length > 0 ? (
          <>
            <br />
            <br />
            Se caen: {diferencias.seCaen.map((s) => `${s.cuenta} (${s.motivo})`).join("; ")}.
          </>
        ) : null}
        {diferencias && diferencias.nuevas.length > 0 ? (
          <>
            <br />
            Direcciones nuevas: {diferencias.nuevas.map((n) => `${n.cuenta}: ${n.email}`).join("; ")}.
          </>
        ) : null}
      </Ayuda>
    </Aviso>
  );
}
