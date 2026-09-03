import { DataUpload } from "@/components/data/DataUpload";
import { getCurrentUser } from "@/lib/auth/currentUser";
import { getUserRole } from "@/lib/auth/permissions";
import { PmDataUpload } from "@/modules/pm/ui/PmDataUpload";
import { PortfolioSyncButton } from "@/modules/portfolio/ui/PortfolioSyncButton";
import { SyncStatusBanner } from "@/modules/portfolio/ui/SyncStatusBanner";

export default async function DataUploadPage() {
  // Forzar la sincronización exige admin de la zona, igual que /api/cron/portfolio-sync.
  const user = await getCurrentUser();
  const isFinancieroAdmin = !!user && getUserRole(user, "financiero") === "admin";

  return (
    <div className="space-y-8">
      <section className="space-y-2">
        <h2 className="text-lg font-semibold text-icam-900">Portfolio financiero</h2>
        <p className="text-sm text-text-muted">Maestro Excel (.xlsx / .xlsm) → tabla proyectos</p>
        {user ? <SyncStatusBanner ctx={user} /> : null}
        {isFinancieroAdmin ? <PortfolioSyncButton /> : null}
        <DataUpload />
      </section>
      <section className="space-y-2 border-t border-subtle pt-8">
        <h2 className="text-lg font-semibold text-icam-900">Seguimiento PM (hitos)</h2>
        <p className="text-sm text-text-muted">Excel binario (.xlsb) → hoja OVERVIEW</p>
        <PmDataUpload />
      </section>
    </div>
  );
}
