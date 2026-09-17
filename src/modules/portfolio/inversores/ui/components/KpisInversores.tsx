"use client";

import { KPICard } from "@/components/ui/KPICard";
import { fmtEurosCompact, fmtInt, fmtMult, fmtPct } from "@/lib/formatters";
import type { CuentaInversion, KpisInversores as Kpis } from "@/modules/portfolio/inversores/types";
import type { AperturaCuentas } from "@/modules/portfolio/inversores/ui/drilldown/tipos";

interface Props {
  kpis: Kpis;
  cuentas: CuentaInversion[];
  onAbrir: (apertura: AperturaCuentas) => void;
}

/**
 * «Aportado», «Repartido» y «Pendiente» están ocultos mientras se validan.
 *
 * Los tres son correctos según su definición, pero la definición no es la que
 * se lee en la pantalla, y eso es un problema de la pantalla y no de quien la
 * mira: «Pendiente» es comprometido − aportado, capital firmado que aún no se
 * ha desembolsado, y NO capital pendiente de devolver al inversor; al lado de
 * «Repartido» se lee como lo segundo. Y «Aportado» sale de un módulo distinto
 * al de «Comprometido», así que los 46,8 M€ de diferencia son reales pero no se
 * explican solos.
 *
 * Mejor no enseñarlos que enseñarlos mal: un número en un KPI se cita en una
 * reunión, y para entonces ya nadie recuerda la salvedad.
 *
 * Para volver a mostrarlos, `true`. El cálculo sigue vivo y la tabla de abajo
 * sigue enseñando las columnas, que es donde se están validando.
 */
const MOSTRAR_EN_VALIDACION = false;

/**
 * La fila de cifras de cabecera. Todas son pinchables.
 *
 * Regla del portal: un número sin referencia no es un KPI, así que el subtítulo
 * siempre lleva contraste o periodo. Y siendo botones, son además el camino de
 * teclado al detalle: las marcas SVG de las gráficas no se pueden tabular.
 */
export function KpisInversores({ kpis, cuentas, onAbrir }: Props) {
  const conAportes = cuentas.filter((c) => c.aportado > 0);
  const conRepartos = cuentas.filter((c) => c.repartido > 0);
  const conPendiente = cuentas.filter((c) => (c.comprometido ?? 0) > c.aportado);

  return (
    <div
      className={`grid grid-cols-2 gap-3 sm:gap-4 ${
        MOSTRAR_EN_VALIDACION ? "md:grid-cols-3 xl:grid-cols-5" : "md:grid-cols-2"
      }`}
    >
      <KPICard
        title="Comprometido"
        value={fmtEurosCompact(kpis.comprometido)}
        subtitle={`${fmtInt(kpis.numCuentas)} cuentas de inversión`}
        highlight
        actionLabel={`Ver las ${fmtInt(kpis.numCuentas)} cuentas de inversión`}
        onClick={() =>
          onAbrir({
            titulo: `${fmtInt(cuentas.length)} cuentas de inversión`,
            subtitulo: `Comprometido ${fmtEurosCompact(kpis.comprometido)}`,
            cuentas,
          })
        }
      />
      {MOSTRAR_EN_VALIDACION ? (
        <>
          <KPICard
            title="Aportado"
            value={fmtEurosCompact(kpis.aportado)}
            subtitle={
              kpis.comprometido > 0
                ? `${fmtPct(kpis.aportado / kpis.comprometido)} de lo comprometido`
                : "Sin compromiso registrado"
            }
            actionLabel={`Ver las ${fmtInt(conAportes.length)} cuentas que han aportado`}
            onClick={() =>
              onAbrir({
                titulo: "Cuentas que han aportado",
                subtitulo: `${fmtEurosCompact(kpis.aportado)} en total`,
                cuentas: conAportes,
              })
            }
          />
          <KPICard
            title="Repartido"
            value={fmtEurosCompact(kpis.repartido)}
            subtitle={
              kpis.dpi === null ? "Sin aportaciones todavía" : `DPI ${fmtMult(kpis.dpi)}`
            }
            actionLabel={`Ver las ${fmtInt(conRepartos.length)} cuentas que han recibido repartos`}
            onClick={() =>
              onAbrir({
                titulo: "Cuentas con repartos",
                subtitulo: `${fmtEurosCompact(kpis.repartido)} devueltos`,
                cuentas: conRepartos,
              })
            }
          />
          <KPICard
            title="Pendiente"
            value={fmtEurosCompact(kpis.pendiente)}
            subtitle={`Por desembolsar en ${fmtInt(conPendiente.length)} cuentas`}
            actionLabel={`Ver las ${fmtInt(conPendiente.length)} cuentas con desembolso pendiente`}
            onClick={() =>
              onAbrir({
                titulo: "Cuentas con desembolso pendiente",
                subtitulo: `${fmtEurosCompact(kpis.pendiente)} sin desembolsar`,
                cuentas: conPendiente,
              })
            }
          />
        </>
      ) : null}
      <KPICard
        title="Inversores"
        value={fmtInt(kpis.numInversores)}
        subtitle={`En ${fmtInt(kpis.numCuentas)} cuentas y ${fmtInt(kpis.numPromociones)} promociones`}
        actionLabel="Ver las cuentas y sus contactos"
        onClick={() =>
          onAbrir({
            titulo: `${fmtInt(kpis.numInversores)} inversores`,
            subtitulo: "Entra en una cuenta para ver sus contactos y sus correos",
            cuentas,
          })
        }
      />
    </div>
  );
}
