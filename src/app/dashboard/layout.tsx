import { Footer } from "@/components/layout/Footer";
import { Header } from "@/components/layout/Header";

export default function DashboardLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <div className="min-h-screen flex flex-col bg-page">
      <Header />
      <main className="flex-1 p-4 lg:p-6">{children}</main>
      <Footer />
    </div>
  );
}
