/**
 * Liens WhatsApp « clic pour discuter » (wa.me) avec message pré-rempli : aucun coût, aucun compte
 * WhatsApp Business nécessaire. Le message part du téléphone de la secrétaire quand elle appuie sur Envoyer.
 */
import { capitalize, formatDateLong } from "@/lib/time";
import type { Jour } from "./types";

/** « +226 70 12 34 56 » → « https://wa.me/22670123456?text=… » */
export function lienWhatsApp(tel: string, texte?: string): string | null {
  const chiffres = tel.replace(/\D/g, "");
  const local = chiffres.length >= 8 ? chiffres.slice(-8) : null;
  if (!local) return null;
  return `https://wa.me/226${local}${texte ? `?text=${encodeURIComponent(texte)}` : ""}`;
}

export const prenom = (nom: string) => nom.trim().split(/\s+/)[0] ?? nom;

export function messageConfirmation(p: {
  clientNom: string;
  salonNom: string;
  jour: Jour;
  heure: string;
  coiffeuses: string[];
  lienSuivi: string;
}): string {
  const avec = p.coiffeuses.length ? ` avec ${p.coiffeuses.join(" et ")}` : "";
  return [
    `Bonjour ${prenom(p.clientNom)}, votre rendez-vous à ${p.salonNom} est confirmé :`,
    `${capitalize(formatDateLong(p.jour))} à ${p.heure.replace(":", " h ")}${avec}`.replace(/\.?$/, "."),
    `Détails : ${p.lienSuivi}`,
    `À bientôt !`,
  ].join("\n");
}

export function messageRefus(p: { clientNom: string; salonNom: string; motif: string; lienReserver: string }): string {
  return [
    `Bonjour ${prenom(p.clientNom)}, nous ne pouvons malheureusement pas accepter votre demande de rendez-vous à ${p.salonNom} : ${p.motif}.`,
    `Vous pouvez faire une nouvelle demande ici : ${p.lienReserver}`,
  ].join("\n");
}

export function messageAvis(p: { clientNom: string; salonNom: string; coiffeuses: string[]; lienAvis: string }): string {
  const qui = p.coiffeuses.length ? p.coiffeuses.join(" et ") : "votre coiffeuse";
  return [
    `Bonjour ${prenom(p.clientNom)}, merci de votre visite à ${p.salonNom} !`,
    `Comment s'est passé votre rendez-vous avec ${qui} ? Donnez votre avis en 10 secondes (de 1 à 5 étoiles) :`,
    p.lienAvis,
  ].join("\n");
}
