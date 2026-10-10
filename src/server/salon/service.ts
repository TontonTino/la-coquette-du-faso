import "server-only";
import type postgres from "postgres";
import { db } from "@/server/db";
import {
  ajouterMinutes,
  instant,
  peut,
  statutApresAnnulation,
  verifierChoixCoiffeuses,
  verifierDuree,
  verifierJourHeure,
  verifierModele,
  verifierNom,
  verifierPrix,
  verifierTelephone,
  type ActionPrestation,
} from "@/lib/salon/regles";
import type { Categorie, Coiffeuse, Jour, Paiement, Prestation, Resultat, Role, Statut } from "@/lib/salon/types";
import { construireBilan, construireJournee, type Bilan, type Journee } from "@/lib/salon/vue";
import { isValidIsoDate, todayIso, weekday } from "@/lib/time";

/**
 * Service métier de l'espace salon : seule porte d'accès aux données.
 * - Toute requête est filtrée par le salon de l'utilisatrice connectée (ctx.salonId).
 * - Toute écriture se fait dans une transaction, après vérification des règles.
 * - La base refuse en dernier recours deux affectations qui se chevauchent (BR-001).
 */
export interface Ctx {
  salonId: string;
  utilisateurId: string;
  role: Role;
}

type Tx = postgres.TransactionSql;
type R<T = undefined> = Resultat<T>;

const PERSONNEL: Role[] = ["gerante", "secretaire"];
const GERANTE: Role[] = ["gerante"];

class Refus extends Error {}

const ok = <T>(valeur: T): R<T> => ({ ok: true, valeur });
const ko = <T = never>(erreur: string): R<T> => ({ ok: false, erreur });

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const estUuid = (v: unknown): v is string => typeof v === "string" && UUID.test(v);

function autoriser(ctx: Ctx, roles: Role[]) {
  if (!roles.includes(ctx.role)) throw new Error("Action non autorisée pour ce rôle.");
}

function codePg(e: unknown): string | undefined {
  return typeof e === "object" && e !== null && "code" in e ? String((e as { code: unknown }).code) : undefined;
}

async function transaction<T>(fn: (tx: Tx) => Promise<T>): Promise<R<T>> {
  try {
    const valeur = (await db().begin((tx) => fn(tx))) as T;
    return ok(valeur);
  } catch (e) {
    if (e instanceof Refus) return ko(e.message);
    if (codePg(e) === "23P01") {
      return ko("Une coiffeuse choisie vient d'être prise sur ce créneau. Choisissez-en une autre.");
    }
    throw e;
  }
}

/* ------------------------------------------------------------------ */
/* Lecture                                                             */
/* ------------------------------------------------------------------ */

interface LignePrestation {
  id: string;
  origine: Prestation["origine"];
  statut: Statut;
  client_nom: string;
  client_tel: string | null;
  modele: string | null;
  categorie_id: string | null;
  jour: string;
  debut: Date | null;
  duree_min: number;
  arrivee: Date | null;
  prix_paye: number | null;
  paiement: Paiement | null;
  coiffeuse_ids: string[];
}

function versPrestation(l: LignePrestation): Prestation {
  return {
    id: l.id,
    origine: l.origine,
    statut: l.statut,
    clientNom: l.client_nom,
    clientTel: l.client_tel,
    modele: l.modele,
    categorieId: l.categorie_id,
    jour: l.jour,
    debut: l.debut ? l.debut.toISOString() : null,
    dureeMin: l.duree_min,
    arrivee: l.arrivee ? l.arrivee.toISOString() : null,
    prixPaye: l.prix_paye,
    paiement: l.paiement,
    coiffeuseIds: l.coiffeuse_ids ?? [],
  };
}

async function lireCoiffeuses(ctx: Ctx): Promise<Coiffeuse[]> {
  const rows = await db()<{ id: string; nom: string; jours_conge: number[]; actif: boolean; categorie_ids: string[] }[]>`
    SELECT c.id, c.nom, c.jours_conge, c.actif,
           COALESCE(array_agg(k.categorie_id) FILTER (WHERE k.categorie_id IS NOT NULL), '{}') AS categorie_ids
    FROM coiffeuse c LEFT JOIN competence k ON k.coiffeuse_id = c.id AND k.salon_id = c.salon_id
    WHERE c.salon_id = ${ctx.salonId}
    GROUP BY c.id ORDER BY c.actif DESC, c.nom`;
  return rows.map((c) => ({ id: c.id, nom: c.nom, joursConge: c.jours_conge, actif: c.actif, categorieIds: c.categorie_ids }));
}

async function lireCategories(ctx: Ctx): Promise<Categorie[]> {
  const rows = await db()<{ id: string; nom: string }[]>`
    SELECT id, nom FROM categorie WHERE salon_id = ${ctx.salonId} AND actif ORDER BY nom`;
  return rows.map((r) => ({ id: r.id, nom: r.nom }));
}

async function donneesDuJour(ctx: Ctx, jour: Jour) {
  const sql = db();
  const [coiffeuses, categories, absences, prestations] = await Promise.all([
    lireCoiffeuses(ctx),
    lireCategories(ctx),
    sql<{ coiffeuse_id: string }[]>`
      SELECT a.coiffeuse_id FROM absence a JOIN coiffeuse c ON c.id = a.coiffeuse_id
      WHERE c.salon_id = ${ctx.salonId} AND a.jour = ${jour}`,
    sql<LignePrestation[]>`
      SELECT p.id, p.origine, p.statut, p.client_nom, p.client_tel, p.modele, p.categorie_id, p.jour, p.debut, p.duree_min,
             p.arrivee, p.prix_paye, p.paiement,
             COALESCE(array_agg(a.coiffeuse_id ORDER BY a.coiffeuse_id) FILTER (WHERE a.coiffeuse_id IS NOT NULL), '{}') AS coiffeuse_ids
      FROM prestation p
      LEFT JOIN affectation a ON a.prestation_id = p.id AND a.salon_id = p.salon_id
      WHERE p.salon_id = ${ctx.salonId} AND p.jour = ${jour}
      GROUP BY p.id`,
  ]);
  return {
    coiffeuses,
    categories,
    absences: absences.map((a) => a.coiffeuse_id),
    prestations: prestations.map(versPrestation),
  };
}

export async function journee(ctx: Ctx, jour: Jour, now = new Date()): Promise<Journee> {
  autoriser(ctx, PERSONNEL);
  if (!isValidIsoDate(jour)) jour = todayIso(now);
  return construireJournee({ ...(await donneesDuJour(ctx, jour)), jour, now });
}

export async function bilan(ctx: Ctx, jour: Jour): Promise<Bilan> {
  autoriser(ctx, GERANTE);
  return construireBilan({ ...(await donneesDuJour(ctx, jour)), jour });
}

/** Coiffeuses libres sur toute la plage demandée (aide à la saisie ; le serveur revérifie à l'enregistrement). */
export async function coiffeusesLibres(
  ctx: Ctx,
  q: { jour: Jour; heure: string | null; dureeMin: number; ignorer: string | null; categorieId: string | null },
  now = new Date(),
): Promise<R<{ id: string; nom: string }[]>> {
  autoriser(ctx, PERSONNEL);
  if (verifierDuree(q.dureeMin)) return ko("Durée invalide.");
  const debut = q.heure ? instant(q.jour, q.heure) : now;
  if (q.heure && verifierJourHeure(q.jour, q.heure)) return ko("Date ou heure invalide.");
  const jour = q.heure ? q.jour : todayIso(now);
  const fin = ajouterMinutes(debut, q.dureeMin);
  const ignorer = estUuid(q.ignorer) ? q.ignorer : null;
  const categorie = estUuid(q.categorieId) ? q.categorieId : null;
  const rows = await db()<{ id: string; nom: string }[]>`
    SELECT c.id, c.nom FROM coiffeuse c
    WHERE c.salon_id = ${ctx.salonId} AND c.actif
      AND NOT (${weekday(jour)}::smallint = ANY (c.jours_conge))
      AND NOT EXISTS (SELECT 1 FROM absence ab WHERE ab.coiffeuse_id = c.id AND ab.jour = ${jour})
      AND (${categorie}::uuid IS NULL OR EXISTS (
        SELECT 1 FROM competence k WHERE k.coiffeuse_id = c.id AND k.categorie_id = ${categorie}::uuid))
      AND NOT EXISTS (
        SELECT 1 FROM affectation a
        WHERE a.coiffeuse_id = c.id AND a.active
          AND a.plage && tstzrange(${debut}, ${fin}, '[)')
          AND (${ignorer}::uuid IS NULL OR a.prestation_id <> ${ignorer}::uuid))
    ORDER BY c.nom`;
  return ok(rows.map((r) => ({ id: r.id, nom: r.nom })));
}

/* ------------------------------------------------------------------ */
/* Aides d'écriture                                                    */
/* ------------------------------------------------------------------ */

/** Vérifie que le type de coiffure appartient au salon ; renvoie son nom. */
async function verifierCategorie(tx: Tx, ctx: Ctx, categorieId: string | null): Promise<string | null> {
  if (categorieId === null) return null;
  if (!estUuid(categorieId)) throw new Refus("Type de coiffure inconnu.");
  const [cat] = await tx<{ nom: string }[]>`SELECT nom FROM categorie WHERE id = ${categorieId} AND salon_id = ${ctx.salonId}`;
  if (!cat) throw new Refus("Type de coiffure inconnu.");
  return cat.nom;
}

/** BR-002, BR-003, BR-009 : coiffeuses du salon, actives, présentes ce jour-là et compétentes. */
async function verifierCoiffeuses(tx: Tx, ctx: Ctx, ids: string[], jour: Jour, categorieId: string | null) {
  const nomCategorie = await verifierCategorie(tx, ctx, categorieId);
  if (ids.length === 0) return;
  if (!ids.every(estUuid)) throw new Refus("Coiffeuse inconnue.");
  const rows = await tx<{ id: string; nom: string; jours_conge: number[]; actif: boolean; absente: boolean; competente: boolean }[]>`
    SELECT c.id, c.nom, c.jours_conge, c.actif,
           EXISTS (SELECT 1 FROM absence a WHERE a.coiffeuse_id = c.id AND a.jour = ${jour}) AS absente,
           (${categorieId}::uuid IS NULL OR EXISTS (
             SELECT 1 FROM competence k WHERE k.coiffeuse_id = c.id AND k.categorie_id = ${categorieId}::uuid)) AS competente
    FROM coiffeuse c WHERE c.salon_id = ${ctx.salonId} AND c.id IN ${tx(ids)}`;
  if (rows.length !== ids.length) throw new Refus("Coiffeuse inconnue.");
  for (const c of rows) {
    if (!c.actif) throw new Refus(`${c.nom} ne fait plus partie de l'équipe.`);
    if (c.jours_conge.includes(weekday(jour))) throw new Refus(`${c.nom} est en congé ce jour-là.`);
    if (c.absente) throw new Refus(`${c.nom} est absente ce jour-là.`);
    if (!c.competente) throw new Refus(`${c.nom} ne fait pas ce type de coiffure (${nomCategorie}).`);
  }
}

async function poserAffectations(tx: Tx, ctx: Ctx, prestationId: string, ids: string[], debut: Date, dureeMin: number) {
  const fin = ajouterMinutes(debut, dureeMin);
  for (const id of ids) {
    await tx`INSERT INTO affectation (prestation_id, coiffeuse_id, salon_id, plage)
             VALUES (${prestationId}, ${id}, ${ctx.salonId}, tstzrange(${debut}, ${fin}, '[)'))`;
  }
}

async function charger(tx: Tx, ctx: Ctx, id: string, action: ActionPrestation) {
  if (!estUuid(id)) throw new Refus("Cette prestation n'existe pas.");
  const [p] = await tx<{ id: string; statut: Statut; origine: Prestation["origine"]; jour: string; client_nom: string; categorie_id: string | null }[]>`
    SELECT id, statut, origine, jour, client_nom, categorie_id FROM prestation
    WHERE id = ${id} AND salon_id = ${ctx.salonId} FOR UPDATE`;
  if (!p) throw new Refus("Cette prestation n'existe pas.");
  if (!peut(p.statut, action)) throw new Refus("Cette action n'est plus possible : la liste a peut-être changé. Rechargez.");
  return p;
}

async function liberer(tx: Tx, prestationId: string) {
  await tx`UPDATE affectation SET active = false WHERE prestation_id = ${prestationId}`;
}

/* ------------------------------------------------------------------ */
/* Prestations                                                         */
/* ------------------------------------------------------------------ */

export interface SaisieRendezVous {
  clientNom: string;
  clientTel: string;
  jour: Jour;
  heure: string;
  dureeMin: number;
  coiffeuseIds: string[];
  modele: string;
  /** Type de coiffure (facultatif). */
  categorieId: string | null;
}

function validerRendezVous(s: SaisieRendezVous, now: Date): { erreur: string } | { tel: string; debut: Date } {
  const tel = verifierTelephone(s.clientTel, true);
  const erreur =
    verifierNom(s.clientNom) ??
    tel.erreur ??
    verifierJourHeure(s.jour, s.heure) ??
    verifierDuree(s.dureeMin) ??
    verifierChoixCoiffeuses(s.coiffeuseIds, false) ??
    verifierModele(s.modele);
  if (erreur) return { erreur };
  const debut = instant(s.jour, s.heure);
  if (debut.getTime() < now.getTime() - 15 * 60_000) return { erreur: "Cette heure est déjà passée." };
  return { tel: tel.tel!, debut };
}

/** FR-006 / FR-007 */
export async function creerRendezVous(ctx: Ctx, s: SaisieRendezVous, now = new Date()): Promise<R<string>> {
  autoriser(ctx, PERSONNEL);
  const v = validerRendezVous(s, now);
  if ("erreur" in v) return ko(v.erreur);
  return transaction(async (tx) => {
    await verifierCoiffeuses(tx, ctx, s.coiffeuseIds, s.jour, s.categorieId);
    const [p] = await tx<{ id: string }[]>`
      INSERT INTO prestation (salon_id, origine, statut, client_nom, client_tel, modele, categorie_id, jour, debut, duree_min, cree_par)
      VALUES (${ctx.salonId}, 'rendez_vous', 'prevue', ${s.clientNom.trim()}, ${v.tel}, ${s.modele.trim() || null}, ${s.categorieId},
              ${s.jour}, ${v.debut}, ${s.dureeMin}, ${ctx.utilisateurId})
      RETURNING id`;
    await poserAffectations(tx, ctx, p.id, s.coiffeuseIds, v.debut, s.dureeMin);
    return p.id;
  });
}

/** FR-012 : déplacer un rendez-vous ou changer ses coiffeuses (réattribution après une absence). */
export async function modifierRendezVous(ctx: Ctx, id: string, s: SaisieRendezVous, now = new Date()): Promise<R<string>> {
  autoriser(ctx, PERSONNEL);
  const v = validerRendezVous(s, now);
  if ("erreur" in v) return ko(v.erreur);
  return transaction(async (tx) => {
    const p = await charger(tx, ctx, id, "modifier");
    if (p.origine !== "rendez_vous") throw new Refus("Seul un rendez-vous peut être déplacé.");
    await verifierCoiffeuses(tx, ctx, s.coiffeuseIds, s.jour, s.categorieId);
    await tx`DELETE FROM affectation WHERE prestation_id = ${id}`;
    await tx`UPDATE prestation SET client_nom = ${s.clientNom.trim()}, client_tel = ${v.tel}, modele = ${s.modele.trim() || null},
               categorie_id = ${s.categorieId},
               jour = ${s.jour}, debut = ${v.debut}, duree_min = ${s.dureeMin}, maj_le = now()
             WHERE id = ${id}`;
    await poserAffectations(tx, ctx, id, s.coiffeuseIds, v.debut, s.dureeMin);
    return id;
  });
}

/** FR-008 */
export async function ajouterSansRendezVous(
  ctx: Ctx,
  s: { clientNom: string; clientTel: string; modele: string; categorieId: string | null },
  now = new Date(),
): Promise<R<string>> {
  autoriser(ctx, PERSONNEL);
  const tel = verifierTelephone(s.clientTel, false);
  const erreur = verifierNom(s.clientNom) ?? tel.erreur ?? verifierModele(s.modele);
  if (erreur) return ko(erreur);
  return transaction(async (tx) => {
    await verifierCategorie(tx, ctx, s.categorieId);
    const [p] = await tx<{ id: string }[]>`
      INSERT INTO prestation (salon_id, origine, statut, client_nom, client_tel, modele, categorie_id, jour, duree_min, arrivee, cree_par)
      VALUES (${ctx.salonId}, 'sans_rendez_vous', 'en_attente', ${s.clientNom.trim()}, ${tel.tel}, ${s.modele.trim() || null}, ${s.categorieId},
              ${todayIso(now)}, 180, ${now}, ${ctx.utilisateurId})
      RETURNING id`;
    return p.id;
  });
}

/** FR-009 */
export async function marquerArrivee(ctx: Ctx, id: string, now = new Date()): Promise<R> {
  autoriser(ctx, PERSONNEL);
  return transaction(async (tx) => {
    const p = await charger(tx, ctx, id, "arrivee");
    if (p.jour !== todayIso(now)) throw new Refus("Ce rendez-vous n'est pas prévu aujourd'hui.");
    await tx`UPDATE prestation SET statut = 'en_attente', arrivee = ${now}, maj_le = now() WHERE id = ${id}`;
    return undefined;
  });
}

/** FR-010 : la prestation commence maintenant, avec 1 ou 2 coiffeuses libres sur toute la durée. */
export async function demarrer(ctx: Ctx, id: string, s: { dureeMin: number; coiffeuseIds: string[] }, now = new Date()): Promise<R> {
  autoriser(ctx, PERSONNEL);
  const erreur = verifierDuree(s.dureeMin) ?? verifierChoixCoiffeuses(s.coiffeuseIds, true);
  if (erreur) return ko(erreur);
  const aujourdhui = todayIso(now);
  return transaction(async (tx) => {
    const p = await charger(tx, ctx, id, "demarrer");
    if (p.jour !== aujourdhui) throw new Refus("Cette prestation n'est pas prévue aujourd'hui.");
    await verifierCoiffeuses(tx, ctx, s.coiffeuseIds, aujourdhui, p.categorie_id);
    await tx`DELETE FROM affectation WHERE prestation_id = ${id}`;
    await tx`UPDATE prestation SET statut = 'en_cours', debut = ${now}, duree_min = ${s.dureeMin},
               arrivee = COALESCE(arrivee, ${now}), maj_le = now()
             WHERE id = ${id}`;
    await poserAffectations(tx, ctx, id, s.coiffeuseIds, now, s.dureeMin);
    return undefined;
  });
}

/** FR-011 : encaissement ; les coiffeuses sont libérées dès maintenant. */
export async function terminer(ctx: Ctx, id: string, s: { prix: number; paiement: Paiement }, now = new Date()): Promise<R> {
  autoriser(ctx, PERSONNEL);
  const erreur = verifierPrix(s.prix) ?? (s.paiement === "especes" || s.paiement === "mobile_money" ? null : "Moyen de paiement invalide.");
  if (erreur) return ko(erreur);
  return transaction(async (tx) => {
    await charger(tx, ctx, id, "terminer");
    await tx`UPDATE prestation SET statut = 'terminee', prix_paye = ${s.prix}, paiement = ${s.paiement}, maj_le = now() WHERE id = ${id}`;
    await tx`UPDATE affectation
             SET active = false,
                 plage = tstzrange(lower(plage), GREATEST(lower(plage) + interval '1 minute', LEAST(upper(plage), ${now}::timestamptz)), '[)')
             WHERE prestation_id = ${id}`;
    return undefined;
  });
}

/** FR-012 : annulation (rendez-vous) ou départ d'une cliente qui attendait. */
export async function annuler(ctx: Ctx, id: string): Promise<R> {
  autoriser(ctx, PERSONNEL);
  return transaction(async (tx) => {
    const p = await charger(tx, ctx, id, "annuler");
    await tx`UPDATE prestation SET statut = ${statutApresAnnulation(p.statut)}, maj_le = now() WHERE id = ${id}`;
    await liberer(tx, id);
    return undefined;
  });
}

/** FR-012 : la cliente n'est pas venue. */
export async function marquerAbsente(ctx: Ctx, id: string): Promise<R> {
  autoriser(ctx, PERSONNEL);
  return transaction(async (tx) => {
    await charger(tx, ctx, id, "absente");
    await tx`UPDATE prestation SET statut = 'absente', maj_le = now() WHERE id = ${id}`;
    await liberer(tx, id);
    return undefined;
  });
}

/* ------------------------------------------------------------------ */
/* Coiffeuses                                                          */
/* ------------------------------------------------------------------ */

/** FR-003 : déclare ou annule une absence. Renvoie le nombre de prestations à réattribuer. */
export async function basculerAbsence(ctx: Ctx, coiffeuseId: string, jour: Jour): Promise<R<{ absente: boolean; aReattribuer: number }>> {
  autoriser(ctx, PERSONNEL);
  if (!estUuid(coiffeuseId) || !isValidIsoDate(jour)) return ko("Demande invalide.");
  return transaction(async (tx) => {
    const [c] = await tx`SELECT id FROM coiffeuse WHERE id = ${coiffeuseId} AND salon_id = ${ctx.salonId}`;
    if (!c) throw new Refus("Coiffeuse inconnue.");
    const supprimees = await tx`DELETE FROM absence WHERE coiffeuse_id = ${coiffeuseId} AND jour = ${jour} RETURNING jour`;
    if (supprimees.length > 0) return { absente: false, aReattribuer: 0 };
    await tx`INSERT INTO absence (coiffeuse_id, jour) VALUES (${coiffeuseId}, ${jour})`;
    const [{ n }] = await tx<{ n: number }[]>`
      SELECT count(*)::int AS n FROM prestation p JOIN affectation a ON a.prestation_id = p.id
      WHERE p.salon_id = ${ctx.salonId} AND p.jour = ${jour} AND p.statut IN ('prevue', 'en_attente')
        AND a.coiffeuse_id = ${coiffeuseId} AND a.active`;
    return { absente: true, aReattribuer: n };
  });
}

export async function listerEquipe(ctx: Ctx): Promise<{ coiffeuses: Coiffeuse[]; categories: Categorie[] }> {
  autoriser(ctx, GERANTE);
  const [coiffeuses, categories] = await Promise.all([lireCoiffeuses(ctx), lireCategories(ctx)]);
  return { coiffeuses, categories };
}

/** FR-015 : la gérante crée un type de coiffure. */
export async function ajouterCategorie(ctx: Ctx, nom: string): Promise<R<string>> {
  autoriser(ctx, GERANTE);
  const n = nom.trim();
  if (n.length < 2 || n.length > 40) return ko("Le type de coiffure doit faire entre 2 et 40 caractères.");
  try {
    return await transaction(async (tx) => {
      const [c] = await tx<{ id: string }[]>`INSERT INTO categorie (salon_id, nom) VALUES (${ctx.salonId}, ${n}) RETURNING id`;
      return c.id;
    });
  } catch (e) {
    if (codePg(e) === "23505") return ko("Ce type de coiffure existe déjà.");
    throw e;
  }
}

/** FR-016 : la gérante indique ce que chaque coiffeuse sait faire. */
async function ecrireCompetences(tx: Tx, ctx: Ctx, coiffeuseId: string, categorieIds: string[]) {
  if (!categorieIds.every(estUuid) || new Set(categorieIds).size !== categorieIds.length) throw new Refus("Types de coiffure invalides.");
  if (categorieIds.length) {
    const ok = await tx`SELECT id FROM categorie WHERE salon_id = ${ctx.salonId} AND id IN ${tx(categorieIds)}`;
    if (ok.length !== categorieIds.length) throw new Refus("Type de coiffure inconnu.");
  }
  await tx`DELETE FROM competence WHERE coiffeuse_id = ${coiffeuseId} AND salon_id = ${ctx.salonId}`;
  for (const cat of categorieIds) {
    await tx`INSERT INTO competence (coiffeuse_id, categorie_id, salon_id) VALUES (${coiffeuseId}, ${cat}, ${ctx.salonId})`;
  }
}

function verifierFiche(nom: string, joursConge: number[]): string | null {
  if (nom.trim().length < 2 || nom.trim().length > 60) return "Le nom doit faire entre 2 et 60 caractères.";
  if (!joursConge.every((j) => Number.isInteger(j) && j >= 0 && j <= 6) || new Set(joursConge).size !== joursConge.length) {
    return "Jours de congé invalides.";
  }
  return null;
}

/** FR-001 / FR-002 */
export async function ajouterCoiffeuse(ctx: Ctx, s: { nom: string; joursConge: number[]; categorieIds: string[] }): Promise<R<string>> {
  autoriser(ctx, GERANTE);
  const erreur = verifierFiche(s.nom, s.joursConge);
  if (erreur) return ko(erreur);
  return transaction(async (tx) => {
    const [c] = await tx<{ id: string }[]>`
      INSERT INTO coiffeuse (salon_id, nom, jours_conge) VALUES (${ctx.salonId}, ${s.nom.trim()}, ${s.joursConge}) RETURNING id`;
    await ecrireCompetences(tx, ctx, c.id, s.categorieIds);
    return c.id;
  });
}

export async function modifierCoiffeuse(
  ctx: Ctx,
  id: string,
  s: { nom: string; joursConge: number[]; actif: boolean; categorieIds: string[] },
): Promise<R> {
  autoriser(ctx, GERANTE);
  const erreur = !estUuid(id) ? "Coiffeuse inconnue." : verifierFiche(s.nom, s.joursConge);
  if (erreur) return ko(erreur);
  return transaction(async (tx) => {
    const r = await tx`UPDATE coiffeuse SET nom = ${s.nom.trim()}, jours_conge = ${s.joursConge}, actif = ${s.actif}
                       WHERE id = ${id} AND salon_id = ${ctx.salonId} RETURNING id`;
    if (r.length === 0) throw new Refus("Coiffeuse inconnue.");
    await ecrireCompetences(tx, ctx, id, s.categorieIds);
    return undefined;
  });
}
