import { MondayHistoricoView } from "@/modules/monday/ui/historico/MondayHistoricoView";
import { getMondayHistoricoPayload } from "@/modules/monday/data/historico-read";

export const dynamic = "force-dynamic";
export const revalidate = 0;

interface MondayHistoricoPageProps {
  searchParams: Promise<{ boardId?: string }>;
}

export default async function MondayHistoricoPage({ searchParams }: MondayHistoricoPageProps) {
  const params = await searchParams;

  // Solo la carga va en el try (lo que puede fallar: entorno, red, token). El
  // render se hace fuera: un try/catch no captura errores de render de React, y
  // envolverlo daba un mensaje de error engañoso que nunca cubriría ese caso.
  let data: Awaited<ReturnType<typeof getMondayHistoricoPayload>>;
  try {
    data = await getMondayHistoricoPayload({ boardId: params.boardId });
  } catch (error) {
    console.error("[dashboard/monday/historico]", error);
    return (
      <section className="bg-card rounded-lg border border-red-200 p-6 text-red-700">
        Error cargando el histórico Monday. Revisa variables de entorno y permisos del token.
      </section>
    );
  }

  if (!data.selectedBoardId) {
    return (
      <section className="bg-card rounded-lg border border-subtle/50 shadow-sm p-6 text-text-body">
        No hay boards configurados para Monday (revisa <code className="text-sm">MONDAY_BOARD_IDS</code>).
      </section>
    );
  }

  return <MondayHistoricoView data={data} />;
}
