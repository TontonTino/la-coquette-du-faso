"use server";

import { refresh } from "next/cache";
import type { Resultat } from "@/lib/salon/types";
import { noterCoiffeuse } from "@/server/salon/service";

/**
 * Action publique : une cliente note sa coiffeuse de 1 à 5 étoiles après sa prestation.
 * Elle s'identifie par sa référence de suivi ; le service vérifie que la prestation est terminée
 * et que la coiffeuse y a bien participé.
 */
const texte = (v: unknown, max: number) => (typeof v === "string" ? v.slice(0, max) : "");

export async function noterAction(reference: string, coiffeuseId: string, note: number, commentaire: string): Promise<Resultat> {
  try {
    const r = await noterCoiffeuse(texte(reference, 10).toUpperCase(), texte(coiffeuseId, 40), Number(note), texte(commentaire, 400));
    if (r.ok) refresh();
    return r;
  } catch (e) {
    console.error("[public] avis en échec", e);
    return { ok: false, erreur: "Une erreur est survenue. Réessayez dans un instant." };
  }
}
