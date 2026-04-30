import { NavTabs } from "@/components/layout/NavTabs";
import Image from "next/image";

export function Header() {
  return (
    <header className="bg-icam-900 h-14 px-6 lg:px-8 flex items-center justify-between">
      <div className="h-8 bg-icam-900 flex items-center">
        <Image
          src="/logo-icam.png"
          alt="ICAM Asset Manager"
          width={220}
          height={32}
          className="h-8 w-auto object-contain mix-blend-lighten"
          priority
        />
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
