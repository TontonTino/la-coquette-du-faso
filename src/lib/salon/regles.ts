/**
 * Règles métier pures de l'espace salon (aucun accès réseau ni base).
 * Le serveur les applique avant chaque écriture ; la base garantit en plus BR-001.
 */
import { normalizePhone } from "@/lib/booking";
import { isValidIsoDate, isValidTime, weekday } from "@/lib/time";
import type { Coiffeuse, Jour, Moment, Statut } from "./types";

export const DUREE_MIN = 30;
export const DUREE_MAX = 720;
export const PAS_DUREE = 15;
export const MAX_COIFFEUSES = 2;
/** Durées proposées en un geste (BR-005). */
export const DUREES_RAPIDES = [60, 90, 120, 180, 240, 300, 360, 480, 600];

/* ---------------- Saisie ---------------- */

export function verifierNom(nom: string): string | null {
  const n = nom.trim();
  if (n.length < 2) return "Indiquez le nom de la cliente (2 lettres minimum).";
  if (n.length > 60) return "Le nom ne doit pas dépasser 60 caractères.";
  return null;
}

/** Renvoie le numéro normalisé « +226 70 12 34 56 », ou une erreur. */
export function verifierTelephone(tel: string, obligatoire: boolean): { tel: string | null; erreur: string | null } {
  if (!tel.trim()) return obligatoire ? { tel: null, erreur: "Indiquez le numéro WhatsApp de la cliente." } : { tel: null, erreur: null };
  const normalise = normalizePhone(tel);
  return normalise ? { tel: normalise, erreur: null } : { tel: null, erreur: "Numéro invalide : 8 chiffres, par exemple 70 12 34 56." };
}

export function verifierDuree(min: number): string | null {
  if (!Number.isInteger(min) || min < DUREE_MIN || min > DUREE_MAX || min % PAS_DUREE !== 0) {
    return "La durée doit être comprise entre 30 min et 12 h, par pas de 15 min.";
  }
  return null;
}

export function verifierModele(modele: string): string | null {
  return modele.length > 200 ? "La remarque ne doit pas dépasser 200 caractères." : null;
}

export function verifierPrix(prix: number): string | null {
  if (!Number.isInteger(prix) || prix < 0 || prix > 1_000_000) return "Indiquez le prix payé en FCFA (nombre entier).";
  return null;
}

/** 0, 1 ou 2 coiffeuses distinctes (BR-002 ; 0 = « première disponible » pour un rendez-vous). */
export function verifierChoixCoiffeuses(ids: string[], auMoinsUne: boolean): string | null {
  if (new Set(ids).size !== ids.length) return "Une coiffeuse est choisie deux fois.";
  if (ids.length > MAX_COIFFEUSES) return "Deux coiffeuses au maximum par cliente.";
  if (auMoinsUne && ids.length === 0) return "Choisissez au moins une coiffeuse.";
  return null;
}

export function verifierJourHeure(jour: Jour, heure: string): string | null {
  if (!isValidIsoDate(jour) || !isValidTime(heure)) return "Date ou heure invalide.";
  return null;
}

/** Instant correspondant à un jour et une heure du salon (UTC+0). */
export function instant(jour: Jour, heure: string): Date {
  return new Date(`${jour}T${heure}:00Z`);
}

export function ajouterMinutes(date: Date, minutes: number): Date {
  return new Date(date.getTime() + minutes * 60_000);
}

/* ---------------- Disponibilité ---------------- */

/** Congé habituel ou absence imprévue ce jour-là (BR-003). */
export function estIndisponible(c: Pick<Coiffeuse, "id" | "joursConge" | "actif">, jour: Jour, absences: string[]): "conge" | "absente" | "inactive" | null {
  if (!c.actif) return "inactive";
  if (c.joursConge.includes(weekday(jour))) return "conge";
  if (absences.includes(c.id)) return "absente";
  return null;
}

export function seChevauchent(aDebut: number, aFin: number, bDebut: number, bFin: number): boolean {
  return aDebut < bFin && bDebut < aFin;
}

/** BR-009 : sans type de coiffure précisé, toute coiffeuse convient ; sinon il faut la compétence. */
export function saitFaire(c: Pick<Coiffeuse, "categorieIds">, categorieId: string | null): boolean {
  return categorieId === null || c.categorieIds.includes(categorieId);
}

/* ---------------- Cycle de vie ---------------- */

export type ActionPrestation = "arrivee" | "demarrer" | "terminer" | "annuler" | "absente" | "modifier" | "confirmer" | "refuser";

/** Actions possibles selon le statut (docs/02-requirements.md §1, cycle de vie). */
export const TRANSITIONS: Record<Statut, ActionPrestation[]> = {
  demandee: ["confirmer", "refuser"],
  refusee: [],
  prevue: ["arrivee", "demarrer", "annuler", "absente", "modifier"],
  en_attente: ["demarrer", "annuler", "modifier"],
  en_cours: ["terminer"],
  terminee: [],
  annulee: [],
  absente: [],
  partie: [],
};

export function peut(statut: Statut, action: ActionPrestation): boolean {
  return TRANSITIONS[statut].includes(action);
}

/** Statut après annulation : un rendez-vous est « annulé », une cliente déjà présente est « partie ». */
export function statutApresAnnulation(statut: Statut): Statut {
  return statut === "en_attente" ? "partie" : "annulee";
}

/** Statuts qui réservent une plage horaire aux coiffeuses affectées. */
export const STATUTS_OCCUPANTS: Statut[] = ["prevue", "en_attente", "en_cours"];

/* ---------------- Demandes en ligne (phase B) ---------------- */

/** Le salon est ouvert tous les jours de 6 h 30 à 23 h, avec deux équipes qui se relaient. */
export const OUVERTURE_MIN = 6 * 60 + 30;
/** Dernière heure de début proposée : 22 h 30, pour une prestation d'au moins 30 min avant la fermeture à 23 h. */
export const DERNIER_DEBUT_MIN = 22 * 60 + 30;
/** Heures proposées à la secrétaire, par pas de 15 minutes, de l'ouverture au dernier départ. */
export const HEURES_SALON: string[] = Array.from({ length: (DERNIER_DEBUT_MIN - OUVERTURE_MIN) / 15 + 1 }, (_, i) => {
  const m = OUVERTURE_MIN + i * 15;
  return `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
});

export const MOMENTS: { valeur: Moment; label: string; plage: string }[] = [
  { valeur: "matin", label: "Matin", plage: "dès 6 h 30, avant le travail" },
  { valeur: "apres_midi", label: "Après-midi", plage: "12 h – 16 h" },
  { valeur: "fin_journee", label: "À la descente", plage: "après le travail, jusqu'à 23 h" },
];

export const JOURS_RESERVABLES = 60;
export const DEMANDES_EN_ATTENTE_MAX_PAR_NUMERO = 3;

export function libelleMoment(m: Moment | null): string {
  const t = MOMENTS.find((x) => x.valeur === m);
  return t ? `${t.label} (${t.plage})` : "Peu importe l'heure";
}

/** Une demande vise aujourd'hui ou un jour des 60 prochains jours. */
export function verifierJourDemande(jour: Jour, aujourdhui: Jour): string | null {
  if (!isValidIsoDate(jour)) return "Date invalide.";
  if (jour < aujourdhui) return "Cette date est déjà passée.";
  const limite = new Date(`${aujourdhui}T00:00:00Z`);
  limite.setUTCDate(limite.getUTCDate() + JOURS_RESERVABLES);
  if (jour > limite.toISOString().slice(0, 10)) return `Les demandes sont ouvertes sur les ${JOURS_RESERVABLES} prochains jours.`;
  return null;
}

export function verifierMoment(m: string | null): m is Moment | null {
  return m === null || m === "matin" || m === "apres_midi" || m === "fin_journee";
}

/** Référence de suivi : 8 caractères sans 0/O ni 1/I (lisibles au téléphone). */
const ALPHABET_REF = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
export function nouvelleReference(aleatoire: (n: number) => Uint8Array): string {
  const octets = aleatoire(8);
  return Array.from(octets, (o) => ALPHABET_REF[o % ALPHABET_REF.length]).join("");
}
export const estReference = (v: unknown): v is string => typeof v === "string" && /^[A-Z2-9]{8}$/.test(v);

/* ---------------- Catalogue de modèles (FR-C01) ---------------- */

export const PHOTO_TAILLE_MAX = 800_000;

/** Reconnaît le format réel d'une image à ses premiers octets (on ne se fie pas à l'extension). */
export function typeImage(o: Uint8Array): "image/jpeg" | "image/png" | "image/webp" | null {
  if (o.length > 3 && o[0] === 0xff && o[1] === 0xd8 && o[2] === 0xff) return "image/jpeg";
  if (o.length > 8 && o[0] === 0x89 && o[1] === 0x50 && o[2] === 0x4e && o[3] === 0x47) return "image/png";
  if (o.length > 12 && String.fromCharCode(...o.slice(0, 4)) === "RIFF" && String.fromCharCode(...o.slice(8, 12)) === "WEBP") return "image/webp";
  return null;
}

/** Prix et durées indicatifs, tous facultatifs ; un maximum ne peut pas être inférieur au minimum. */
export function verifierFourchettes(f: { prixMin: number | null; prixMax: number | null; dureeMin: number | null; dureeMax: number | null }): string | null {
  for (const p of [f.prixMin, f.prixMax]) {
    if (p !== null && (!Number.isInteger(p) || p < 0 || p > 1_000_000)) return "Prix invalide (en FCFA).";
  }
  for (const d of [f.dureeMin, f.dureeMax]) if (d !== null && verifierDuree(d)) return "Durée invalide (30 min à 12 h, par pas de 15 min).";
  if (f.prixMin !== null && f.prixMax !== null && f.prixMax < f.prixMin) return "Le prix maximum est inférieur au prix minimum.";
  if (f.dureeMin !== null && f.dureeMax !== null && f.dureeMax < f.dureeMin) return "La durée maximum est inférieure à la durée minimum.";
  return null;
}

const espace = "\u00a0";
const fcfa = (n: number) => `${String(n).replace(/\B(?=(\d{3})+(?!\d))/g, espace)}${espace}FCFA`;
const duree = (m: number) => (m % 60 ? `${Math.floor(m / 60)}${espace}h${espace}${String(m % 60).padStart(2, "0")}` : `${m / 60}${espace}h`);

/** « 5 000 – 15 000 FCFA », « à partir de 5 000 FCFA » ou "" si non renseigné. */
export function fourchettePrix(min: number | null, max: number | null): string {
  if (min !== null && max !== null) return min === max ? fcfa(min) : `${fcfa(min).replace(`${espace}FCFA`, "")} – ${fcfa(max)}`;
  if (min !== null) return `à partir de ${fcfa(min)}`;
  if (max !== null) return `jusqu'à ${fcfa(max)}`;
  return "";
}

/** « 2 h – 4 h », « environ 3 h » ou "". */
export function fourchetteDuree(min: number | null, max: number | null): string {
  if (min !== null && max !== null) return min === max ? `environ ${duree(min)}` : `${duree(min)} – ${duree(max)}`;
  if (min !== null) return `au moins ${duree(min)}`;
  if (max !== null) return `jusqu'à ${duree(max)}`;
  return "";
}

/* ---------------- Avis des clientes (notes sur 5 étoiles) ---------------- */

/** Une moyenne n'est affichée qu'à partir de 3 avis : un seul avis ne dit pas grand-chose. */
export const AVIS_MIN_AFFICHES = 3;

export function verifierAvis(note: number, commentaire: string): string | null {
  if (!Number.isInteger(note) || note < 1 || note > 5) return "Choisissez une note de 1 à 5 étoiles.";
  if (commentaire.length > 300) return "Le commentaire ne doit pas dépasser 300 caractères.";
  return null;
}

/**
 * Score de classement : moyenne « prudente » qui tient compte du nombre d'avis.
 * Une coiffeuse avec un seul 5/5 ne passe pas devant une autre qui a 40 avis à 4,8 ;
 * une nouvelle coiffeuse démarre au milieu du classement (4/5 virtuel, pesant 5 avis).
 */
export function scoreAvis(moyenne: number | null, nbAvis: number): number {
  const POIDS = 5;
  const BASE = 4;
  return ((moyenne ?? 0) * nbAvis + BASE * POIDS) / (nbAvis + POIDS);
}

/** Les mieux notées d'abord, puis l'ordre alphabétique (stable et prévisible). */
export function trierParNote<T extends { nom: string; moyenne: number | null; nbAvis: number }>(liste: T[]): T[] {
  return [...liste].sort((a, b) => scoreAvis(b.moyenne, b.nbAvis) - scoreAvis(a.moyenne, a.nbAvis) || a.nom.localeCompare(b.nom, "fr"));
}

/** « 4,8 » (virgule française), ou null tant qu'il y a moins de 3 avis. */
export function noteAffichee(moyenne: number | null, nbAvis: number): string | null {
  if (moyenne === null || nbAvis < AVIS_MIN_AFFICHES) return null;
  return (Math.round(moyenne * 10) / 10).toFixed(1).replace(".", ",");
}

/* ---------------- Vidéos courtes ---------------- */

/** Adresse d'une vidéo : sécurisée (https), sans espace, de longueur raisonnable. */
export function verifierVideo(titre: string, url: string): string | null {
  const t = titre.trim();
  if (t.length < 2 || t.length > 60) return "Le titre de la vidéo doit faire entre 2 et 60 caractères.";
  if (url.length > 500 || /\s/.test(url)) return "Adresse de la vidéo invalide.";
  try {
    if (new URL(url).protocol !== "https:") return "L'adresse de la vidéo doit commencer par https://.";
  } catch {
    return "Adresse de la vidéo invalide.";
  }
  return null;
}
