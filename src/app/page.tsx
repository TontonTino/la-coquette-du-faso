import type { Metadata } from "next";
import Link from "next/link";
import { classeMarqueMia } from "./polices-mia";
import { LogoMia } from "@/components/brand/LogoMia";
import { SALON_PUBLIC } from "@/server/salon/public-config";

export const metadata: Metadata = {
  title: { absolute: "MIA — Les rendez-vous de votre salon, simplement" },
  description: "MIA donne à chaque salon de coiffure et de beauté sa page en ligne, les demandes de rendez-vous de ses clientes et un espace de gestion.",
};

const POINTS = [
  { titre: "Une page à l'image du salon", texte: "Son logo, ses couleurs, ses prestations, son équipe et ses photos, sur une adresse bien à lui." },
  { titre: "Des demandes depuis le téléphone", texte: "La cliente choisit sa coiffure et envoie sa demande en une minute, sans compte à créer." },
  { titre: "Un espace pour l'équipe", texte: "La gérante et la secrétaire suivent les demandes, les rendez-vous et l'équipe, depuis leur téléphone." },
];

export default function AccueilMia() {
  return (
    <div className={`${classeMarqueMia} flex min-h-dvh flex-col bg-mia-sable text-mia-cacao`}>
      <header>
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-4 py-4">
          <LogoMia taille={36} />
          <Link href="/connexion" className="inline-flex h-11 items-center rounded-full border border-mia-cacao/20 bg-white px-5 text-sm font-medium hover:border-mia-action">
            Espace salon
          </Link>
        </div>
      </header>

      <main className="flex-1">
        <section className="mx-auto max-w-5xl px-4 pt-10 pb-14 sm:pt-20 sm:pb-24">
          <h1 className="max-w-2xl font-display text-[2.4rem] leading-[1.05] font-bold sm:text-6xl">
            Les rendez-vous de votre salon, <span className="text-mia-action">simplement</span>.
          </h1>
          <p className="mt-5 max-w-xl text-lg text-sourdine">
            MIA donne à chaque salon de coiffure et de beauté sa page en ligne, les demandes de ses clientes et un espace pour gérer son équipe.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link href="/connexion" className="inline-flex h-13 items-center rounded-full bg-mia-action px-7 text-base font-medium text-white shadow-carte hover:bg-mia-action-fort">
              Accéder à mon salon
            </Link>
            <Link href={`/s/${SALON_PUBLIC}`} className="inline-flex h-13 items-center rounded-full border border-mia-cacao/20 bg-white px-7 text-base font-medium hover:border-mia-action">
              Voir un salon sur MIA
            </Link>
          </div>
        </section>

        <section className="border-t border-trait bg-white">
          <div className="mx-auto grid max-w-5xl gap-6 px-4 py-12 sm:grid-cols-3">
            {POINTS.map((p) => (
              <div key={p.titre}>
                <h2 className="font-display text-xl font-bold">{p.titre}</h2>
                <p className="mt-2 text-sourdine">{p.texte}</p>
              </div>
            ))}
          </div>
        </section>
      </main>

      <footer className="border-t border-trait">
        <div className="mx-auto max-w-5xl px-4 py-5 text-sm text-sourdine">MIA by RAVENOUS · Ouagadougou</div>
      </footer>
    </div>
  );
}
