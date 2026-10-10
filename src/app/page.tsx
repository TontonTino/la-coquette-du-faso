import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { Logo } from "@/components/layout/Logo";
import { HabillagePublic } from "@/components/public/Habillage";
import { buttonClasses } from "@/components/ui/Button";
import { IconWhatsApp } from "@/components/ui/icons";
import { fourchetteDuree, fourchettePrix } from "@/lib/salon/regles";
import { lienWhatsApp } from "@/lib/salon/whatsapp";
import { SALON_PUBLIC } from "@/server/salon/public-config";
import { salonPublic, type SalonPublic } from "@/server/salon/service";

export const metadata: Metadata = {
  title: { absolute: "La Coquette du Faso — Demander un rendez-vous" },
  description: "Demandez votre rendez-vous en ligne au salon La Coquette du Faso, à Ouagadougou. Le salon vous confirme l'heure sur WhatsApp.",
};

const ETAPES = [
  { titre: "Vous choisissez", texte: "Un modèle en photo ou un type de coiffure, le jour et le moment qui vous arrangent." },
  { titre: "Le salon vous confirme", texte: "La secrétaire fixe l'heure exacte et vous l'envoie sur WhatsApp." },
  { titre: "Vous venez au salon", texte: "Votre coiffeuse vous attend : fini les longues attentes." },
];

export default function Accueil() {
  return (
    <HabillagePublic plein>
      <Suspense fallback={<HeroSansPhoto />}>
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
      {salon && salon.modeles.length >= 1 ? <HeroPhotos modeles={salon.modeles} /> : <HeroSansPhoto />}
      <div className="mx-auto max-w-3xl px-4">
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
      <h1 className="font-display text-[2.9rem] leading-[0.95] font-bold text-white sm:text-6xl">Votre coiffure, sans attendre.</h1>
      <p className="mt-4 max-w-md text-[15px] leading-relaxed text-white/75">
        Choisissez votre modèle et demandez votre rendez-vous en une minute. Le salon vous confirme l&apos;heure sur WhatsApp.
      </p>
      <Link href="/reserver" className={buttonClasses("or", "lg", "mt-6 w-full sm:w-auto")}>
        Demander un rendez-vous
      </Link>
    </>
  );
}

/** L'accueil s'ouvre sur les vraies réalisations du salon. */
function HeroPhotos({ modeles }: { modeles: SalonPublic["modeles"] }) {
  const [a, b, c] = modeles;
  const photo = (m: SalonPublic["modeles"][number], classe: string, prioritaire = false) => (
    // eslint-disable-next-line @next/next/no-img-element -- photo servie par l'application, déjà réduite
    <img src={m.photoUrl} alt={m.nom} loading={prioritaire ? "eager" : "lazy"} fetchPriority={prioritaire ? "high" : "auto"} className={`size-full object-cover ${classe}`} />
  );
  return (
    <section className="bg-noir pb-8">
      <div className="mx-auto max-w-3xl px-4 pt-4">
        <div className={`grid h-[22rem] gap-2 sm:h-[26rem] ${b ? "grid-cols-[1.35fr_1fr]" : "grid-cols-1"}`}>
          <div className="overflow-hidden rounded-[1.75rem] rounded-br-md">{photo(a, "", true)}</div>
          {b && (
            <div className={`grid gap-2 ${c ? "grid-rows-2" : ""}`}>
              <div className="overflow-hidden rounded-[1.75rem] rounded-bl-md">{photo(b, "")}</div>
              {c && <div className="overflow-hidden rounded-[1.75rem] rounded-tl-md">{photo(c, "")}</div>}
            </div>
          )}
        </div>
        <div className="mt-7">
          <Accroche />
        </div>
      </div>
    </section>
  );
}

function HeroSansPhoto() {
  return (
    <section className="texture-noire relative overflow-hidden pb-10">
      <div className="pointer-events-none absolute -top-6 -right-16 opacity-[0.08]" aria-hidden>
        <Logo size={300} />
      </div>
      <div className="relative mx-auto max-w-3xl px-4 pt-14">
        <Accroche />
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
        <p className="pb-1 text-xs text-sourdine">{modeles.length} modèle{modeles.length > 1 ? "s" : ""}</p>
      </div>
      <p className="mt-2 text-sm text-sourdine">Touchez un modèle pour le demander.</p>
      <ul className="defile-x -mx-4 mt-4 gap-3 px-4 pb-2">
        {modeles.map((m) => (
          <li key={m.id} className="w-[68%] sm:w-[40%]">
            <Link href={`/reserver?modele=${m.id}`} className="group block">
              <span className="block overflow-hidden rounded-[1.5rem] shadow-photo">
                {/* eslint-disable-next-line @next/next/no-img-element -- photo servie par l'application, déjà réduite */}
                <img src={m.photoUrl} alt={m.nom} loading="lazy" className="aspect-[4/5] w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]" />
              </span>
              <span className="mt-3 block font-display text-[1.35rem] leading-tight font-bold">{m.nom}</span>
              <span className="mt-0.5 block text-sm text-sourdine">
                {[fourchettePrix(m.prixMin, m.prixMax), fourchetteDuree(m.dureeMin, m.dureeMax)].filter(Boolean).join(", ")}
              </span>
              <span className="mt-1.5 inline-block text-sm font-medium text-or-fonce underline decoration-or/50 underline-offset-4">Demander ce modèle</span>
            </Link>
          </li>
        ))}
      </ul>
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
