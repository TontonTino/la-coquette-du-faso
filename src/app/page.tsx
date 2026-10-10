import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { GalerieDefilante } from "@/components/public/GalerieDefilante";
import { HabillagePublic } from "@/components/public/Habillage";
import { buttonClasses } from "@/components/ui/Button";
import { IconWhatsApp } from "@/components/ui/icons";
import { lienWhatsApp } from "@/lib/salon/whatsapp";
import { SALON_PUBLIC } from "@/server/salon/public-config";
import { salonPublic, type SalonPublic } from "@/server/salon/service";

export const metadata: Metadata = {
  title: { absolute: "La Coquette du Faso — Demander un rendez-vous" },
  description: "Demandez votre rendez-vous en ligne au salon La Coquette du Faso, à Ouagadougou. Le salon vous confirme l'heure sur WhatsApp.",
};

const GALERIE_MAX = 40;

const ETAPES = [
  { titre: "Vous choisissez", texte: "Un modèle en photo ou un type de coiffure, le jour et le moment qui vous arrangent." },
  { titre: "Le salon vous confirme", texte: "La secrétaire fixe l'heure exacte et vous l'envoie sur WhatsApp." },
  { titre: "Vous venez au salon", texte: "Votre coiffeuse vous attend : fini les longues attentes." },
];

export default function Accueil() {
  return (
    <HabillagePublic plein>
      <Suspense fallback={<Hero />}>
        <Contenu />
      </Suspense>
    </HabillagePublic>
  );
}

async function Contenu() {
  await connection(); // données à jour à chaque visite (pas de rendu figé au build)
  const salon = await salonPublic(SALON_PUBLIC);
  return (
    <>
      <Hero />
      <div className="mx-auto max-w-5xl px-4">
        {salon && salon.modeles.length > 0 && <Galerie modeles={salon.modeles} />}
        <Etapes />
        {salon && <TypesEtContact salon={salon} />}
      </div>
    </>
  );
}

/* ------------------------------------------------------------------ */

function Accroche() {
  return (
    <>
      <h1 className="font-display text-[2.9rem] leading-[0.95] font-bold text-white lg:text-[4rem]">Votre coiffure, sans attendre.</h1>
      <p className="mt-4 max-w-md text-[15px] leading-relaxed text-white/75">
        Choisissez votre modèle et demandez votre rendez-vous en une minute. Le salon vous confirme l&apos;heure sur WhatsApp.
      </p>
      <Link href="/reserver" className={buttonClasses("or", "lg", "mt-7 w-full sm:w-auto")}>
        Demander un rendez-vous
      </Link>
    </>
  );
}

function Hero() {
  return (
    <section className="texture-noire">
      <div className="mx-auto max-w-5xl px-4 pt-12 pb-12 sm:pt-20 sm:pb-16">
        <div className="max-w-xl">
          <Accroche />
        </div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */

function Galerie({ modeles }: { modeles: SalonPublic["modeles"] }) {
  return (
    <section className="mt-10" aria-labelledby="titre-modeles">
      <div className="flex items-end justify-between gap-4">
        <h2 id="titre-modeles" className="font-display text-[2rem] leading-none font-bold">
          Nos réalisations
        </h2>
        <Link href="/reserver" className="pb-1 text-sm font-medium text-or-fonce underline decoration-or/50 underline-offset-4">
          Tout voir
        </Link>
      </div>
      <p className="mt-2 text-sm text-sourdine">Faites glisser pour voir plus, touchez un modèle pour le demander.</p>
      {/* Les plus récents seulement : la page reste légère même avec des milliers de modèles. */}
      <GalerieDefilante modeles={modeles.slice(0, GALERIE_MAX)} />
    </section>
  );
}

function Etapes() {
  return (
    <section className="mt-12" aria-labelledby="titre-etapes">
      <h2 id="titre-etapes" className="font-display text-[2rem] leading-none font-bold">
        Comment ça marche
      </h2>
      {/* Un fil d'or relie les trois étapes : c'est un parcours, dans l'ordre. */}
      <ol className="relative mt-6 flex flex-col gap-7 pl-14 before:absolute before:top-3 before:bottom-3 before:left-[1.2rem] before:w-px before:bg-gradient-to-b before:from-or before:via-or/60 before:to-or/10">
        {ETAPES.map((e, i) => (
          <li key={e.titre} className="relative">
            <span
              className="absolute top-0 -left-14 flex size-10 items-center justify-center rounded-full border border-or bg-lin font-display text-xl font-bold text-or-fonce"
              aria-hidden
            >
              {i + 1}
            </span>
            <p className="pt-1.5 font-semibold">{e.titre}</p>
            <p className="mt-1 text-sm leading-relaxed text-sourdine">{e.texte}</p>
          </li>
        ))}
      </ol>
    </section>
  );
}

function TypesEtContact({ salon }: { salon: SalonPublic }) {
  const wa = salon.whatsapp ? lienWhatsApp(salon.whatsapp, "Bonjour, j'ai une question pour un rendez-vous.") : null;
  return (
    <>
      {salon.categories.length > 0 && (
        <section className="mt-12" aria-labelledby="titre-coiffures">
          <h2 id="titre-coiffures" className="font-display text-[2rem] leading-none font-bold">
            Nos coiffures
          </h2>
          <p className="mt-2 text-sm text-sourdine">Vous avez déjà votre photo ? Choisissez le type, vous l&apos;enverrez sur WhatsApp ensuite.</p>
          <ul className="mt-4 flex flex-wrap gap-2">
            {salon.categories.map((c) => (
              <li key={c.id}>
                <Link
                  href={`/reserver?type=${c.id}`}
                  className="inline-flex min-h-11 items-center rounded-full border border-trait bg-white px-4 text-sm font-medium hover:border-or hover:bg-or-pale"
                >
                  {c.nom}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
      <section className="texture-noire mt-12 mb-12 overflow-hidden rounded-[1.75rem] p-6 text-white">
        <h2 className="font-display text-[1.9rem] leading-tight font-bold">Prête pour votre nouvelle coiffure ?</h2>
        <p className="mt-2 text-sm text-white/70">Envoyez votre demande maintenant, le salon vous répond sur WhatsApp.</p>
        <div className="mt-5 flex flex-col gap-2 sm:flex-row">
          <Link href="/reserver" className={buttonClasses("or", "lg", "w-full sm:w-auto")}>
            Réserver ma place
          </Link>
          {wa && (
            <a href={wa} className={buttonClasses("contour-clair", "lg", "w-full sm:w-auto")}>
              <IconWhatsApp width={20} height={20} />
              Écrire au salon
            </a>
          )}
        </div>
        {salon.whatsapp && <p className="mt-4 text-xs text-white/50">WhatsApp du salon : {salon.whatsapp}</p>}
      </section>
    </>
  );
}
