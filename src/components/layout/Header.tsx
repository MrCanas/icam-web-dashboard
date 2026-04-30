import { NavTabs } from "@/components/layout/NavTabs";

export function Header() {
  return (
    <header className="bg-icam-900 h-14 px-6 lg:px-8 flex items-center justify-between">
      <div className="text-white font-semibold text-base tracking-wide">
        <span className="text-icam-gold">ICAM</span> Asset Manager
      </div>
      <div className="hidden lg:block">
        <NavTabs />
      </div>
      <div className="text-white/40 text-[10px] text-right leading-tight">
        Confidencial · Comité
        <br />
        Datos actualizados
      </div>
    </header>
  );
}
