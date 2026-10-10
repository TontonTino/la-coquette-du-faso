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

export const MOMENTS: { valeur: Moment; label: string; plage: string }[] = [
  { valeur: "matin", label: "Matin", plage: "avant 12 h" },
  { valeur: "apres_midi", label: "Après-midi", plage: "12 h – 16 h" },
  { valeur: "fin_journee", label: "Fin de journée", plage: "après 16 h" },
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
