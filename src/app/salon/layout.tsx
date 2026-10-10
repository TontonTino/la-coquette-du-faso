import type { Metadata } from "next";
import { Suspense } from "react";
import { utilisatriceCourante } from "@/server/auth";
import { deconnexionAction } from "./actions";
import { NavSalon } from "./NavSalon";

export const metadata: Metadata = { title: { default: "Salon", template: "%s · Espace salon" } };

export default function SalonLayout({ children }: LayoutProps<"/salon">) {
  return (
    <div className="flex min-h-dvh flex-col bg-creme text-encre">
      <header className="sticky top-0 z-30 bg-noir text-white">
        <div className="mx-auto flex max-w-xl items-center justify-between gap-3 px-4 py-3">
          <div className="min-w-0">
            <p className="font-display text-xl leading-tight font-bold text-or">La Coquette du Faso</p>
            <Suspense fallback={<p className="text-xs text-white/60">Espace salon</p>}>
              <QuiEstConnectee />
            </Suspense>
          </div>
          <form action={deconnexionAction}>
            <button type="submit" className="min-h-11 rounded-full px-3 text-sm text-white/80 underline-offset-4 hover:underline">
              Se déconnecter
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
  return <p className="text-xs text-white/70">{libelle}</p>;
}

async function NavSelonRole() {
  const u = await utilisatriceCourante();
  if (!u) return null;
  return <NavSalon gerante={u.role === "gerante"} />;
}
