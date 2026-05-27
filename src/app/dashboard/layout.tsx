import { Footer } from "@/components/layout/Footer";
import { Header } from "@/components/layout/Header";
import { DashboardZoneGuard } from "@/components/layout/DashboardZoneGuard";
import { CurrentUserProvider } from "@/lib/auth/CurrentUserProvider";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default function DashboardLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <CurrentUserProvider>
      <DashboardZoneGuard>
        <div className="min-h-screen flex flex-col bg-page">
          <Header />
          <main className="flex-1 p-3 sm:p-4 lg:p-6 max-w-full min-w-0 overflow-x-hidden">
            {children}
          </main>
          <Footer />
        </div>
      </DashboardZoneGuard>
    </CurrentUserProvider>
  );
}
