import { getCurrentUser } from "@/lib/auth/currentUser";
import { fetchActasCodeForPmActivo } from "@/modules/pm/actas/data/actasRepository";
import { actasProjectPath } from "@/modules/pm/actas/logic/actas-paths";
import { PmProjectTabs } from "@/modules/pm/ui/PmProjectTabs";

export default async function ProyectoLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const idActivo = decodeURIComponent(id);

  // Si el activo tiene proyecto de Actas vinculado, la pestaña lleva a su URL
  // canónica; si no (o si falla la consulta), al resolver anidado con fallback.
  let actasHref = `/dashboard/pm/proyecto/${encodeURIComponent(idActivo)}/actas`;
  try {
    const user = await getCurrentUser();
    const code = user ? await fetchActasCodeForPmActivo(user, idActivo) : null;
    if (code) actasHref = actasProjectPath(code);
  } catch {
    // fallback ya asignado
  }

  return (
    <div className="space-y-4 min-w-0">
      <PmProjectTabs idActivo={idActivo} actasHref={actasHref} />
      {children}
    </div>
  );
}
