import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { Suspense, type ReactNode } from "react";
import { NoteCoiffeuse, PhotoCoiffeuse } from "@/components/public/Equipe";
import { GalerieDefilante } from "@/components/public/GalerieDefilante";
import { HabillagePublic } from "@/components/public/Habillage";
import { VideosDefilantes } from "@/components/public/VideosDefilantes";
import { buttonClasses } from "@/components/ui/Button";
import { IconClock, IconMail, IconPhone, IconPin, IconWhatsApp } from "@/components/ui/icons";
import { lienWhatsApp } from "@/lib/salon/whatsapp";
import type { Famille } from "@/lib/salon/types";
import { SALON_PUBLIC } from "@/server/salon/public-config";
import { salonPublic, type SalonPublic } from "@/server/salon/service";

export const metadata: Metadata = {
  title: { absolute: "La Coquette du Faso — Demander un rendez-vous" },
  description: "Demandez votre rendez-vous en ligne au salon La Coquette du Faso, à Ouagadougou. Le salon vous confirme l'heure sur WhatsApp.",
};

const GALERIE_MAX = 40;

const ETAPES = [
  { titre: "Vous choisissez", texte: "Un modèle en photo ou un type de service, le jour et le moment qui vous arrangent." },
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
      <Hero horaires={salon?.horaires ?? null} />
      <div className="mx-auto max-w-5xl px-4">
        {salon && salon.modeles.length > 0 && <Galerie modeles={salon.modeles} />}
        {salon && salon.videos.length > 0 && <Videos salon={salon} />}
        <Etapes />
        {salon && <Services salon={salon} />}
        {salon && salon.coiffeuses.length > 0 && <Equipe salon={salon} />}
        {salon && <NousTrouver salon={salon} />}
        {salon && <AppelFinal salon={salon} />}
      </div>
    </>
  );
}

/* ------------------------------------------------------------------ */

function Accroche({ horaires }: { horaires: string | null }) {
  return (
    <>
      <h1 className="font-display text-[2.9rem] leading-[0.95] font-bold text-white lg:text-[4rem]">Votre coiffure, sans attendre.</h1>
      <p className="mt-4 max-w-md text-[15px] leading-relaxed text-white/75">
        Choisissez votre modèle et demandez votre rendez-vous en une minute. Le salon vous confirme l&apos;heure sur WhatsApp.
      </p>
      <Link href="/reserver" className={buttonClasses("or", "lg", "mt-7 w-full sm:w-auto")}>
        Demander un rendez-vous
      </Link>
      {horaires && (
        <p className="mt-5 flex items-center gap-2 text-sm text-white/70">
          <IconClock width={16} height={16} className="shrink-0 text-or" />
          <span>Ouvert · {horaires}</span>
        </p>
      )}
    </>
  );
}

function Hero({ horaires = null }: { horaires?: string | null }) {
  return (
    <section className="texture-noire">
      <div className="mx-auto max-w-5xl px-4 pt-12 pb-12 sm:pt-20 sm:pb-16">
        <div className="max-w-xl">
          <Accroche horaires={horaires} />
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

const FAMILLES: { valeur: Famille; titre: string }[] = [
  { valeur: "coiffure", titre: "Coiffure" },
  { valeur: "ongles", titre: "Ongles : manucure et pédicure" },
];

function Videos({ salon }: { salon: SalonPublic }) {
  return (
    <section className="mt-12" aria-labelledby="titre-videos">
      <h2 id="titre-videos" className="font-display text-[2rem] leading-none font-bold">
        Voyez le résultat en vidéo
      </h2>
      <p className="mt-2 text-sm text-sourdine">Le volume, la couleur, la finition : faites glisser, touchez pour le son.</p>
      <div className="mt-4">
        <VideosDefilantes videos={salon.videos.slice(0, 12)} modeles={salon.modeles} />
      </div>
    </section>
  );
}

function Services({ salon }: { salon: SalonPublic }) {
  const groupes = FAMILLES.map((f) => ({ ...f, types: salon.categories.filter((c) => c.famille === f.valeur) })).filter((g) => g.types.length > 0);
  if (groupes.length === 0) return null;
  return (
    <section className="mt-12" aria-labelledby="titre-services">
      <h2 id="titre-services" className="font-display text-[2rem] leading-none font-bold">
        Nos services
      </h2>
      <p className="mt-2 text-sm text-sourdine">Vous avez déjà votre photo ? Choisissez le type, vous l&apos;enverrez sur WhatsApp ensuite.</p>
      <div className="mt-4 flex flex-col gap-5">
        {groupes.map((g) => (
          <div key={g.valeur}>
            <h3 className="mb-2 text-sm font-semibold text-or-fonce">{g.titre}</h3>
            <ul className="flex flex-wrap gap-2">
              {g.types.map((c) => (
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
          </div>
        ))}
      </div>
    </section>
  );
}

function Equipe({ salon }: { salon: SalonPublic }) {
  const nomType = new Map(salon.categories.map((c) => [c.id, c.nom]));
  return (
    <section className="mt-12" aria-labelledby="titre-equipe">
      <h2 id="titre-equipe" className="font-display text-[2rem] leading-none font-bold">
        Notre équipe
      </h2>
      <p className="mt-2 text-sm text-sourdine">Les mieux notées par nos clientes passent en premier. Touchez pour la choisir.</p>
      <ul className="defile-x -mx-4 mt-4 gap-3 px-4 pb-2">
        {salon.coiffeuses.slice(0, 30).map((c) => {
          const specialites = c.categorieIds.map((id) => nomType.get(id)).filter(Boolean).slice(0, 2);
          return (
            <li key={c.id} className="w-[44%] sm:w-[30%] lg:w-[20%]">
              <Link href={`/reserver?coiffeuse=${c.id}`} className="group block">
                <span className="block overflow-hidden rounded-[1.25rem] bg-sable shadow-carte">
                  <PhotoCoiffeuse nom={c.nom} photoUrl={c.photoUrl} className="aspect-[4/5] w-full transition-transform duration-500 group-hover:scale-[1.03]" />
                </span>
                <span className="mt-2 block text-sm leading-snug font-semibold">{c.nom}</span>
                <NoteCoiffeuse note={c.note} nbAvis={c.nbAvis} />
                {specialites.length > 0 && <span className="mt-0.5 block text-xs leading-snug text-sourdine">{specialites.join(", ")}</span>}
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

function NousTrouver({ salon }: { salon: SalonPublic }) {
  const tel = salon.telephone?.replace(/\s/g, "");
  const lignes: { icone: ReactNode; titre: string; texte: string; lien: string | null }[] = [];
  if (salon.horaires) lignes.push({ icone: <IconClock />, titre: "Horaires", texte: salon.horaires, lien: null });
  if (salon.adresse) lignes.push({ icone: <IconPin />, titre: "Adresse", texte: salon.adresse, lien: salon.carteUrl });
  if (salon.telephone) lignes.push({ icone: <IconPhone />, titre: "Téléphone", texte: salon.telephone, lien: tel ? `tel:${tel}` : null });
  if (salon.email) lignes.push({ icone: <IconMail />, titre: "Email", texte: salon.email, lien: `mailto:${salon.email}` });
  if (lignes.length === 0) return null;
  return (
    <section className="mt-12" aria-labelledby="titre-contact">
      <h2 id="titre-contact" className="font-display text-[2rem] leading-none font-bold">
        Nous trouver
      </h2>
      <p className="mt-2 text-sm text-sourdine">Deux équipes se relaient : venez avant d&apos;aller au travail, ou à la descente.</p>
      <ul className="mt-4 divide-y divide-trait overflow-hidden rounded-2xl bg-white shadow-carte">
        {lignes.map((l) => (
          <li key={l.titre} className="flex items-start gap-3 px-4 py-3.5">
            <span className="mt-0.5 shrink-0 text-or-fonce">{l.icone}</span>
            <div className="min-w-0 flex-1">
              <p className="text-xs text-sourdine">{l.titre}</p>
              <p className="text-[15px] leading-snug [overflow-wrap:anywhere]">{l.texte}</p>
            </div>
            {l.lien && (
              <a
                href={l.lien}
                {...(l.lien.startsWith("https") ? { target: "_blank", rel: "noopener noreferrer" } : {})}
                className="flex min-h-11 shrink-0 items-center rounded-full border border-trait px-4 text-sm font-medium hover:border-or hover:bg-or-pale"
              >
                {l.titre === "Adresse" ? "Itinéraire" : l.titre === "Téléphone" ? "Appeler" : "Écrire"}
              </a>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}

function AppelFinal({ salon }: { salon: SalonPublic }) {
  const wa = salon.whatsapp ? lienWhatsApp(salon.whatsapp, "Bonjour, j'ai une question pour un rendez-vous.") : null;
  return (
    <section className="texture-noire mt-12 mb-12 overflow-hidden rounded-[1.75rem] p-6 text-white">
      <h2 className="font-display text-[1.9rem] leading-tight font-bold">Prête pour votre nouveau look ?</h2>
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
  );
}
