import { DataUpload } from "@/components/data/DataUpload";
import { SyncStatusBanner, type FilaCargaMaestro } from "@/components/data/SyncStatusBanner";
import { getCurrentUser } from "@/lib/auth/currentUser";
import { getUserRole } from "@/lib/auth/permissions";
import { listCorporativoUploadLogs } from "@/modules/corporativo/data/corpPeriodosRepository";
import { CorporativoSyncButton } from "@/modules/corporativo/ui/CorporativoSyncButton";
import { CorporativoUpload } from "@/modules/corporativo/ui/CorporativoUpload";
import { PmDataUpload } from "@/modules/pm/ui/PmDataUpload";
import { listUploadLogsPortfolio } from "@/modules/portfolio/data/uploadLogsRepository";
import { PortfolioSyncButton } from "@/modules/portfolio/ui/PortfolioSyncButton";

export default async function DataUploadPage() {
  // Forzar una sincronización exige admin de SU zona, igual que el cron. Son dos
  // permisos distintos a propósito: quien administra el portfolio de proyectos no
  // tiene por qué poder recargar la cuenta de resultados del grupo.
  const user = await getCurrentUser();
  const isFinancieroAdmin = !!user && getUserRole(user, "financiero") === "admin";
  const isCorporativoAdmin = !!user && getUserRole(user, "corporativo") === "admin";
  const veCorporativo = !!user && getUserRole(user, "corporativo") !== null;

  // Cada maestro lee SUS cargas: comparten tabla `upload_logs` y se distinguen
  // por la columna `fuente` que añadió la migración 038.
  const [logsPortfolio, logsCorporativo] = user
    ? await Promise.all([
        listUploadLogsPortfolio(user, 20),
        veCorporativo ? listCorporativoUploadLogs(user, 20) : Promise.resolve({ data: [] }),
      ])
    : [{ data: [] }, { data: [] }];

  return (
    <div className="space-y-8">
      <section className="space-y-2">
        <h2 className="text-lg font-semibold text-icam-900">Portfolio financiero</h2>
        <p className="text-sm text-text-muted">Maestro Excel (.xlsx / .xlsm) → tabla proyectos</p>
        <SyncStatusBanner
          filas={(logsPortfolio.data ?? []) as unknown as FilaCargaMaestro[]}
          maestro="maestro de vehículos"
          afectado="El portfolio"
          comando="npm run portfolio:check-sharepoint -- --list"
        />
        {isFinancieroAdmin ? <PortfolioSyncButton /> : null}
        <DataUpload />
      </section>

      {veCorporativo ? (
        <section className="space-y-2 border-t border-subtle pt-8">
          <h2 className="text-lg font-semibold text-icam-900">Corporativas</h2>
          <p className="text-sm text-text-muted">
            Maestro corporativo (.xlsx) → tabla corp_periodos, glosario y notas
          </p>
          <SyncStatusBanner
            filas={(logsCorporativo.data ?? []) as unknown as FilaCargaMaestro[]}
            maestro="maestro corporativo"
            afectado="El tab Corporativas"
            comando="npm run corporativo:check-sharepoint -- --list"
          />
          {isCorporativoAdmin ? <CorporativoSyncButton /> : null}
          {isCorporativoAdmin ? <CorporativoUpload /> : null}
        </section>
      ) : null}

      <section className="space-y-2 border-t border-subtle pt-8">
        <h2 className="text-lg font-semibold text-icam-900">Seguimiento PM (hitos)</h2>
        <p className="text-sm text-text-muted">Excel binario (.xlsb) → hoja OVERVIEW</p>
        <PmDataUpload />
      </section>
    </div>
  );
}
