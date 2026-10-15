import type { Metadata } from "next";
import { Suspense } from "react";
import { Logo } from "@/components/layout/Logo";
import { IconSortie } from "@/components/ui/icons";
import { vitrineDuSalon } from "@/lib/salon/vitrine";
import { utilisatriceCourante } from "@/server/auth";
import { deconnexionAction } from "./actions";
import { NavSalon } from "./NavSalon";

export const metadata: Metadata = { title: { default: "Salon", template: "%s · Espace salon" } };

export default function SalonLayout({ children }: LayoutProps<"/salon">) {
  return (
    <div className="flex min-h-dvh flex-col bg-atelier text-encre">
      <header className="sticky top-0 z-30 bg-noir text-white">
        <div className="mx-auto flex max-w-xl items-center justify-between gap-3 px-4 py-2.5">
          <Suspense fallback={<p className="font-display text-lg leading-tight font-bold text-or">Espace salon</p>}>
            <QuiEstConnectee />
          </Suspense>
          <form action={deconnexionAction}>
            <button
              type="submit"
              aria-label="Se déconnecter"
              title="Se déconnecter"
              className="flex size-11 items-center justify-center rounded-full text-white/70 hover:bg-white/10 hover:text-white"
            >
              <IconSortie />
            </button>
          </form>
        </div>
      </header>
      <main className="mx-auto w-full max-w-xl flex-1 px-4 pt-4 pb-28">{children}</main>
      <Suspense fallback={null}>
        <NavSelonRole />
      </Suspense>
    </div>
  );
}

async function QuiEstConnectee() {
  const u = await utilisatriceCourante();
  const role = u?.role === "gerante" ? "Gérante" : "Secrétaire";
  const libelle = !u ? "Espace salon" : u.nom === role ? `Connectée : ${role.toLowerCase()}` : `${u.nom} · ${role.toLowerCase()}`;
  const logo = u?.salonSlug ? vitrineDuSalon(u.salonSlug).logo : null;
  return (
    <div className="flex min-w-0 items-center gap-2.5">
      <Logo logo={logo} size={34} />
      <div className="min-w-0">
        <p className="truncate font-display text-lg leading-tight font-bold text-or">{u?.salonNom ?? "Espace salon"}</p>
        <p className="truncate text-xs text-white/60">{libelle}</p>
      </div>
    </div>
  );
}

async function NavSelonRole() {
  const u = await utilisatriceCourante();
  if (!u) return null;
  return <NavSalon gerante={u.role === "gerante"} />;
}
