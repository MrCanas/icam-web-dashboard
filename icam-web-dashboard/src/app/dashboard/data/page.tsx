import { DataWorkspace } from "@/components/data/DataWorkspace";

export default function DataPage() {
  return (
    <div className="space-y-4">
      <header>
        <h1 className="text-xl font-semibold text-icam-900">Data</h1>
        <p className="mt-1 text-sm text-text-muted">
          Importación del Excel maestro y registro de actividad.
        </p>
      </header>
      <DataWorkspace />
    </div>
  );
}
