import { DataUpload } from "@/components/data/DataUpload";
import { PmDataUpload } from "@/modules/pm/ui/PmDataUpload";

export default function DataUploadPage() {
  return (
    <div className="space-y-8">
      <section className="space-y-2">
        <h2 className="text-lg font-semibold text-icam-900">Portfolio financiero</h2>
        <p className="text-sm text-text-muted">Maestro Excel (.xlsx / .xlsm) → tabla proyectos</p>
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
