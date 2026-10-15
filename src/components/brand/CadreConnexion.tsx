import type { ReactNode } from "react";
import { classeMarqueMia } from "@/app/polices-mia";
import { LogoMia } from "./LogoMia";

/** Écran de connexion aux couleurs de MIA (sable, terracotta, cacao) : partagé par l'espace salon et l'espace MIA. */
export function CadreConnexion({ sousTitre, titre, aide, children, pied }: { sousTitre: string; titre: string; aide: string; children: ReactNode; pied?: ReactNode }) {
  return (
    <main className={`${classeMarqueMia} flex min-h-dvh flex-col bg-mia-sable text-mia-cacao`}>
      <div className="flex flex-1 items-center justify-center px-4 py-10">
        <div className="w-full max-w-sm">
          <div className="flex flex-col items-center text-center">
            <LogoMia taille={56} />
            <p className="mt-3 text-sm text-sourdine">{sousTitre}</p>
          </div>
          <div className="mt-8 rounded-[1.75rem] bg-white p-6 shadow-carte">
            <h1 className="font-display text-[1.6rem] leading-none font-bold">{titre}</h1>
            <p className="mt-2 text-sm text-sourdine">{aide}</p>
            {children}
          </div>
          {pied && <p className="mt-6 text-center">{pied}</p>}
        </div>
      </div>
    </main>
  );
}
