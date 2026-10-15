import Image from "next/image";
import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { HabillagePublic } from "@/components/public/Habillage";
import { IconChevronLeft } from "@/components/ui/icons";
import { fourchetteDuree, fourchettePrix } from "@/lib/salon/regles";
import { vitrineDuSalon } from "@/lib/salon/vitrine";
import { salonPublic } from "@/server/salon/service";

export function RealisationsSalon({ slug, base }: { slug: string; base: string }) {
  return (
    <HabillagePublic slug={slug} base={base}>
      <Link href={base || "/"} className="-ml-1 inline-flex min-h-11 items-center gap-1 text-sm font-medium text-or-fonce">
        <IconChevronLeft width={18} height={18} />
        Accueil
      </Link>
      <h1 className="font-display text-[2.5rem] leading-[0.95] font-bold">Nos réalisations</h1>
      <p className="mt-3 text-sm text-sourdine">Les coiffures réalisées au salon. Touchez un modèle pour le réserver.</p>
      <Suspense fallback={<div className="mt-6 h-96 animate-pulse rounded-3xl bg-sable" />}>
        <Bibliotheque slug={slug} base={base} />
      </Suspense>
    </HabillagePublic>
  );
}

async function Bibliotheque({ slug, base }: { slug: string; base: string }) {
  await connection(); // données à jour à chaque visite
  const salon = await salonPublic(slug);
  const photos = vitrineDuSalon(slug).realisations;
  if (!salon || (salon.modeles.length === 0 && photos.length === 0)) return <p className="mt-6 text-sm text-sourdine">Les réalisations arrivent bientôt.</p>;
  return (
    <ul className="mt-6 grid grid-cols-2 gap-x-3 gap-y-6 sm:grid-cols-3">
      {photos.map((p) => (
        <li key={p.src}>
          <span className="block overflow-hidden rounded-[1.25rem] bg-sable shadow-photo">
            <Image src={p.src} alt={p.alt} width={p.largeur} height={p.hauteur} sizes="(min-width: 640px) 33vw, 50vw" className="aspect-[4/5] w-full object-cover" />
          </span>
        </li>
      ))}
      {salon.modeles.map((m) => (
        <li key={m.id}>
          <Link href={`${base}/reserver?modele=${m.id}`} className="group block">
            <span className="block overflow-hidden rounded-[1.25rem] bg-sable shadow-photo">
              {/* eslint-disable-next-line @next/next/no-img-element -- photo servie par l'application, déjà réduite */}
              <img src={m.photoUrl} alt={m.nom} loading="lazy" draggable={false} className="aspect-[4/5] w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]" />
            </span>
            <span className="mt-2 block font-display text-xl leading-tight font-bold">{m.nom}</span>
            <span className="block text-xs text-sourdine">{[fourchettePrix(m.prixMin, m.prixMax), fourchetteDuree(m.dureeMin, m.dureeMax)].filter(Boolean).join(", ")}</span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
