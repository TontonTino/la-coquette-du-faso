"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useSyncExternalStore, type TouchEvent } from "react";
import { IconChevronLeft, IconPlay, IconSilence, IconSon } from "@/components/ui/icons";
import { fourchettePrix } from "@/lib/salon/regles";
import type { Modele, Video } from "@/lib/salon/types";

const DISTANCE_RETOUR = 70;

const abonner = () => () => {};
function lireAutoplay() {
  const economie = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection?.saveData === true;
  return !economie && !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/**
 * Page « Vidéos » : une vidéo par écran, comme sur TikTok. On passe à la suivante en balayant vers le haut,
 * on revient à l'accueil en balayant vers la droite (ou avec la flèche).
 * Économe en données mobiles : seule la vidéo en vue est chargée et jouée ; elle démarre sans le son.
 * Une fois le son activé, il reste activé pour les vidéos suivantes.
 */
export function FilVideos({ videos, modeles, base }: { videos: Video[]; modeles: Modele[]; base: string }) {
  const routeur = useRouter();
  const piste = useRef<HTMLUListElement>(null);
  const ratios = useRef(new Map<string, number>());
  const doigt = useRef<{ x: number; y: number } | null>(null);
  const [actif, setActif] = useState<string | null>(videos[0]?.id ?? null);
  const [son, setSon] = useState(false);
  const [enVue, setEnVue] = useState(() => typeof document === "undefined" || !document.hidden);
  // Lu dans le navigateur ; côté serveur et à l'hydratation : false (évite tout écart d'affichage).
  const autoplay = useSyncExternalStore(abonner, lireAutoplay, () => false);
  // Onglet ou application mise en arrière-plan : tout s'arrête.
  useEffect(() => {
    const f = () => setEnVue(!document.hidden);
    document.addEventListener("visibilitychange", f);
    return () => document.removeEventListener("visibilitychange", f);
  }, []);
  const rang = Math.max(0, videos.findIndex((v) => v.id === actif));

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
        setActif((avant) => (meilleur === null ? avant : meilleur));
      },
      { root: racine, threshold: [0, 0.3, 0.6, 0.8, 1] },
    );
    racine.querySelectorAll("[data-video]").forEach((el) => obs.observe(el));
    return () => obs.disconnect();
  }, [videos]);

  const debut = (e: TouchEvent) => {
    doigt.current = e.touches.length === 1 ? { x: e.touches[0].clientX, y: e.touches[0].clientY } : null;
  };
  const fin = (e: TouchEvent) => {
    const d = doigt.current;
    doigt.current = null;
    if (!d) return;
    const dx = e.changedTouches[0].clientX - d.x;
    const dy = Math.abs(e.changedTouches[0].clientY - d.y);
    if (dx >= DISTANCE_RETOUR && dx > dy * 1.8) routeur.push(base || "/");
  };

  return (
    <div className="relative bg-noir" onTouchStart={debut} onTouchEnd={fin}>
      <div className="pointer-events-none fixed inset-x-0 top-0 z-10 mx-auto flex max-w-[30rem] items-start justify-between px-3 pt-[max(0.75rem,env(safe-area-inset-top))]">
        <Link
          href={base || "/"}
          aria-label="Retour à l'accueil"
          className="pointer-events-auto flex size-11 items-center justify-center rounded-full bg-noir/60 text-white backdrop-blur"
        >
          <IconChevronLeft width={22} height={22} />
        </Link>
        {videos.length > 1 && (
          <p className="mt-2.5 rounded-full bg-noir/60 px-3 py-1 text-xs text-white/85 backdrop-blur" aria-live="polite">
            {rang + 1} / {videos.length}
          </p>
        )}
        <span className="size-11" aria-hidden />
      </div>
      <ul ref={piste} className="defile-y" aria-label="Vidéos des coiffures">
        {videos.map((v, i) => (
          <Carte
            key={v.id}
            video={v}
            modele={modeles.find((m) => m.id === v.modeleId) ?? null}
            actif={actif === v.id && enVue}
            autoplay={autoplay}
            son={son}
            changerSon={() => setSon((s) => !s)}
            base={base}
            indice={i === 0 && videos.length > 1 && actif === v.id}
          />
        ))}
      </ul>
    </div>
  );
}

function Carte({
  video,
  modele,
  actif,
  autoplay,
  son,
  changerSon,
  base,
  indice,
}: {
  video: Video;
  modele: Modele | null;
  actif: boolean;
  autoplay: boolean;
  son: boolean;
  changerSon: () => void;
  base: string;
  indice: boolean;
}) {
  const lecteur = useRef<HTMLVideoElement>(null);
  const [charge, setCharge] = useState(false); // la source n'est donnée qu'une fois la vidéo demandée
  const [lecture, setLecture] = useState(false);
  const [erreur, setErreur] = useState(false);
  const [voulue, setVoulue] = useState(false); // la cliente a touché « lecture » (mode économie de données)

  const veutJouer = actif && (autoplay || voulue);
  if (veutJouer && !charge) setCharge(true);

  // Lecture quand la vidéo est en vue ; pause dès qu'elle ne l'est plus.
  useEffect(() => {
    const v = lecteur.current;
    if (!v) return;
    v.muted = !(son && actif);
    if (veutJouer) {
      v.play().catch(() => {
        // Le navigateur refuse parfois la lecture avec le son : on rejoue sans le son plutôt que de rester figé.
        v.muted = true;
        v.play().catch(() => setLecture(false));
      });
    } else {
      v.pause();
      v.currentTime = 0;
    }
    // Page quittée (ou mise en réserve par le navigateur) : la vidéo et son son s'arrêtent aussitôt.
    return () => v.pause();
  }, [veutJouer, charge, son, actif]);

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
    <li data-video={video.id}>
      <div className="relative mx-auto h-full w-full max-w-[30rem] overflow-hidden bg-noir">
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
        {/* Toucher la vidéo la met en pause ou la relance. */}
        <button
          type="button"
          onClick={toucher}
          aria-label={lecture ? `Mettre en pause : ${video.titre}` : `Lire la vidéo : ${video.titre}`}
          className="absolute inset-0 flex items-center justify-center"
        >
          {!lecture && !erreur && (
            <span className="flex size-16 items-center justify-center rounded-full bg-noir/65 text-or backdrop-blur">
              <IconPlay width={30} height={30} fill="currentColor" />
            </span>
          )}
        </button>
        {erreur && <p className="absolute inset-x-6 top-1/2 -translate-y-1/2 text-center text-sm text-white/80">Vidéo indisponible pour le moment.</p>}
        {charge && actif && !erreur && (
          <button
            type="button"
            onClick={changerSon}
            aria-label={son ? "Couper le son" : "Activer le son"}
            aria-pressed={son}
            className="absolute top-[max(0.75rem,env(safe-area-inset-top))] right-3 flex size-11 items-center justify-center rounded-full bg-noir/60 text-white backdrop-blur"
          >
            {son ? <IconSon width={20} height={20} /> : <IconSilence width={20} height={20} />}
          </button>
        )}
        {indice && (
          <p className="pointer-events-none absolute inset-x-0 bottom-44 animate-pulse text-center text-xs font-medium text-white/80">
            ↑ Glissez vers le haut pour la suite
          </p>
        )}
        <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-noir/90 via-noir/55 to-transparent px-5 pt-20 pb-[max(1.25rem,env(safe-area-inset-bottom))] text-white">
          <p className="font-display text-2xl leading-tight font-bold">{video.titre}</p>
          {prix && <p className="text-sm text-white/75">{prix}</p>}
          <Link
            href={modele ? `${base}/reserver?modele=${modele.id}` : `${base}/reserver`}
            className="pointer-events-auto mt-3 inline-flex min-h-12 w-full items-center justify-center rounded-full bg-or px-4 text-sm font-semibold text-noir hover:bg-or/90"
          >
            {modele ? "Je veux cette coiffure" : "Réserver un rendez-vous"}
          </Link>
        </div>
      </div>
    </li>
  );
}
