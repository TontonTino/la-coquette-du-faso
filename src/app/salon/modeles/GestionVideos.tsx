"use client";

import { upload } from "@vercel/blob/client";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/Button";
import { IconVideo } from "@/components/ui/icons";
import { useToast } from "@/components/ui/Toast";
import type { Modele, Video } from "@/lib/salon/types";
import { ajouterVideoAction, modifierVideoAction } from "../actions";
import { Carte, Champ, classeInput, Section, Vide } from "../ui";

interface Brouillon {
  id: string | null;
  titre: string;
  url: string;
  modeleId: string;
  actif: boolean;
}
const vide: Brouillon = { id: null, titre: "", url: "", modeleId: "", actif: true };
const TAILLE_MAX = 40 * 1024 * 1024;

/**
 * La gérante ajoute de courtes vidéos (15 à 30 s) qui montrent le volume, la couleur et la finition.
 * Le fichier part directement du téléphone vers le stockage vidéo (Vercel Blob) ; à défaut de stockage activé,
 * elle peut coller l'adresse d'une vidéo déjà en ligne.
 */
export function GestionVideos({ videos, modeles, stockageActif }: { videos: Video[]; modeles: Modele[]; stockageActif: boolean }) {
  const toast = useToast();
  const [enCours, start] = useTransition();
  const [b, setB] = useState<Brouillon | null>(null);
  const [envoi, setEnvoi] = useState<number | null>(null); // progression de l'envoi en %
  const nomModele = new Map(modeles.map((m) => [m.id, m.nom]));
  const actifs = videos.filter((v) => v.actif);
  const retirees = videos.filter((v) => !v.actif);

  const choisirFichier = async (f: File | undefined) => {
    if (!f || !b) return;
    if (!f.type.startsWith("video/")) return toast("erreur", "Choisissez un fichier vidéo.");
    if (f.size > TAILLE_MAX) return toast("erreur", "Vidéo trop lourde (40 Mo maximum). Choisissez une vidéo plus courte.");
    setEnvoi(0);
    try {
      const r = await upload(`videos/${f.name.replace(/[^\w.-]+/g, "-")}`, f, {
        access: "public",
        handleUploadUrl: "/api/videos/upload",
        onUploadProgress: ({ percentage }) => setEnvoi(Math.round(percentage)),
      });
      setB((x) => (x ? { ...x, url: r.url } : x));
      toast("succes", "Vidéo envoyée");
    } catch (e) {
      toast("erreur", (e as Error).message || "L'envoi a échoué. Vérifiez la connexion et réessayez.");
    } finally {
      setEnvoi(null);
    }
  };

  const enregistrer = () => {
    if (!b) return;
    if (b.titre.trim().length < 2) return toast("erreur", "Donnez un titre à la vidéo.");
    if (!b.id && !b.url) return toast("erreur", "Ajoutez une vidéo ou collez son adresse.");
    start(async () => {
      const r = b.id
        ? await modifierVideoAction(b.id, { titre: b.titre, modeleId: b.modeleId || null, actif: b.actif })
        : await ajouterVideoAction({ titre: b.titre, url: b.url.trim(), modeleId: b.modeleId || null });
      if (!r.ok) return toast("erreur", r.erreur);
      toast("succes", b.id ? "Vidéo enregistrée" : "Vidéo ajoutée : les clientes la voient sur l'accueil");
      setB(null);
    });
  };

  const ligne = (v: Video) => (
    <Carte key={v.id} className="flex items-center gap-3 py-2.5">
      <video
        src={`${v.url}#t=0.5`}
        muted
        playsInline
        preload="metadata"
        aria-hidden
        className={`h-24 w-14 shrink-0 rounded-lg bg-noir object-cover ${v.actif ? "" : "opacity-50 grayscale"}`}
      />
      <div className="min-w-0 flex-1">
        <p className="font-semibold">{v.titre}</p>
        <p className="text-sm text-sourdine">{v.modeleId ? `Modèle : ${nomModele.get(v.modeleId) ?? "?"}` : "Aucun modèle lié"}</p>
      </div>
      <button
        type="button"
        onClick={() => setB({ id: v.id, titre: v.titre, url: v.url, modeleId: v.modeleId ?? "", actif: v.actif })}
        className="min-h-11 shrink-0 rounded-full border border-trait px-3 text-sm hover:border-or"
      >
        Modifier
      </button>
    </Carte>
  );

  return (
    <Section titre="Vidéos courtes" nombre={actifs.length} ton="or">
      <p className="-mt-1 text-sm text-sourdine">
        Des vidéos de 15 à 30 secondes montrent le volume, la couleur et la finition. Les clientes les font défiler sur l&apos;accueil.
      </p>
      {b ? (
        <Carte>
          <h3 className="mb-3 font-display text-2xl leading-none font-bold">{b.id ? "Modifier la vidéo" : "Nouvelle vidéo"}</h3>
          {!b.id && (
            <>
              {stockageActif ? (
                <label className="mb-4 flex min-h-12 cursor-pointer items-center justify-center gap-2 rounded-full bg-noir px-4 text-sm font-medium text-white">
                  <IconVideo width={20} height={20} />
                  {envoi !== null ? `Envoi en cours… ${envoi} %` : b.url ? "Choisir une autre vidéo" : "Choisir une vidéo du téléphone"}
                  <input type="file" accept="video/*" className="sr-only" disabled={envoi !== null} onChange={(e) => void choisirFichier(e.target.files?.[0])} />
                </label>
              ) : (
                <p className="mb-3 rounded-xl bg-or-pale px-3 py-2 text-sm text-or-fonce">
                  L&apos;envoi depuis le téléphone n&apos;est pas encore activé. Collez ci-dessous l&apos;adresse d&apos;une vidéo déjà en ligne.
                </p>
              )}
              {b.url && stockageActif && (
                <video src={b.url} muted playsInline controls className="mb-4 aspect-[9/16] max-h-80 w-full rounded-2xl bg-noir object-contain" />
              )}
              <Champ label={stockageActif ? "Ou adresse d'une vidéo (https://…)" : "Adresse de la vidéo (https://…)"}>
                <input className={classeInput} value={b.url} onChange={(e) => setB({ ...b, url: e.target.value })} inputMode="url" placeholder="https://" />
              </Champ>
            </>
          )}
          <Champ label="Titre">
            <input className={classeInput} value={b.titre} onChange={(e) => setB({ ...b, titre: e.target.value })} maxLength={60} placeholder="Ex. : Nattes collées, finition" />
          </Champ>
          <Champ label="Modèle présenté" aide="La cliente pourra demander ce modèle d'un geste.">
            <select className={classeInput} value={b.modeleId} onChange={(e) => setB({ ...b, modeleId: e.target.value })}>
              <option value="">Aucun</option>
              {modeles
                .filter((m) => m.actif)
                .map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.nom}
                  </option>
                ))}
            </select>
          </Champ>
          {b.id && (
            <label className="mb-4 flex min-h-11 items-center gap-2 text-sm">
              <input type="checkbox" className="size-5" checked={b.actif} onChange={(e) => setB({ ...b, actif: e.target.checked })} />
              Visible par les clientes
            </label>
          )}
          <div className="flex gap-2">
            <Button variant="noir" className="flex-1" loading={enCours} disabled={envoi !== null} onClick={enregistrer}>
              {b.id ? "Enregistrer" : "Ajouter la vidéo"}
            </Button>
            <Button variant="contour" onClick={() => setB(null)}>
              Annuler
            </Button>
          </div>
        </Carte>
      ) : (
        <Button variant="noir" size="lg" className="w-full" onClick={() => setB({ ...vide })}>
          + Ajouter une vidéo
        </Button>
      )}
      {actifs.length === 0 && !b ? <Vide>Aucune vidéo pour l&apos;instant.</Vide> : actifs.map(ligne)}
      {retirees.length > 0 && (
        <>
          <p className="mt-2 text-sm font-semibold">Retirées</p>
          {retirees.map(ligne)}
        </>
      )}
    </Section>
  );
}
