import type { Metadata } from "next";
import Link from "next/link";
import { Logo } from "@/components/layout/Logo";
import { FormulaireConnexion } from "./FormulaireConnexion";

export const metadata: Metadata = { title: "Connexion" };

export default function PageConnexion() {
  return (
    <main className="texture-noire flex min-h-dvh flex-col">
      <div className="flex flex-1 items-center justify-center px-4 py-10">
        <div className="w-full max-w-sm">
          <div className="flex flex-col items-center text-center">
            <Logo size={84} priority />
            <p className="mt-4 font-display text-[2.2rem] leading-none font-bold text-or">La Coquette du Faso</p>
            <p className="mt-2 text-sm text-white/60">Espace salon</p>
          </div>
          <div className="mt-8 rounded-[1.75rem] bg-lin p-6 shadow-2xl">
            <h1 className="font-display text-[1.8rem] leading-none font-bold text-encre">Connexion</h1>
            <p className="mt-2 text-sm text-sourdine">Réservé à la gérante et à la secrétaire.</p>
            <FormulaireConnexion />
          </div>
          <p className="mt-6 text-center">
            <Link href="/" className="text-sm text-white/50 underline underline-offset-4 hover:text-white">
              Retour au site des clientes
            </Link>
          </p>
        </div>
      </div>
    </main>
  );
}
