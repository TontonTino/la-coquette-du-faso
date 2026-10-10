import Link from "next/link";
import type { ReactNode } from "react";
import { Logo } from "@/components/layout/Logo";

/** En-tête et pied de page des pages clientes (publiques). */
export function HabillagePublic({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col bg-creme text-encre">
      <header className="texture-noire sticky top-0 z-30 border-b border-or/25 text-white">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-3 px-4 py-2.5">
          <Link href="/" className="flex min-w-0 items-center gap-3" aria-label="La Coquette du Faso, accueil">
            <Logo size={40} priority />
            <span className="leading-tight">
              <span className="block font-display text-lg font-semibold text-or">La Coquette du Faso</span>
              <span className="block text-[10px] tracking-[0.22em] text-white/60 uppercase">Salon de beauté · Ouagadougou</span>
            </span>
          </Link>
          <Link href="/reserver" className="hidden rounded-full bg-or px-4 py-2 text-sm font-medium text-noir sm:inline-block">
            Demander un RDV
          </Link>
        </div>
      </header>
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-6">{children}</main>
      <footer className="border-t border-trait px-4 py-6 text-center text-xs text-sourdine">
        <p>La Coquette du Faso · Ouagadougou</p>
        <p className="mt-2">
          <Link href="/connexion" className="underline">
            Espace salon
          </Link>
        </p>
      </footer>
    </div>
  );
}
