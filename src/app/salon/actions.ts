"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import type { Paiement, Resultat } from "@/lib/salon/types";
import { exigerAction, NonAutorise, seConnecter, seDeconnecter } from "@/server/auth";
import * as svc from "@/server/salon/service";

/**
 * Actions serveur de l'espace salon. Chacune :
 * 1. revérifie la session et le rôle (exigerAction) ;
 * 2. appelle le service métier, qui valide les données et filtre par salon ;
 * 3. rafraîchit la page courante dans la même réponse (refresh).
 * Les entrées venant du navigateur ne sont jamais considérées comme fiables.
 */

type R<T = undefined> = Resultat<T>;

async function executer<T>(fn: () => Promise<R<T>>): Promise<R<T>> {
  try {
    const r = await fn();
    if (r.ok) refresh();
    return r;
  } catch (e) {
    if (e instanceof NonAutorise) return { ok: false, erreur: e.message };
    console.error("[salon] action en échec", e);
    return { ok: false, erreur: "Une erreur est survenue. Réessayez dans un instant." };
  }
}

const texte = (v: unknown, max = 300) => (typeof v === "string" ? v.slice(0, max) : "");
const entier = (v: unknown) => (typeof v === "number" ? v : Number.parseInt(texte(v, 12), 10));
const ids = (v: unknown, max = 3) => (Array.isArray(v) ? v.slice(0, max).map((x) => texte(x, 40)) : []);
const idOuNull = (v: unknown) => (typeof v === "string" && v ? v.slice(0, 40) : null);

export interface SaisieRdvClient {
  clientNom: string;
  clientTel: string;
  jour: string;
  heure: string;
  dureeMin: number;
  coiffeuseIds: string[];
  modele: string;
  categorieId: string | null;
}

function saisieRdv(s: SaisieRdvClient): svc.SaisieRendezVous {
  return {
    clientNom: texte(s?.clientNom, 80),
    clientTel: texte(s?.clientTel, 30),
    jour: texte(s?.jour, 10),
    heure: texte(s?.heure, 5),
    dureeMin: entier(s?.dureeMin),
    coiffeuseIds: ids(s?.coiffeuseIds),
    modele: texte(s?.modele, 250),
    categorieId: idOuNull(s?.categorieId),
  };
}

export async function creerRendezVousAction(s: SaisieRdvClient) {
  return executer(async () => svc.creerRendezVous(await exigerAction(), saisieRdv(s)));
}

export async function modifierRendezVousAction(id: string, s: SaisieRdvClient) {
  return executer(async () => svc.modifierRendezVous(await exigerAction(), texte(id, 40), saisieRdv(s)));
}

export async function ajouterSansRendezVousAction(s: { clientNom: string; clientTel: string; modele: string; categorieId: string | null }) {
  return executer(async () =>
    svc.ajouterSansRendezVous(await exigerAction(), {
      clientNom: texte(s?.clientNom, 80),
      clientTel: texte(s?.clientTel, 30),
      modele: texte(s?.modele, 250),
      categorieId: idOuNull(s?.categorieId),
    }),
  );
}

export async function arriveeAction(id: string) {
  return executer(async () => svc.marquerArrivee(await exigerAction(), texte(id, 40)));
}

export async function demarrerAction(id: string, s: { dureeMin: number; coiffeuseIds: string[] }) {
  return executer(async () => svc.demarrer(await exigerAction(), texte(id, 40), { dureeMin: entier(s?.dureeMin), coiffeuseIds: ids(s?.coiffeuseIds) }));
}

export async function terminerAction(id: string, s: { prix: number; paiement: Paiement }) {
  return executer(async () =>
    svc.terminer(await exigerAction(), texte(id, 40), { prix: entier(s?.prix), paiement: texte(s?.paiement, 20) as Paiement }),
  );
}

export async function annulerAction(id: string) {
  return executer(async () => svc.annuler(await exigerAction(), texte(id, 40)));
}

export async function absenteAction(id: string) {
  return executer(async () => svc.marquerAbsente(await exigerAction(), texte(id, 40)));
}

export async function basculerAbsenceAction(coiffeuseId: string, jour: string) {
  return executer(async () => svc.basculerAbsence(await exigerAction(), texte(coiffeuseId, 40), texte(jour, 10)));
}

/** Lecture seule : ne rafraîchit pas la page. */
export async function coiffeusesLibresAction(q: {
  jour: string;
  heure: string | null;
  dureeMin: number;
  ignorer: string | null;
  categorieId: string | null;
}) {
  try {
    return await svc.coiffeusesLibres(await exigerAction(), {
      jour: texte(q?.jour, 10),
      heure: q?.heure ? texte(q.heure, 5) : null,
      dureeMin: entier(q?.dureeMin),
      ignorer: idOuNull(q?.ignorer),
      categorieId: idOuNull(q?.categorieId),
    });
  } catch (e) {
    if (e instanceof NonAutorise) return { ok: false as const, erreur: e.message };
    throw e;
  }
}

const photoOuNull = (v: unknown) => (typeof v === "string" ? v.slice(0, 1_200_000) : null);

export async function ajouterCoiffeuseAction(s: { nom: string; joursConge: number[]; categorieIds: string[]; photo?: string | null }) {
  return executer(async () =>
    svc.ajouterCoiffeuse(await exigerAction(["gerante"]), {
      nom: texte(s?.nom, 80),
      joursConge: Array.isArray(s?.joursConge) ? s.joursConge.slice(0, 7).map(entier) : [],
      categorieIds: ids(s?.categorieIds, 50),
      photo: photoOuNull(s?.photo),
    }),
  );
}

export async function ajouterCategorieAction(nom: string, famille: string = "coiffure") {
  return executer(async () =>
    svc.ajouterCategorie(await exigerAction(["gerante"]), texte(nom, 60), famille === "ongles" ? "ongles" : "coiffure"),
  );
}

/** `photo` : absent = on garde l'ancienne ; texte = nouvelle photo ; null = on la retire. */
export async function modifierCoiffeuseAction(
  id: string,
  s: { nom: string; joursConge: number[]; actif: boolean; categorieIds: string[]; photo?: string | null },
) {
  return executer(async () =>
    svc.modifierCoiffeuse(await exigerAction(["gerante"]), texte(id, 40), {
      nom: texte(s?.nom, 80),
      joursConge: Array.isArray(s?.joursConge) ? s.joursConge.slice(0, 7).map(entier) : [],
      actif: s?.actif === true,
      categorieIds: ids(s?.categorieIds, 50),
      ...(s && "photo" in s ? { photo: photoOuNull(s.photo) } : {}),
    }),
  );
}

/* ---------------- Connexion ---------------- */

export async function connexionAction(_prev: { erreur: string } | null, form: FormData): Promise<{ erreur: string } | null> {
  const ok = await seConnecter(texte(form.get("identifiant"), 60), texte(form.get("motDePasse"), 200));
  if (!ok) return { erreur: "Identifiant ou mot de passe incorrect." };
  redirect("/salon");
}

export async function deconnexionAction() {
  await seDeconnecter();
  redirect("/connexion");
}

/* ---------------- Demandes en ligne (secrétaire) ---------------- */

export async function confirmerDemandeAction(id: string, s: { jour: string; heure: string; dureeMin: number; coiffeuseIds: string[] }) {
  return executer(async () =>
    svc.confirmerDemande(await exigerAction(), texte(id, 40), {
      jour: texte(s?.jour, 10),
      heure: texte(s?.heure, 5),
      dureeMin: entier(s?.dureeMin),
      coiffeuseIds: ids(s?.coiffeuseIds),
    }),
  );
}

export async function refuserDemandeAction(id: string, motif: string) {
  return executer(async () => svc.refuserDemande(await exigerAction(), texte(id, 40), texte(motif, 250)));
}

export async function modifierWhatsappSalonAction(whatsapp: string) {
  return executer(async () => svc.modifierWhatsappSalon(await exigerAction(["gerante"]), texte(whatsapp, 30)));
}

/* ---------------- Catalogue de modèles (gérante) ---------------- */

export interface SaisieModeleClient {
  nom: string;
  categorieId: string | null;
  prixMin: number | null;
  prixMax: number | null;
  dureeMin: number | null;
  dureeMax: number | null;
  photo: string | null;
  actif?: boolean;
}

const nombreOuNull = (v: unknown) => (v === null || v === undefined || v === "" ? null : entier(v));

function saisieModele(s: SaisieModeleClient): svc.SaisieModele {
  return {
    nom: texte(s?.nom, 80),
    categorieId: idOuNull(s?.categorieId),
    prixMin: nombreOuNull(s?.prixMin),
    prixMax: nombreOuNull(s?.prixMax),
    dureeMin: nombreOuNull(s?.dureeMin),
    dureeMax: nombreOuNull(s?.dureeMax),
    photo: typeof s?.photo === "string" ? s.photo.slice(0, 1_200_000) : null,
    actif: s?.actif !== false,
  };
}

export async function ajouterModeleAction(s: SaisieModeleClient) {
  return executer(async () => svc.ajouterModele(await exigerAction(["gerante"]), saisieModele(s)));
}

export async function modifierModeleAction(id: string, s: SaisieModeleClient) {
  return executer(async () => svc.modifierModele(await exigerAction(["gerante"]), texte(id, 40), saisieModele(s)));
}

/* ---------------- Avis et vidéos ---------------- */

/** Lien de suivi (donc d'avis) d'une prestation terminée, pour l'envoyer à la cliente sur WhatsApp. */
export async function referenceAvisAction(prestationId: string) {
  return executer(async () => svc.referenceAvis(await exigerAction(), texte(prestationId, 40)));
}

export async function ajouterVideoAction(s: { titre: string; url: string; modeleId: string | null }) {
  return executer(async () =>
    svc.ajouterVideo(await exigerAction(["gerante"]), { titre: texte(s?.titre, 80), url: texte(s?.url, 520), modeleId: idOuNull(s?.modeleId) }),
  );
}

export async function modifierVideoAction(id: string, s: { titre: string; modeleId: string | null; actif: boolean }) {
  return executer(async () =>
    svc.modifierVideo(await exigerAction(["gerante"]), texte(id, 40), { titre: texte(s?.titre, 80), modeleId: idOuNull(s?.modeleId), actif: s?.actif !== false }),
  );
}
