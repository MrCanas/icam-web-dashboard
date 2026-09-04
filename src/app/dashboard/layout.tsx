import { Footer } from "@/components/layout/Footer";
import { Header } from "@/components/layout/Header";
import { DashboardZoneGuard } from "@/components/layout/DashboardZoneGuard";
import { CurrentUserProvider } from "@/lib/auth/CurrentUserProvider";
import { getCurrentUser } from "@/lib/auth/currentUser";
import { hasZoneAccess } from "@/lib/auth/permissions";
import {
  fetchPmProjectNavItems,
  type PmProjectNavItem,
} from "@/modules/pm/data/pmRepository";

/**
 * Sin caché, y a propósito: cada respuesta del dashboard depende de quién la
 * pide. El acceso se resuelve por rol de zona y por `app_user_route_deny`, así
 * que una página cacheada podría servirle a un usuario el contenido que se le
 * denegó a otro. Aparece como hallazgo de rendimiento en la auditoría de agosto
 * (§3.3) — se deja como está a sabiendas: el riesgo de fuga entre usuarios no
 * compensa los milisegundos.
 */
export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function DashboardLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // Proyectos activos para la fila secundaria de la zona pm. Cualquier fallo
  // degrada a nav sin proyectos, nunca rompe el layout.
  let pmProjects: PmProjectNavItem[] = [];
  try {
    const user = await getCurrentUser();
    if (user && hasZoneAccess(user, "pm")) {
      pmProjects = await fetchPmProjectNavItems(user);
    }
  } catch {
    pmProjects = [];
  }

  return (
    <CurrentUserProvider>
      <DashboardZoneGuard>
        <div className="min-h-screen flex flex-col bg-page">
          <Header pmProjects={pmProjects} />
          <main className="flex-1 p-3 sm:p-4 lg:p-6 max-w-full min-w-0 overflow-x-hidden">
            {children}
          </main>
          <Footer />
        </div>
      </DashboardZoneGuard>
    </CurrentUserProvider>
  );
}
