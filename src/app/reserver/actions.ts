"use server";

import type { Creneau } from "@/lib/salon/creneaux";
import type { Resultat } from "@/lib/salon/types";
import { creneauxLibresDuSalon, reserverCreneau } from "@/server/salon/service";

/**
 * Actions publiques (sans connexion) de la réservation en ligne.
 * Toute la validation et l'anti-abus sont faits côté serveur (service.reserverCreneau).
 */
const texte = (v: unknown, max = 300) => (typeof v === "string" ? v.slice(0, max) : "");
const idOuNull = (v: unknown) => (typeof v === "string" && v ? v.slice(0, 40) : null);

export type CreneauxJour = Resultat<{ creneaux: Creneau[]; dureeMin: number; prix: number | null }> & { nonRegle?: boolean };

/** Créneaux libres d'un jour pour un service (lecture seule). */
export async function creneauxAction(slug: string, jour: string, categorieId: string): Promise<CreneauxJour> {
  try {
    const r = await creneauxLibresDuSalon(texte(slug, 60), texte(jour, 10), texte(categorieId, 40));
    return r.ok ? r : { ok: false, erreur: r.erreur, nonRegle: "nonRegle" in r ? true : undefined };
  } catch (e) {
    console.error("[public] créneaux en échec", e);
    return { ok: false, erreur: "Impossible de charger les créneaux. Réessayez dans un instant." };
  }
}

export async function reserverAction(slug: string, s: {
  clientNom: string;
  clientTel: string;
  categorieId: string | null;
  modeleId: string | null;
  jour: string;
  heure: string;
  coiffeuseSouhaitee: string | null;
  remarque: string;
  piege: string;
}): Promise<Resultat<{ reference: string }>> {
  try {
    return await reserverCreneau(texte(slug, 60), {
      clientNom: texte(s?.clientNom, 80),
      clientTel: texte(s?.clientTel, 30),
      categorieId: texte(s?.categorieId, 40),
      modeleId: idOuNull(s?.modeleId),
      jour: texte(s?.jour, 10),
      heure: texte(s?.heure, 5),
      coiffeuseSouhaitee: idOuNull(s?.coiffeuseSouhaitee),
      remarque: texte(s?.remarque, 250),
      piege: texte(s?.piege, 200),
    });
  } catch (e) {
    console.error("[public] réservation en échec", e);
    return { ok: false, erreur: "Une erreur est survenue. Réessayez, ou écrivez au salon sur WhatsApp." };
  }
}
