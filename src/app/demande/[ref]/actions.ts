"use server";

import { refresh } from "next/cache";
import { headers } from "next/headers";
import type { Resultat } from "@/lib/salon/types";
import { lancerAcompte } from "@/server/salon/acompte";
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

/** Adresse publique du site : SITE_URL si elle est définie, sinon celle de la requête (hôte validé). */
async function adresseSite(): Promise<string | null> {
  const fixe = process.env.SITE_URL?.trim().replace(/\/+$/, "");
  if (fixe) return /^https:\/\/[a-z0-9.-]+(:\d+)?$/i.test(fixe) ? fixe : null;
  const h = await headers();
  const hote = (h.get("x-forwarded-host") ?? h.get("host") ?? "").split(",")[0].trim();
  if (!/^[a-z0-9.-]+(:\d+)?$/i.test(hote)) return null;
  const proto = (h.get("x-forwarded-proto") ?? "https").split(",")[0].trim();
  return `${proto === "http" ? "http" : "https"}://${hote}`;
}

/** Action publique : la cliente demande à payer l'acompte de sa demande (renvoie l'adresse de paiement PayDunya). */
export async function payerAcompteAction(reference: string): Promise<Resultat<{ url: string }>> {
  try {
    const site = await adresseSite();
    if (!site) return { ok: false, erreur: "Le paiement est momentanément indisponible." };
    return await lancerAcompte(texte(reference, 10).toUpperCase(), site);
  } catch (e) {
    console.error("[public] acompte en échec", e);
    return { ok: false, erreur: "Une erreur est survenue. Réessayez dans un instant." };
  }
}
