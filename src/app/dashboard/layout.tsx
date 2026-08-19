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
