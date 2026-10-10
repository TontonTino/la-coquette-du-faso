import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { HabillagePublic } from "@/components/public/Habillage";
import { buttonClasses } from "@/components/ui/Button";
import { fourchettePrix } from "@/lib/salon/regles";
import { lienWhatsApp } from "@/lib/salon/whatsapp";
import { SALON_PUBLIC } from "@/server/salon/public-config";
import { salonPublic } from "@/server/salon/service";

export const metadata: Metadata = {
  title: { absolute: "La Coquette du Faso — Demander un rendez-vous" },
  description: "Demandez votre rendez-vous en ligne au salon La Coquette du Faso, à Ouagadougou. Le salon vous confirme l'heure sur WhatsApp.",
};

const ETAPES = [
  { n: "1", titre: "Vous envoyez votre demande", texte: "Type de coiffure, jour, moment de la journée et, si vous voulez, votre coiffeuse." },
  { n: "2", titre: "Le salon vous confirme", texte: "La secrétaire fixe l'heure exacte et vous l'envoie sur WhatsApp." },
  { n: "3", titre: "Vous venez au salon", texte: "Votre coiffeuse vous attend : fini les longues attentes." },
];

export default function Accueil() {
  return (
    <HabillagePublic>
      <section className="texture-noire overflow-hidden rounded-3xl px-6 py-10 text-white">
        <p className="text-xs tracking-[0.2em] text-or uppercase">Salon de beauté · Ouagadougou</p>
        <h1 className="mt-3 font-display text-4xl leading-tight font-bold sm:text-5xl">
          Votre coiffure,
          <br />
          <span className="text-or">sans attendre.</span>
        </h1>
        <p className="mt-4 max-w-md text-white/80">
          Demandez votre rendez-vous en ligne en une minute. Le salon vous confirme l&apos;heure sur WhatsApp.
        </p>
        <Link href="/reserver" className={buttonClasses("or", "lg", "mt-6")}>
          Demander un rendez-vous
        </Link>
      </section>

      <section className="mt-10" aria-labelledby="titre-etapes">
        <h2 id="titre-etapes" className="font-display text-2xl font-bold">
          Comment ça marche
        </h2>
        <ol className="mt-4 grid gap-3 sm:grid-cols-3">
          {ETAPES.map((e) => (
            <li key={e.n} className="rounded-2xl border border-trait bg-white p-4">
              <span className="flex size-8 items-center justify-center rounded-full bg-or font-semibold text-noir" aria-hidden>
                {e.n}
              </span>
              <p className="mt-3 font-semibold">{e.titre}</p>
              <p className="mt-1 text-sm text-sourdine">{e.texte}</p>
            </li>
          ))}
        </ol>
      </section>

      <Suspense fallback={<div className="mt-10 h-32 animate-pulse rounded-2xl bg-white" />}>
        <TypesEtContact />
      </Suspense>
    </HabillagePublic>
  );
}

async function TypesEtContact() {
  await connection(); // données à jour à chaque visite (pas de rendu figé au build)
  const salon = await salonPublic(SALON_PUBLIC);
  if (!salon) return null;
  const wa = salon.whatsapp ? lienWhatsApp(salon.whatsapp, "Bonjour, j'ai une question pour un rendez-vous.") : null;
  return (
    <>
      {salon.modeles.length > 0 && (
        <section className="mt-10" aria-labelledby="titre-modeles">
          <h2 id="titre-modeles" className="font-display text-2xl font-bold">
            Nos réalisations
          </h2>
          <p className="mt-1 text-sm text-sourdine">Touchez un modèle pour le demander.</p>
          <ul className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
            {salon.modeles.map((m) => (
              <li key={m.id}>
                <Link href={`/reserver?modele=${m.id}`} className="block overflow-hidden rounded-2xl border border-trait bg-white hover:border-or">
                  {/* eslint-disable-next-line @next/next/no-img-element -- photo servie par l'application, déjà réduite */}
                  <img src={m.photoUrl} alt={m.nom} loading="lazy" className="aspect-[4/5] w-full object-cover" />
                  <span className="block p-3">
                    <span className="block text-sm font-semibold">{m.nom}</span>
                    {fourchettePrix(m.prixMin, m.prixMax) && <span className="block text-xs text-sourdine">{fourchettePrix(m.prixMin, m.prixMax)}</span>}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
      {salon.categories.length > 0 && (
        <section className="mt-10" aria-labelledby="titre-coiffures">
          <h2 id="titre-coiffures" className="font-display text-2xl font-bold">
            Nos coiffures
          </h2>
          <ul className="mt-4 flex flex-wrap gap-2">
            {salon.categories.map((c) => (
              <li key={c.id}>
                <Link
                  href={`/reserver?type=${c.id}`}
                  className="inline-flex min-h-11 items-center rounded-full border border-trait bg-white px-4 text-sm hover:border-or"
                >
                  {c.nom}
                </Link>
              </li>
            ))}
          </ul>
          <p className="mt-3 text-sm text-sourdine">Vous avez une photo du modèle ? Vous pourrez l&apos;envoyer au salon sur WhatsApp après votre demande.</p>
        </section>
      )}
      {wa && (
        <section className="mt-10 rounded-2xl border border-trait bg-white p-5">
          <h2 className="font-semibold">Une question ?</h2>
          <p className="mt-1 text-sm text-sourdine">Écrivez-nous sur WhatsApp : {salon.whatsapp}</p>
          <a href={wa} className={buttonClasses("contour", "md", "mt-3")}>
            Écrire au salon
          </a>
        </section>
      )}
    </>
  );
}
