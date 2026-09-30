import { informesAppPath } from "@/modules/pm/informes/logic/paths";

interface InformesPageProps {
  /** Activo PM con el que abrir la app (subpestaña del proyecto). */
  idActivo?: string;
}

/**
 * La app de informes trimestrales, embebida a pantalla completa.
 *
 * Es la misma app que el artifact de claude.ai, servida desde
 * public/informes-app (mismo origen: la cookie de sesión vale para
 * /api/informes/*). Ver src/modules/pm/informes/README.md.
 */
export default function InformesPage({ idActivo }: InformesPageProps) {
  return (
    <section className="min-w-0 overflow-hidden rounded-lg border border-subtle/50 bg-card">
      <iframe
        src={informesAppPath(idActivo)}
        title="Informes trimestrales"
        className="block w-full border-0"
        style={{ height: "calc(100vh - 12rem)", minHeight: 640 }}
      />
    </section>
  );
}
