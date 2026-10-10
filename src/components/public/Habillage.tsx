import Link from "next/link";
import type { ReactNode } from "react";
import { Logo } from "@/components/layout/Logo";

/** En-tête et pied de page des pages clientes (publiques). */
export function HabillagePublic({ children, plein = false }: { children: ReactNode; plein?: boolean }) {
  return (
    <div className="flex min-h-dvh flex-col bg-lin text-encre">
      <header className="sticky top-0 z-30 bg-noir text-white">
        <div className="bande-faso" aria-hidden />
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-3 px-4 py-2">
          <Link href="/" className="flex min-w-0 items-center gap-2.5" aria-label="La Coquette du Faso, accueil">
            <Logo size={36} priority />
            <span className="font-display text-xl leading-none font-semibold text-or">La Coquette du Faso</span>
          </Link>
          <Link href="/reserver" className="shrink-0 rounded-full border border-or/50 px-4 py-2 text-sm font-medium text-or hover:bg-or hover:text-noir">
            Réserver
          </Link>
        </div>
      </header>
      <main className={plein ? "w-full flex-1" : "mx-auto w-full max-w-3xl flex-1 px-4 py-6"}>{children}</main>
      <footer className="bg-noir text-white/70">
        <div className="bande-faso" aria-hidden />
        <div className="mx-auto flex max-w-3xl flex-col items-center gap-3 px-4 py-8 text-center text-sm">
          <Logo size={44} />
          <p className="font-display text-2xl text-or">La Coquette du Faso</p>
          <p>Salon de beauté à Ouagadougou</p>
          <Link href="/connexion" className="mt-2 text-xs text-white/50 underline underline-offset-4 hover:text-white">
            Espace salon
          </Link>
        </div>
      </footer>
    </div>
  );
}
