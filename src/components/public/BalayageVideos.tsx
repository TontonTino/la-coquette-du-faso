"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, type ReactNode, type TouchEvent } from "react";
import { IconPlay } from "@/components/ui/icons";

const DISTANCE_MIN = 70; // px à parcourir vers la gauche
const BORD_SYSTEME = 24; // le bord de l'écran est réservé aux gestes du téléphone

/** Vrai si le doigt est posé sur une zone qui défile déjà de gauche à droite (galerie, équipe) ou sur un champ. */
function zoneQuiDefile(depart: EventTarget | null): boolean {
  for (let el = depart instanceof Element ? depart : null; el && el !== document.body; el = el.parentElement) {
    if (el.matches("input, textarea, select")) return true;
    if (el.scrollWidth > el.clientWidth + 1) {
      const o = getComputedStyle(el).overflowX;
      if (o === "auto" || o === "scroll") return true;
    }
  }
  return false;
}

/**
 * Accueil : un balayage du doigt vers la gauche ouvre la page des vidéos.
 * Un petit onglet « Vidéos » sur le bord droit montre le chemin et sert aussi à l'ordinateur.
 */
export function BalayageVideos({ children }: { children: ReactNode }) {
  const routeur = useRouter();
  const depart = useRef<{ x: number; y: number; t: number; ok: boolean } | null>(null);

  const debut = (e: TouchEvent) => {
    const p = e.touches[0];
    depart.current = e.touches.length === 1 ? { x: p.clientX, y: p.clientY, t: Date.now(), ok: p.clientX < window.innerWidth - BORD_SYSTEME && !zoneQuiDefile(e.target) } : null;
  };
  const fin = (e: TouchEvent) => {
    const d = depart.current;
    depart.current = null;
    if (!d?.ok) return;
    const p = e.changedTouches[0];
    const dx = p.clientX - d.x;
    const dy = Math.abs(p.clientY - d.y);
    if (dx <= -DISTANCE_MIN && -dx > dy * 1.8 && Date.now() - d.t < 900) routeur.push("/videos");
  };

  return (
    <div onTouchStart={debut} onTouchEnd={fin} onTouchCancel={() => (depart.current = null)}>
      {children}
      <Link
        href="/videos"
        className="fixed top-1/2 right-0 z-20 flex min-h-12 -translate-y-1/2 items-center gap-1.5 rounded-l-full bg-noir/85 py-2 pr-2.5 pl-4 text-xs font-medium text-or shadow-photo backdrop-blur"
      >
        Vidéos
        <IconPlay width={14} height={14} fill="currentColor" />
      </Link>
    </div>
  );
}
