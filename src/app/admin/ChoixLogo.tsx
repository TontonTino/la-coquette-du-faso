"use client";

import { useState } from "react";
import { reduireLogo } from "@/lib/salon/image-client";

/**
 * Choix du logo : aperçu, envoi depuis la galerie ou l'appareil photo. Le logo est réduit sur l'appareil (512 px, < 300 Ko).
 * Le formulaire reçoit `logo` (nouvelle image) ou `logoRetire=1` (suppression du logo existant).
 */
export function ChoixLogo({ actuel }: { actuel: string | null }) {
  const [nouveau, setNouveau] = useState<string | null>(null);
  const [retire, setRetire] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const [preparation, setPreparation] = useState(false);
  const apercu = nouveau ?? (retire ? null : actuel);

  const choisir = async (f: File | undefined) => {
    if (!f) return;
    setPreparation(true);
    setErreur(null);
    try {
      setNouveau(await reduireLogo(f));
      setRetire(false);
    } catch (e) {
      setErreur((e as Error).message || "Image illisible.");
    } finally {
      setPreparation(false);
    }
  };

  return (
    <div className="mb-4 flex flex-col gap-1.5">
      <span className="text-sm font-semibold text-encre">Logo du salon</span>
      <span className="text-xs text-sourdine">PNG, JPEG ou WebP. Un fond transparent est conservé.</span>
      <div className="flex items-center gap-4">
        <div className="flex size-20 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-trait bg-white">
          {apercu ? (
            // eslint-disable-next-line @next/next/no-img-element -- aperçu local (data URL) ou image servie par notre route
            <img src={apercu} alt="Aperçu du logo" className="max-h-full max-w-full object-contain" />
          ) : (
            <span className="px-1 text-center text-xs text-sourdine">Aucun logo</span>
          )}
        </div>
        <div className="flex flex-col items-start gap-1.5">
          <label className="flex min-h-11 cursor-pointer items-center rounded-full border border-noir/15 bg-white px-4 text-sm font-medium hover:border-or">
            {preparation ? "Préparation…" : apercu ? "Changer le logo" : "Ajouter un logo"}
            <input type="file" name="fichierLogo" accept="image/*" className="sr-only" onChange={(e) => void choisir(e.target.files?.[0])} />
          </label>
          {apercu && (
            <button
              type="button"
              onClick={() => {
                setNouveau(null);
                setRetire(true);
              }}
              className="min-h-9 px-1 text-sm text-sourdine underline underline-offset-4 hover:text-encre"
            >
              Retirer le logo
            </button>
          )}
        </div>
      </div>
      {nouveau && <input type="hidden" name="logo" value={nouveau} />}
      {retire && <input type="hidden" name="logoRetire" value="1" />}
      {erreur && (
        <span role="alert" className="text-xs font-medium text-rouge">
          {erreur}
        </span>
      )}
    </div>
  );
}
