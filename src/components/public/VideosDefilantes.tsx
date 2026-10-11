"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { IconPlay, IconSilence, IconSon } from "@/components/ui/icons";
import { fourchettePrix } from "@/lib/salon/regles";
import type { Modele, Video } from "@/lib/salon/types";

/**
 * Vidéos courtes du salon, à faire glisser de droite à gauche : la cliente voit le volume, la couleur
 * et la qualité d'une coiffure, puis la demande d'un geste.
 * Économe en données mobiles (elles sont chères) : une vidéo ne se charge que lorsqu'elle devient la vidéo
 * en vue ; une seule joue à la fois, sans le son ; rien ne démarre seul avec « économiser les données »
 * ou « réduire les animations ».
 */
export function VideosDefilantes({ videos, modeles }: { videos: Video[]; modeles: Modele[] }) {
  const piste = useRef<HTMLUListElement>(null);
  const ratios = useRef(new Map<string, number>());
  const [actif, setActif] = useState<string | null>(null);
  // Lu une fois dans le navigateur (côté serveur : false). Ne change pas l'affichage, seulement la lecture automatique.
  const [autoplay] = useState(() => {
    if (typeof window === "undefined") return false;
    const economie = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection?.saveData === true;
    return !economie && !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  });
  const modeleDe = (id: string | null) => modeles.find((m) => m.id === id) ?? null;

  // La vidéo la plus visible (au moins 60 %) devient la vidéo active.
  useEffect(() => {
    const racine = piste.current;
    if (!racine) return;
    const obs = new IntersectionObserver(
      (entrees) => {
        for (const e of entrees) ratios.current.set((e.target as HTMLElement).dataset.video ?? "", e.isIntersecting ? e.intersectionRatio : 0);
        let meilleur: string | null = null;
        let max = 0.6;
        for (const [id, r] of ratios.current) {
          if (r >= max) {
            max = r;
            meilleur = id;
          }
        }
        setActif((avant) => (meilleur === null && avant !== null && (ratios.current.get(avant) ?? 0) > 0.3 ? avant : meilleur));
      },
      { root: racine, threshold: [0, 0.3, 0.6, 0.8, 1] },
    );
    racine.querySelectorAll("[data-video]").forEach((el) => obs.observe(el));
    return () => obs.disconnect();
  }, [videos]);

  return (
    <ul ref={piste} className="defile-x -mx-4 gap-3 px-4 pb-2" aria-label="Vidéos des coiffures">
      {videos.map((v) => (
        <Carte key={v.id} video={v} modele={modeleDe(v.modeleId)} actif={actif === v.id} autoplay={autoplay} />
      ))}
    </ul>
  );
}

function Carte({ video, modele, actif, autoplay }: { video: Video; modele: Modele | null; actif: boolean; autoplay: boolean }) {
  const lecteur = useRef<HTMLVideoElement>(null);
  const [charge, setCharge] = useState(false); // la source n'est donnée qu'une fois la vidéo demandée
  const [son, setSon] = useState(false);
  const [lecture, setLecture] = useState(false);
  const [erreur, setErreur] = useState(false);
  const [voulue, setVoulue] = useState(false); // la cliente a touché « lecture » (mode économie de données)

  const veutJouer = actif && (autoplay || voulue);

  // Le fichier n'est demandé qu'au moment où la vidéo doit jouer (économie de données mobiles).
  if (veutJouer && !charge) setCharge(true);
  if (!actif && son) setSon(false);

  // Lecture quand la vidéo est en vue ; pause dès qu'elle ne l'est plus.
  useEffect(() => {
    const v = lecteur.current;
    if (!v) return;
    v.muted = !son;
    if (veutJouer) v.play().catch(() => setLecture(false));
    else v.pause();
  }, [veutJouer, charge, son]);

  const toucher = () => {
    if (!charge) {
      setVoulue(true);
      setCharge(true);
      return;
    }
    const v = lecteur.current;
    if (!v) return;
    if (v.paused) v.play().catch(() => setLecture(false));
    else v.pause();
  };

  const prix = modele ? fourchettePrix(modele.prixMin, modele.prixMax) : "";
  return (
    <li data-video={video.id} className="w-[64%] sm:w-[34%] lg:w-[22%]">
      <div className="relative aspect-[9/16] overflow-hidden rounded-[1.5rem] bg-noir shadow-photo">
        {modele && (
          // eslint-disable-next-line @next/next/no-img-element -- image d'attente : la photo du modèle
          <img src={modele.photoUrl} alt="" loading="lazy" draggable={false} className="absolute inset-0 size-full object-cover opacity-70" />
        )}
        {charge && !erreur && (
          <video
            ref={lecteur}
            src={video.url}
            muted
            loop
            playsInline
            preload="metadata"
            aria-label={video.titre}
            onPlay={() => setLecture(true)}
            onPause={() => setLecture(false)}
            onError={() => setErreur(true)}
            className="absolute inset-0 size-full object-cover"
          />
        )}
        {/* La zone vidéo se touche pour lancer ou mettre en pause. */}
        <button
          type="button"
          onClick={toucher}
          aria-label={lecture ? `Mettre en pause : ${video.titre}` : `Lire la vidéo : ${video.titre}`}
          className="absolute inset-0 flex items-center justify-center"
        >
          {!lecture && !erreur && (
            <span className="flex size-14 items-center justify-center rounded-full bg-noir/65 text-or backdrop-blur">
              <IconPlay width={26} height={26} fill="currentColor" />
            </span>
          )}
        </button>
        {erreur && <p className="absolute inset-x-4 top-1/2 -translate-y-1/2 text-center text-sm text-white/80">Vidéo indisponible pour le moment.</p>}
        {charge && actif && !erreur && (
          <button
            type="button"
            onClick={() => setSon((s) => !s)}
            aria-label={son ? "Couper le son" : "Activer le son"}
            aria-pressed={son}
            className="absolute top-3 right-3 flex size-11 items-center justify-center rounded-full bg-noir/65 text-white backdrop-blur"
          >
            {son ? <IconSon width={20} height={20} /> : <IconSilence width={20} height={20} />}
          </button>
        )}
        <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-noir/90 via-noir/55 to-transparent px-4 pt-14 pb-4 text-white">
          <p className="font-display text-xl leading-tight font-bold">{video.titre}</p>
          {prix && <p className="text-xs text-white/75">{prix}</p>}
          <Link
            href={modele ? `/reserver?modele=${modele.id}` : "/reserver"}
            className="pointer-events-auto mt-3 inline-flex min-h-11 w-full items-center justify-center rounded-full bg-or px-4 text-sm font-semibold text-noir hover:bg-or/90"
          >
            {modele ? "Je veux cette coiffure" : "Demander un rendez-vous"}
          </Link>
        </div>
      </div>
    </li>
  );
}
