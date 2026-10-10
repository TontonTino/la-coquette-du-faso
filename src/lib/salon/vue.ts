/**
 * Construction des vues (planning du jour, bilan) à partir des données brutes.
 * Fonctions pures : testées sans base, utilisées par le serveur.
 */
import { estIndisponible } from "./regles";
import type { Absences, Categorie, Coiffeuse, Jour, Prestation } from "./types";

/** « 14:30 » pour un instant ISO (Ouagadougou = UTC+0). */
export function heureDe(iso: string | Date): string {
  return (typeof iso === "string" ? new Date(iso) : iso).toISOString().slice(11, 16);
}

export function finDe(p: Pick<Prestation, "debut" | "dureeMin">): Date | null {
  return p.debut ? new Date(new Date(p.debut).getTime() + p.dureeMin * 60_000) : null;
}

export type EtatCoiffeuse = "libre" | "occupee" | "conge" | "absente";

export interface LigneCoiffeuse {
  id: string;
  nom: string;
  etat: EtatCoiffeuse;
  /** Fin estimée de la prestation en cours (HH:MM). */
  jusqua: string | null;
  avec: string | null;
  prochain: { heure: string; client: string } | null;
}

export interface CartePrestation extends Prestation {
  coiffeuses: string[];
  categorie: string | null;
  heureDebut: string | null;
  heureFin: string | null;
  heureArrivee: string | null;
  attenteMin: number | null;
  /** Coiffeuses affectées mais absentes ou en congé ce jour-là. */
  aReattribuer: string[];
  enRetard: boolean;
}

export interface Journee {
  jour: Jour;
  categories: Categorie[];
  attente: CartePrestation[];
  enCours: CartePrestation[];
  aVenir: CartePrestation[];
  coiffeuses: LigneCoiffeuse[];
  compteurs: { libres: number; occupees: number; absentes: number; total: number };
}

interface Entree {
  coiffeuses: Coiffeuse[];
  categories?: Categorie[];
  prestations: Prestation[];
  absences: Absences;
  jour: Jour;
  now: Date;
}

export function construireJournee({ coiffeuses, categories = [], prestations, absences, jour, now }: Entree): Journee {
  const actives = coiffeuses.filter((c) => c.actif);
  const nomDe = new Map(coiffeuses.map((c) => [c.id, c.nom]));
  const nomCategorie = new Map(categories.map((c) => [c.id, c.nom]));
  const indispo = new Map(actives.map((c) => [c.id, estIndisponible(c, jour, absences)]));
  const t = now.getTime();

  const carte = (p: Prestation): CartePrestation => {
    const fin = finDe(p);
    return {
      ...p,
      coiffeuses: p.coiffeuseIds.map((id) => nomDe.get(id) ?? "?"),
      categorie: p.categorieId ? (nomCategorie.get(p.categorieId) ?? null) : null,
      heureDebut: p.debut ? heureDe(p.debut) : null,
      heureFin: fin ? heureDe(fin) : null,
      heureArrivee: p.arrivee ? heureDe(p.arrivee) : null,
      attenteMin: p.arrivee ? Math.max(0, Math.round((t - new Date(p.arrivee).getTime()) / 60_000)) : null,
      // Absente du tableau = coiffeuse désactivée depuis : à réattribuer aussi.
      aReattribuer: p.coiffeuseIds.filter((id) => !indispo.has(id) || indispo.get(id) !== null).map((id) => nomDe.get(id) ?? "?"),
      enRetard: p.statut === "prevue" && !!p.debut && new Date(p.debut).getTime() < t,
    };
  };

  const duJour = prestations.filter((p) => p.jour === jour);
  const attente = duJour
    .filter((p) => p.statut === "en_attente")
    .sort((a, b) => (a.arrivee ?? "").localeCompare(b.arrivee ?? ""))
    .map(carte);
  const enCours = duJour
    .filter((p) => p.statut === "en_cours")
    .sort((a, b) => (finDe(a)?.getTime() ?? 0) - (finDe(b)?.getTime() ?? 0))
    .map(carte);
  const aVenir = duJour
    .filter((p) => p.statut === "prevue")
    .sort((a, b) => (a.debut ?? "").localeCompare(b.debut ?? ""))
    .map(carte);

  let libres = 0;
  let occupees = 0;
  let absentes = 0;
  const lignes: LigneCoiffeuse[] = actives.map((c) => {
    const motif = indispo.get(c.id);
    const cours = enCours.find((p) => p.coiffeuseIds.includes(c.id));
    const prochaine = duJour
      .filter((p) => (p.statut === "prevue" || p.statut === "en_attente") && p.debut && p.coiffeuseIds.includes(c.id))
      .filter((p) => (finDe(p)?.getTime() ?? 0) > t)
      .sort((a, b) => (a.debut ?? "").localeCompare(b.debut ?? ""))[0];
    let etat: EtatCoiffeuse = "libre";
    if (motif === "conge") etat = "conge";
    else if (motif === "absente") etat = "absente";
    else if (cours) etat = "occupee";
    if (etat === "libre") libres++;
    else if (etat === "occupee") occupees++;
    else absentes++;
    return {
      id: c.id,
      nom: c.nom,
      etat,
      jusqua: cours?.heureFin ?? null,
      avec: cours?.clientNom ?? null,
      prochain: prochaine?.debut ? { heure: heureDe(prochaine.debut), client: prochaine.clientNom } : null,
    };
  });

  return {
    jour,
    categories,
    attente,
    enCours,
    aVenir,
    coiffeuses: lignes.sort((a, b) => ordreEtat(a.etat) - ordreEtat(b.etat) || a.nom.localeCompare(b.nom, "fr")),
    compteurs: { libres, occupees, absentes, total: actives.length },
  };
}

function ordreEtat(e: EtatCoiffeuse): number {
  return { libre: 0, occupee: 1, absente: 2, conge: 3 }[e];
}

export interface Bilan {
  jour: Jour;
  total: number;
  especes: number;
  mobileMoney: number;
  terminees: number;
  enCours: number;
  plusDemandees: { noms: string[]; nombre: number };
  absences: { nom: string; motif: "conge" | "absente" }[];
  liste: { id: string; client: string; coiffeuses: string[]; prix: number; paiement: "especes" | "mobile_money" }[];
}

/** Bilan du soir (FR-013). « Plus demandée » = le plus de prestations terminées (à confirmer avec la gérante). */
export function construireBilan({ coiffeuses, prestations, absences, jour }: Omit<Entree, "now">): Bilan {
  const nomDe = new Map(coiffeuses.map((c) => [c.id, c.nom]));
  const duJour = prestations.filter((p) => p.jour === jour);
  const terminees = duJour.filter((p) => p.statut === "terminee" && p.prixPaye !== null && p.paiement !== null);
  let especes = 0;
  let mobileMoney = 0;
  const compte = new Map<string, number>();
  for (const p of terminees) {
    if (p.paiement === "especes") especes += p.prixPaye!;
    else mobileMoney += p.prixPaye!;
    for (const id of p.coiffeuseIds) compte.set(id, (compte.get(id) ?? 0) + 1);
  }
  const max = Math.max(0, ...compte.values());
  const noms = [...compte.entries()]
    .filter(([, n]) => n === max && max > 0)
    .map(([id]) => nomDe.get(id) ?? "?")
    .sort((a, b) => a.localeCompare(b, "fr"));

  const abs: Bilan["absences"] = [];
  for (const c of coiffeuses) {
    const motif = estIndisponible(c, jour, absences);
    if (motif === "conge" || motif === "absente") abs.push({ nom: c.nom, motif });
  }

  return {
    jour,
    total: especes + mobileMoney,
    especes,
    mobileMoney,
    terminees: terminees.length,
    enCours: duJour.filter((p) => p.statut === "en_cours").length,
    plusDemandees: { noms, nombre: max },
    absences: abs.sort((a, b) => a.nom.localeCompare(b.nom, "fr")),
    liste: terminees.map((p) => ({
      id: p.id,
      client: p.clientNom,
      coiffeuses: p.coiffeuseIds.map((id) => nomDe.get(id) ?? "?"),
      prix: p.prixPaye!,
      paiement: p.paiement!,
    })),
  };
}
