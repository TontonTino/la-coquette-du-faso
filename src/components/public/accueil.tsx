import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";
import { buttonClasses } from "@/components/ui/Button";
import { IconClock, IconPin, IconWhatsApp } from "@/components/ui/icons";
import type { PhotoVitrine, Vitrine } from "@/lib/salon/vitrine";

/** Petite ligne, titre en grand et filet : l'entête commune des sections de l'accueil. */
export function TitreSection({ id, etiquette, titre, clair = false, children }: { id: string; etiquette: string; titre: string; clair?: boolean; children?: ReactNode }) {
  return (
    <header>
      <p className={`text-xs font-medium tracking-[0.2em] uppercase ${clair ? "text-detail" : "text-accent-texte"}`}>{etiquette}</p>
      <h2 id={id} className="mt-2 font-display text-[2.4rem] leading-[0.95] font-bold text-balance sm:text-[3rem]">
        {titre}
      </h2>
      <span className="mt-4 block h-0.5 w-12 bg-detail" aria-hidden />
      {children}
    </header>
  );
}

function titreAvecAccent(titre: string) {
  return titre.split(/(\*[^*]+\*)/).map((m, i) => (m.startsWith("*") ? <span key={i} className="text-detail">{m.slice(1, -1)}</span> : m));
}

/**
 * Première vue. Mobile : la photo occupe tout l'écran, le titre s'appuie sur un dégradé de la couleur de marque.
 * Ordinateur : texte à gauche, photo en arche à droite (comme les miroirs du salon). Sans photo : aplat de marque.
 */
export function Couverture({ vitrine, horaires }: { vitrine: Vitrine; horaires: string | null }) {
  const img = vitrine.couverture;
  return (
    <section className="surface-sombre relative overflow-hidden bg-marque text-white">
      <div className="mx-auto max-w-6xl lg:grid lg:grid-cols-[1.05fr_1fr] lg:items-center lg:gap-12 lg:px-6">
        {img && (
          <div className="relative h-[23rem] overflow-hidden lg:h-auto lg:order-2 lg:my-12 lg:aspect-[4/5] lg:max-h-[640px] lg:w-full lg:rounded-t-[16rem] lg:rounded-b-[2rem]">
            <Image
              src={img.src}
              alt={img.alt}
              fill
              priority
              sizes="(min-width: 1024px) 520px, 100vw"
              className="origin-bottom scale-[1.3] object-cover lg:scale-100"
              style={{ objectPosition: img.cadrage ?? "50% 50%" }}
            />
            <div className="absolute inset-0 bg-gradient-to-t from-marque from-0% via-marque/40 via-35% to-transparent to-70% lg:hidden" aria-hidden />
          </div>
        )}
        <div className={`relative z-10 flex flex-col px-5 pb-10 lg:min-h-0 lg:justify-center lg:px-0 lg:py-16 ${img ? "-mt-20 lg:mt-0" : "pt-14"}`}>
          <p className="text-xs font-medium tracking-[0.22em] text-detail uppercase">{vitrine.etiquette}</p>
          <h1 className="mt-3 max-w-[12ch] font-display text-[3.5rem] leading-[0.9] font-bold text-balance sm:max-w-[14ch] sm:text-[5rem] lg:text-[5.5rem]">{titreAvecAccent(vitrine.titre)}</h1>
          <p className="mt-5 max-w-md text-base leading-relaxed text-white/90">{vitrine.accroche}</p>
          <div className="mt-7 flex flex-col gap-3 sm:flex-row sm:items-center">
            <Link href="/reserver" className={buttonClasses("or", "lg", "w-full sm:w-auto")}>
              Demander un rendez-vous
            </Link>
            <a href="#prestations" className="inline-flex min-h-11 items-center justify-center text-sm font-medium text-white underline decoration-detail decoration-2 underline-offset-8">
              Voir les prestations
            </a>
          </div>
          {horaires && (
            <p className="mt-6 flex items-center gap-2 text-sm text-white/85">
              <IconClock width={16} height={16} className="shrink-0 text-detail" />
              <span>{horaires}</span>
            </p>
          )}
        </div>
      </div>
    </section>
  );
}

/** Adresse et WhatsApp d'un coup d'œil (les horaires sont dans la couverture) : uniquement ce que le salon a renseigné. */
export function BandeInfos({ adresse, whatsappLien }: { adresse: string | null; whatsappLien: string | null }) {
  const items: { cle: string; icone: ReactNode; texte: ReactNode }[] = [];
  if (adresse) items.push({ cle: "a", icone: <IconPin width={18} height={18} />, texte: adresse });
  if (whatsappLien)
    items.push({
      cle: "w",
      icone: <IconWhatsApp width={18} height={18} />,
      texte: (
        <a href={whatsappLien} className="font-medium underline decoration-detail decoration-2 underline-offset-4">
          Écrire au salon sur WhatsApp
        </a>
      ),
    });
  if (items.length === 0) return null;
  return (
    <div className="border-b border-trait bg-white">
      <ul className="mx-auto grid max-w-5xl gap-x-6 gap-y-3 px-4 py-4 text-sm sm:grid-cols-2">
        {items.map((i) => (
          <li key={i.cle} className="flex items-start gap-2.5">
            <span className="mt-0.5 shrink-0 text-accent-texte">{i.icone}</span>
            <span className="leading-snug">{i.texte}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Carte d'une famille de services : photo (ou aplat de couleur sans photo) et types à demander. */
export function CartePrestation({
  titre,
  sousTitre,
  photo,
  types,
  ton,
}: {
  titre: string;
  sousTitre: string;
  photo?: PhotoVitrine | null;
  types: { id: string; nom: string }[];
  ton: "photo" | "terracotta";
}) {
  return (
    <article className="overflow-hidden rounded-[2rem] bg-white shadow-carte">
      {photo ? (
        <div className="relative aspect-[4/3] bg-sable sm:aspect-[16/10]">
          <Image src={photo.src} alt="" fill sizes="(min-width: 768px) 480px, 100vw" className="object-cover" style={{ objectPosition: photo.cadrage ?? "50% 50%" }} />
          <div className="absolute inset-0 bg-gradient-to-t from-marque/90 via-marque/20 to-transparent" aria-hidden />
          <h3 className="absolute bottom-4 left-5 font-display text-[2.6rem] leading-none font-bold text-white">{titre}</h3>
        </div>
      ) : (
        <div className={`surface-sombre relative flex aspect-[4/3] items-end overflow-hidden p-5 sm:aspect-[16/10] ${ton === "terracotta" ? "bg-action text-white" : "bg-marque text-white"}`}>
          <span className="absolute -top-10 -right-10 size-44 rounded-full border-[18px] border-white/15" aria-hidden />
          <h3 className="relative font-display text-[2.6rem] leading-none font-bold">{titre}</h3>
        </div>
      )}
      <div className="p-5">
        <p className="text-sm text-sourdine">{sousTitre}</p>
        <ul className="mt-3 flex flex-wrap gap-2">
          {types.map((t) => (
            <li key={t.id}>
              <Link href={`/reserver?type=${t.id}`} className="inline-flex min-h-11 items-center rounded-full border border-champ bg-white px-4 text-sm font-medium hover:bg-accent-pale">
                {t.nom}
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </article>
  );
}

/** « Le salon » : la photo de l'équipe, et trois portraits qui la chevauchent. */
export function SectionSalon({ salon }: { salon: NonNullable<Vitrine["salon"]> }) {
  const { equipe, portraits } = salon;
  return (
    <section className="mt-16 bg-accent-pale py-14" aria-labelledby="titre-salon">
      <div className="mx-auto max-w-5xl px-4">
        <TitreSection id="titre-salon" etiquette="Le salon" titre={salon.titre}>
          <p className="mt-4 max-w-xl text-[15px] leading-relaxed text-encre/80">{salon.texte}</p>
        </TitreSection>
        {equipe && (
          <div className="mt-8">
            <Image
              src={equipe.src}
              alt={equipe.alt}
              width={equipe.largeur}
              height={equipe.hauteur}
              sizes="(min-width: 1024px) 1000px, 100vw"
              className="aspect-[16/10] w-full rounded-[2rem] object-cover shadow-photo sm:aspect-[27/10]"
              style={{ objectPosition: "50% 65%" }}
            />
          </div>
        )}
        {portraits.length > 0 && (
          <div className="relative z-10 -mt-8 flex items-center gap-4 pl-5">
            <ul className="flex">
              {portraits.map((p, i) => (
                <li key={p.src} className={`shrink-0 ${i > 0 ? "-ml-4" : ""}`}>
                  <Image src={p.src} alt={p.alt} width={p.largeur} height={p.hauteur} sizes="80px" className="size-20 shrink-0 rounded-full object-cover ring-4 ring-accent-pale" style={{ objectPosition: p.cadrage ?? "50% 20%" }} />
                </li>
              ))}
            </ul>
            <p className="text-sm font-medium text-encre">Des coiffeuses qui vous attendent</p>
          </div>
        )}
      </div>
    </section>
  );
}
