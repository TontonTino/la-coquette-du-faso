"use client";

import { useState } from "react";
import { PhotoCoiffeuse } from "@/components/public/Equipe";
import { useToast } from "@/components/ui/Toast";
import { reduireImage } from "@/lib/salon/image-client";

/**
 * Photo d'une coiffeuse : aperçu rond, choix depuis la galerie ou l'appareil photo du téléphone.
 * La photo est réduite sur le téléphone avant l'envoi (≈ 100 Ko).
 */
export function ChoixPhoto({
  nom,
  apercu,
  onChoisie,
  onRetirer,
}: {
  nom: string;
  apercu: string | null;
  onChoisie: (dataUrl: string) => void;
  onRetirer?: () => void;
}) {
  const toast = useToast();
  const [preparation, setPreparation] = useState(false);

  const choisir = async (f: File | undefined) => {
    if (!f) return;
    setPreparation(true);
    try {
      onChoisie(await reduireImage(f, 640));
    } catch (e) {
      toast("erreur", (e as Error).message || "Photo illisible.");
    } finally {
      setPreparation(false);
    }
  };

  return (
    <div className="flex items-center gap-4">
      <PhotoCoiffeuse nom={nom.trim() || "?"} photoUrl={apercu} className="size-20 shrink-0 overflow-hidden rounded-full text-3xl" />
      <div className="flex flex-col items-start gap-1.5">
        <label className="flex min-h-11 cursor-pointer items-center rounded-full border border-noir/15 bg-white px-4 text-sm font-medium hover:border-or">
          {preparation ? "Préparation…" : apercu ? "Changer la photo" : "Ajouter une photo"}
          <input type="file" accept="image/*" className="sr-only" onChange={(e) => void choisir(e.target.files?.[0])} />
        </label>
        {apercu && onRetirer && (
          <button type="button" onClick={onRetirer} className="min-h-9 px-1 text-sm text-sourdine underline underline-offset-4 hover:text-encre">
            Retirer la photo
          </button>
        )}
      </div>
    </div>
  );
}
