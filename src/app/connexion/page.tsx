import type { Metadata } from "next";
import { FormulaireConnexion } from "./FormulaireConnexion";

export const metadata: Metadata = { title: "Connexion" };

export default function PageConnexion() {
  return (
    <main className="flex min-h-dvh items-center justify-center bg-noir px-4 py-10">
      <div className="w-full max-w-sm">
        <p className="text-center font-display text-3xl font-bold text-or">La Coquette du Faso</p>
        <p className="mt-1 text-center text-xs tracking-[0.22em] text-white/60 uppercase">Espace salon · MIA</p>
        <div className="mt-8 rounded-2xl bg-creme p-6">
          <h1 className="text-lg font-semibold text-encre">Connexion</h1>
          <p className="mt-1 text-sm text-sourdine">Réservé à la gérante et à la secrétaire.</p>
          <FormulaireConnexion />
        </div>
      </div>
    </main>
  );
}
