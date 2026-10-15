import Image from "next/image";
import Link from "next/link";
import { connection } from "next/server";
import { Suspense, type ReactNode } from "react";
import { NoteCoiffeuse, PhotoCoiffeuse } from "@/components/public/Equipe";
import { GalerieDefilante } from "@/components/public/GalerieDefilante";
import { HabillagePublic } from "@/components/public/Habillage";
import { BalayageVideos } from "@/components/public/BalayageVideos";
import { BandeInfos, CartePrestation, Couverture, SectionSalon, TitreSection } from "@/components/public/accueil";
import { buttonClasses } from "@/components/ui/Button";
import { IconClock, IconMail, IconPhone, IconPin, IconWhatsApp } from "@/components/ui/icons";
import { lienWhatsApp } from "@/lib/salon/whatsapp";
import { vitrineDuSalon, type Vitrine } from "@/lib/salon/vitrine";
import type { Famille } from "@/lib/salon/types";
import { salonPublic, type SalonPublic } from "@/server/salon/service";

const GALERIE_MAX = 40;

const ETAPES = [
  { titre: "Vous choisissez", texte: "Un modèle en photo ou un type de service, puis le jour qui vous arrange." },
  { titre: "Vous prenez une heure libre", texte: "Vous voyez les créneaux réellement libres et votre rendez-vous est confirmé tout de suite." },
  { titre: "Vous venez au salon", texte: "Votre coiffeuse vous attend : fini les longues attentes." },
];

/** Accueil d'un salon. `base` : début des adresses du salon (vide à la racine du site, « /s/<identifiant> » sinon). */
export function AccueilSalon({ slug, base }: { slug: string; base: string }) {
  return (
    <HabillagePublic slug={slug} base={base} plein>
      <Suspense fallback={<Couverture vitrine={vitrineDuSalon(slug)} horaires={null} base={base} />}>
        <Contenu slug={slug} base={base} />
      </Suspense>
    </HabillagePublic>
  );
}

async function Contenu({ slug, base }: { slug: string; base: string }) {
  await connection(); // données à jour à chaque visite (pas de rendu figé au build)
  const salon = await salonPublic(slug);
  const vitrine = vitrineDuSalon(slug, salon?.vitrineBrute);
  const wa = salon?.whatsapp ? lienWhatsApp(salon.whatsapp, "Bonjour, j'ai une question pour un rendez-vous.") : null;
  const page = (
    <>
      <Couverture vitrine={vitrine} horaires={salon?.horaires ?? null} base={base} />
      {salon && <BandeInfos adresse={salon.adresse} whatsappLien={wa} />}
      <div className="mx-auto max-w-5xl px-4">
        {salon && <Services salon={salon} vitrine={vitrine} base={base} />}
        {(vitrine.realisations.length > 0 || (salon && salon.modeles.length > 0)) && <Galerie modeles={salon?.modeles ?? []} vitrine={vitrine} base={base} />}
      </div>
      {vitrine.salon && <SectionSalon salon={vitrine.salon} />}
      <div className="mx-auto max-w-5xl px-4">
        {salon && salon.coiffeuses.length > 0 && <Equipe salon={salon} base={base} />}
        <Etapes />
        {salon && <NousTrouver salon={salon} vitrine={vitrine} />}
        {salon && <AppelFinal salon={salon} wa={wa} base={base} />}
      </div>
    </>
  );
  // Avec des vidéos publiées : un balayage vers la droite ouvre la page des vidéos.
  return salon && salon.videos.length > 0 ? <BalayageVideos base={base}>{page}</BalayageVideos> : page;
}

/* ------------------------------------------------------------------ */

function Galerie({ modeles, vitrine, base }: { modeles: SalonPublic["modeles"]; vitrine: Vitrine; base: string }) {
  return (
    <section className="mt-16" aria-labelledby="titre-modeles">
      <div className="flex items-end justify-between gap-4">
        <TitreSection id="titre-modeles" etiquette="Réalisations" titre="Nos réalisations" />
        <Link href={`${base}/realisations`} className="mb-1 inline-flex min-h-11 shrink-0 items-center text-sm font-medium text-accent-texte underline decoration-detail decoration-2 underline-offset-4">
          Tout voir
        </Link>
      </div>
      <p className="mt-4 text-sm text-sourdine">{modeles.length > 0 ? "Faites glisser pour voir plus, touchez un modèle pour le réserver." : "Les coiffures réalisées au salon. Faites glisser pour voir plus."}</p>
      {/* Les plus récents seulement : la page reste légère même avec des milliers de modèles. */}
      <GalerieDefilante modeles={modeles.slice(0, GALERIE_MAX)} photos={vitrine.realisations} base={base} />
      <Link href={`${base}/reserver`} className={buttonClasses("action", "lg", "mt-6 w-full sm:w-auto")}>
        Réserver un rendez-vous
      </Link>
    </section>
  );
}

function Etapes() {
  return (
    <section className="mt-16" aria-labelledby="titre-etapes">
      <TitreSection id="titre-etapes" etiquette="En trois étapes" titre="Comment ça marche" />
      {/* Un fil relie les trois étapes : c'est un parcours, dans l'ordre. */}
      <ol className="relative mt-8 flex flex-col gap-8 pl-16 before:absolute before:top-3 before:bottom-3 before:left-[1.4rem] before:w-px before:bg-gradient-to-b before:from-detail before:via-detail/60 before:to-detail/10">
        {ETAPES.map((e, i) => (
          <li key={e.titre} className="relative">
            <span className="absolute top-0 -left-16 flex size-12 items-center justify-center rounded-full bg-marque font-display text-2xl font-bold text-detail" aria-hidden>
              {i + 1}
            </span>
            <p className="pt-1 font-display text-2xl leading-tight font-bold">{e.titre}</p>
            <p className="mt-1 text-sm leading-relaxed text-sourdine">{e.texte}</p>
          </li>
        ))}
      </ol>
    </section>
  );
}

const FAMILLES: { valeur: Famille; titre: string; sousTitre: string; ton: "photo" | "terracotta" }[] = [
  { valeur: "coiffure", titre: "Coiffure", sousTitre: "Choisissez le type de coiffure, puis une heure libre.", ton: "photo" },
  { valeur: "ongles", titre: "Ongles", sousTitre: "Manucure et pédicure, avec nos spécialistes.", ton: "terracotta" },
];

function Services({ salon, vitrine, base }: { salon: SalonPublic; vitrine: Vitrine; base: string }) {
  const groupes = FAMILLES.map((f) => ({ ...f, types: salon.categories.filter((c) => c.famille === f.valeur) })).filter((g) => g.types.length > 0);
  if (groupes.length === 0) return null;
  return (
    <section id="prestations" className="mt-14 scroll-mt-20" aria-labelledby="titre-services">
      <TitreSection id="titre-services" etiquette="Nos prestations" titre="Choisissez votre service" />
      <div className={`mt-8 grid gap-5 ${groupes.length > 1 ? "md:grid-cols-2" : ""}`}>
        {groupes.map((g) => (
          <CartePrestation key={g.valeur} titre={g.titre} sousTitre={g.sousTitre} photo={vitrine.familles[g.valeur as "coiffure" | "ongles"] ?? null} types={g.types} ton={g.ton} base={base} />
        ))}
      </div>
    </section>
  );
}

function Equipe({ salon, base }: { salon: SalonPublic; base: string }) {
  const nomType = new Map(salon.categories.map((c) => [c.id, c.nom]));
  return (
    <section className="mt-16" aria-labelledby="titre-equipe">
      <TitreSection id="titre-equipe" etiquette="Votre coiffeuse" titre="Notre équipe" />
      <p className="mt-4 text-sm text-sourdine">Les mieux notées par nos clientes passent en premier. Touchez pour la choisir.</p>
      <ul className="defile-x -mx-4 mt-5 gap-2 px-4 pb-2">
        {salon.coiffeuses.slice(0, 30).map((c) => {
          const specialites = c.categorieIds.map((id) => nomType.get(id)).filter(Boolean).slice(0, 2);
          return (
            <li key={c.id} className="w-[7.5rem]">
              <Link href={`${base}/reserver?coiffeuse=${c.id}`} className="group flex flex-col items-center text-center">
                <PhotoCoiffeuse nom={c.nom} photoUrl={c.photoUrl} className="size-24 text-[2rem] shadow-carte ring-2 ring-detail/60 transition-transform duration-500 group-hover:scale-[1.04]" />
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

function NousTrouver({ salon, vitrine }: { salon: SalonPublic; vitrine: Vitrine }) {
  const tel = salon.telephone?.replace(/\s/g, "");
  const lignes: { icone: ReactNode; titre: string; texte: string; lien: string | null }[] = [];
  if (salon.horaires) lignes.push({ icone: <IconClock />, titre: "Horaires", texte: salon.horaires, lien: null });
  if (salon.adresse) lignes.push({ icone: <IconPin />, titre: "Adresse", texte: salon.adresse, lien: salon.carteUrl });
  if (salon.telephone) lignes.push({ icone: <IconPhone />, titre: "Téléphone", texte: salon.telephone, lien: tel ? `tel:${tel}` : null });
  if (salon.email) lignes.push({ icone: <IconMail />, titre: "Email", texte: salon.email, lien: `mailto:${salon.email}` });
  if (lignes.length === 0) return null;
  const f = vitrine.facade;
  return (
    <section className="mt-16" aria-labelledby="titre-contact">
      <TitreSection id="titre-contact" etiquette="Venir au salon" titre="Nous trouver" />
      {vitrine.noteVenir && <p className="mt-4 text-sm text-sourdine">{vitrine.noteVenir}</p>}
      <div className={`mt-6 grid gap-5 ${f ? "md:grid-cols-[1fr_1.2fr] md:items-start" : ""}`}>
        {f && (
          <Image src={f.src} alt={f.alt} width={f.largeur} height={f.hauteur} sizes="(min-width: 768px) 400px, 100vw" className="aspect-[4/3] w-full rounded-[2rem] object-cover shadow-photo md:aspect-[4/5] md:max-h-[28rem]" style={{ objectPosition: f.cadrage ?? "50% 30%" }} />
        )}
        <ul className="divide-y divide-trait self-start overflow-hidden rounded-2xl bg-white shadow-carte">
          {lignes.map((l) => (
            <li key={l.titre} className="flex items-start gap-3 px-4 py-3.5">
              <span className="mt-0.5 shrink-0 text-accent-texte">{l.icone}</span>
              <div className="min-w-0 flex-1">
                <p className="text-xs text-sourdine">{l.titre}</p>
                <p className="text-[15px] leading-snug [overflow-wrap:anywhere]">{l.texte}</p>
              </div>
              {l.lien && (
                <a
                  href={l.lien}
                  {...(l.lien.startsWith("https") ? { target: "_blank", rel: "noopener noreferrer" } : {})}
                  className="flex min-h-11 shrink-0 items-center rounded-full border border-champ px-4 text-sm font-medium hover:bg-accent-pale"
                >
                  {l.titre === "Adresse" ? "Itinéraire" : l.titre === "Téléphone" ? "Appeler" : "Écrire"}
                </a>
              )}
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

function AppelFinal({ salon, wa, base }: { salon: SalonPublic; wa: string | null; base: string }) {
  return (
    <section className="surface-sombre relative mt-16 mb-14 overflow-hidden rounded-[2rem] bg-marque p-7 text-white sm:p-10">
      <span className="absolute -right-14 -bottom-14 size-52 rounded-full border-[22px] border-white/10" aria-hidden />
      <h2 className="relative font-display text-[2.4rem] leading-[0.95] font-bold text-balance sm:text-[3rem]">
        Prête pour votre <span className="text-detail">nouveau look</span> ?
      </h2>
      <p className="relative mt-3 max-w-md text-sm text-white/85">Choisissez votre heure maintenant : c’est confirmé tout de suite.</p>
      <div className="relative mt-6 flex flex-col gap-3 sm:flex-row">
        <Link href={`${base}/reserver`} className={buttonClasses("or", "lg", "w-full sm:w-auto")}>
          Réserver ma place
        </Link>
        {wa && (
          <a href={wa} className={buttonClasses("contour-clair", "lg", "w-full sm:w-auto")}>
            <IconWhatsApp width={20} height={20} />
            Écrire au salon
          </a>
        )}
      </div>
      {salon.whatsapp && <p className="relative mt-4 text-xs text-white/70">WhatsApp du salon : {salon.whatsapp}</p>}
    </section>
  );
}
