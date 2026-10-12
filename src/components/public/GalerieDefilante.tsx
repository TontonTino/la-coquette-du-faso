"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef } from "react";
import { fourchetteDuree, fourchettePrix } from "@/lib/salon/regles";
import type { PhotoVitrine } from "@/lib/salon/vitrine";

export interface CarteModele {
  id: string;
  nom: string;
  photoUrl: string;
  prixMin: number | null;
  prixMax: number | null;
  dureeMin: number | null;
  dureeMax: number | null;
}

const VITESSE = 35; // pixels par seconde
const REPRISE_MS = 2500; // reprise du défilement après un geste de la cliente
const BOUCLE_DES = 5;

type Vignette = { cle: string; modele: CarteModele } | { cle: string; photo: PhotoVitrine };

/**
 * Galerie des réalisations : défile toute seule de droite à gauche, en boucle,
 * et la cliente peut la faire glisser au doigt (le défilement reprend ensuite).
 * Pas de défilement automatique si le téléphone demande moins d'animations.
 */
export function GalerieDefilante({ modeles, photos = [] }: { modeles: CarteModele[]; photos?: PhotoVitrine[] }) {
  const ref = useRef<HTMLUListElement>(null);
  // Les photos du salon d'abord (simples images), puis les modèles que l'on peut demander.
  const elements: Vignette[] = [...photos.map((photo) => ({ cle: photo.src, photo })), ...modeles.map((modele) => ({ cle: modele.id, modele }))];
  // Boucle (liste doublée) dès que les photos dépassent la largeur d'un écran d'ordinateur (4 visibles).
  const boucle = elements.length >= BOUCLE_DES;

  useEffect(() => {
    const el = ref.current;
    if (!el || !boucle) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    // Largeur exacte d'un tour : écart entre la 1re photo et sa copie.
    const tour = () => {
      const k = el.children;
      return (k[k.length / 2] as HTMLElement).offsetLeft - (k[0] as HTMLElement).offsetLeft;
    };
    let pause = false;
    let reprise = 0;
    let precedent = performance.now();
    let position = el.scrollLeft;
    let id = 0;
    const suspendre = () => {
      pause = true;
      window.clearTimeout(reprise);
    };
    const relancer = () => {
      window.clearTimeout(reprise);
      reprise = window.setTimeout(() => {
        position = el.scrollLeft;
        pause = false;
      }, REPRISE_MS);
    };
    const image = (t: number) => {
      const dt = Math.min(t - precedent, 64);
      precedent = t;
      if (!pause && !document.hidden) {
        position += (VITESSE * dt) / 1000;
        if (position >= tour()) position -= tour();
        el.scrollLeft = position;
      } else if (el.scrollLeft >= tour()) {
        el.scrollLeft -= tour(); // boucle aussi quand la cliente fait glisser
      }
      id = requestAnimationFrame(image);
    };
    id = requestAnimationFrame(image);
    const evts: [string, () => void][] = [
      ["pointerdown", suspendre],
      ["touchstart", suspendre],
      ["mouseenter", suspendre],
      ["focusin", suspendre],
      ["pointerup", relancer],
      ["touchend", relancer],
      ["mouseleave", relancer],
      ["focusout", relancer],
      ["wheel", () => (suspendre(), relancer())],
    ];
    evts.forEach(([e, f]) => el.addEventListener(e, f, { passive: true }));
    return () => {
      cancelAnimationFrame(id);
      window.clearTimeout(reprise);
      evts.forEach(([e, f]) => el.removeEventListener(e, f));
    };
  }, [boucle]);

  const largeur = "w-[62%] shrink-0 sm:w-[calc((100%-1.5rem)/3)] lg:w-[calc((100%-2.25rem)/4)]";
  const carte = (e: Vignette, copie: boolean) => {
    const cle = `${copie ? "c" : "o"}-${e.cle}`;
    if ("photo" in e) {
      return (
        <li key={cle} className={largeur} aria-hidden={copie || undefined}>
          <span className="block overflow-hidden rounded-[1.5rem] bg-sable shadow-photo">
            <Image src={e.photo.src} alt={copie ? "" : e.photo.alt} width={e.photo.largeur} height={e.photo.hauteur} sizes="(min-width: 1024px) 250px, (min-width: 640px) 33vw, 62vw" draggable={false} className="aspect-[4/5] w-full object-cover" />
          </span>
        </li>
      );
    }
    const m = e.modele;
    return (
      <li key={cle} className={largeur} aria-hidden={copie || undefined}>
        <Link href={`/reserver?modele=${m.id}`} className="group block" tabIndex={copie ? -1 : undefined}>
          <span className="block overflow-hidden rounded-[1.5rem] bg-sable shadow-photo">
            {/* eslint-disable-next-line @next/next/no-img-element -- photo servie par l'application, déjà réduite */}
            <img src={m.photoUrl} alt={m.nom} loading="lazy" draggable={false} className="aspect-[4/5] w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]" />
          </span>
          <span className="mt-3 block font-display text-[1.35rem] leading-tight font-bold">{m.nom}</span>
          <span className="mt-0.5 block text-sm text-sourdine">
            {[fourchettePrix(m.prixMin, m.prixMax), fourchetteDuree(m.dureeMin, m.dureeMax)].filter(Boolean).join(", ")}
          </span>
          <span className="mt-1.5 inline-block text-sm font-medium text-accent-texte underline decoration-detail underline-offset-4">Demander ce modèle</span>
        </Link>
      </li>
    );
  };

  return (
    <ul ref={ref} className="no-scrollbar -mx-4 mt-4 flex gap-3 overflow-x-auto px-4 pb-2 [overscroll-behavior-x:contain]">
      {elements.map((e) => carte(e, false))}
      {boucle && elements.map((e) => carte(e, true))}
    </ul>
  );
}
