/** Types partagés de l'espace salon (écran ↔ serveur). Vocabulaire : docs/02-requirements.md §1. */

export type Role = "gerante" | "secretaire" | "coiffeuse";
export type Origine = "rendez_vous" | "sans_rendez_vous";
export type Statut = "demandee" | "refusee" | "prevue" | "en_attente" | "en_cours" | "terminee" | "annulee" | "absente" | "partie";
export type Moment = "matin" | "apres_midi" | "fin_journee";
export type Paiement = "especes" | "mobile_money";

/** Date calendaire AAAA-MM-JJ (Ouagadougou = UTC+0). */
export type Jour = string;

export interface Coiffeuse {
  id: string;
  nom: string;
  joursConge: number[];
  actif: boolean;
  /** Types de coiffure qu'elle sait faire (BR-009). */
  categorieIds: string[];
  /** Photo de la coiffeuse (les clientes ne connaissent pas les noms), ou null. */
  photoUrl: string | null;
  /** Moyenne des notes de 1 à 5 (null s'il n'y a aucun avis) et nombre d'avis. */
  moyenne: number | null;
  nbAvis: number;
}

/** Modèle du catalogue : une photo de coiffure, avec prix et durée indicatifs (FR-C01). */
export interface Modele {
  id: string;
  nom: string;
  categorieId: string | null;
  photoUrl: string;
  prixMin: number | null;
  prixMax: number | null;
  dureeMin: number | null;
  dureeMax: number | null;
  actif: boolean;
}

/** Grande famille de services du salon. */
export type Famille = "coiffure" | "ongles";

/** Type de service défini par la gérante : tresses, nattes collées, tissage, manucure, pédicure… */
export interface Categorie {
  id: string;
  nom: string;
  famille: Famille;
}

/** Vidéo courte du salon (volume, couleur, qualité d'une coiffure), liée si possible à un modèle du catalogue. */
export interface Video {
  id: string;
  titre: string;
  url: string;
  modeleId: string | null;
  actif: boolean;
}

export interface Prestation {
  id: string;
  origine: Origine;
  statut: Statut;
  clientNom: string;
  clientTel: string | null;
  modele: string | null;
  categorieId: string | null;
  jour: Jour;
  /** Instant de début (ISO), prévu ou réel. */
  debut: string | null;
  dureeMin: number;
  /** Instant d'arrivée au salon (ISO). */
  arrivee: string | null;
  prixPaye: number | null;
  paiement: Paiement | null;
  coiffeuseIds: string[];
}

/** Absences imprévues du jour : identifiants des coiffeuses absentes. */
export type Absences = string[];

export type Resultat<T = undefined> = { ok: true; valeur: T } | { ok: false; erreur: string };
