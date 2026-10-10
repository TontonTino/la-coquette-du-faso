"use server";

import type { Resultat } from "@/lib/salon/types";
import { creerDemande } from "@/server/salon/service";
import { SALON_PUBLIC } from "@/server/salon/public-config";

/**
 * Action publique (sans connexion) : une cliente envoie une demande de rendez-vous.
 * Toute la validation et l'anti-abus sont faits côté serveur (service.creerDemande).
 */
const texte = (v: unknown, max = 300) => (typeof v === "string" ? v.slice(0, max) : "");
const idOuNull = (v: unknown) => (typeof v === "string" && v ? v.slice(0, 40) : null);

export async function envoyerDemandeAction(s: {
  clientNom: string;
  clientTel: string;
  categorieId: string | null;
  modeleId: string | null;
  jour: string;
  moment: string | null;
  coiffeuseSouhaitee: string | null;
  remarque: string;
  piege: string;
}): Promise<Resultat<{ reference: string }>> {
  try {
    return await creerDemande(SALON_PUBLIC, {
      clientNom: texte(s?.clientNom, 80),
      clientTel: texte(s?.clientTel, 30),
      categorieId: idOuNull(s?.categorieId),
      modeleId: idOuNull(s?.modeleId),
      jour: texte(s?.jour, 10),
      moment: idOuNull(s?.moment),
      coiffeuseSouhaitee: idOuNull(s?.coiffeuseSouhaitee),
      remarque: texte(s?.remarque, 250),
      piege: texte(s?.piege, 200),
    });
  } catch (e) {
    console.error("[public] demande en échec", e);
    return { ok: false, erreur: "Une erreur est survenue. Réessayez, ou écrivez au salon sur WhatsApp." };
  }
}
