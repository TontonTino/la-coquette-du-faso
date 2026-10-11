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
  DEMANDES_EN_ATTENTE_MAX_PAR_NUMERO,
  estReference,
  nouvelleReference,
  verifierJourDemande,
  verifierMoment,
  verifierFourchettes,
  typeImage,
  PHOTO_TAILLE_MAX,
  noteAffichee,
  trierParNote,
  verifierAvis,
  verifierVideo,
} from "@/lib/salon/regles";
import { randomBytes } from "node:crypto";
import type { Categorie, Coiffeuse, Famille, Jour, Modele, Moment, Paiement, Prestation, Resultat, Role, Statut, Video } from "@/lib/salon/types";
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

/** Adresse de la photo d'une coiffeuse ; le paramètre v change à chaque modification (cache navigateur sûr). */
const urlPhotoCoiffeuse = (id: string, maj: Date | null) => (maj ? `/equipe/${id}/photo?v=${maj.getTime().toString(36)}` : null);

async function lireCoiffeuses(ctx: Ctx): Promise<Coiffeuse[]> {
  const rows = await db()<
    { id: string; nom: string; jours_conge: number[]; actif: boolean; categorie_ids: string[]; photo_maj: Date | null;
      a_photo: boolean; moyenne: number | null; nb_avis: number }[]
  >`
    SELECT c.id, c.nom, c.jours_conge, c.actif, c.photo_maj, (c.photo IS NOT NULL) AS a_photo,
           COALESCE(array_agg(k.categorie_id) FILTER (WHERE k.categorie_id IS NOT NULL), '{}') AS categorie_ids,
           (SELECT avg(v.note)::float8 FROM avis v WHERE v.coiffeuse_id = c.id) AS moyenne,
           (SELECT count(*)::int FROM avis v WHERE v.coiffeuse_id = c.id) AS nb_avis
    FROM coiffeuse c LEFT JOIN competence k ON k.coiffeuse_id = c.id AND k.salon_id = c.salon_id
    WHERE c.salon_id = ${ctx.salonId}
    GROUP BY c.id ORDER BY c.actif DESC, c.nom`;
  return rows.map((c) => ({
    id: c.id,
    nom: c.nom,
    joursConge: c.jours_conge,
    actif: c.actif,
    categorieIds: c.categorie_ids,
    photoUrl: c.a_photo ? urlPhotoCoiffeuse(c.id, c.photo_maj) : null,
    moyenne: c.moyenne,
    nbAvis: c.nb_avis,
  }));
}

async function lireCategories(ctx: Ctx): Promise<Categorie[]> {
  const rows = await db()<{ id: string; nom: string; famille: Famille }[]>`
    SELECT id, nom, famille FROM categorie WHERE salon_id = ${ctx.salonId} AND actif ORDER BY famille, nom`;
  return rows.map((r) => ({ id: r.id, nom: r.nom, famille: r.famille }));
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

/** Vérifie que le type de service appartient au salon ; renvoie son nom. */
async function verifierCategorie(tx: Tx, ctx: Ctx, categorieId: string | null): Promise<string | null> {
  if (categorieId === null) return null;
  if (!estUuid(categorieId)) throw new Refus("Type de service inconnu.");
  const [cat] = await tx<{ nom: string }[]>`SELECT nom FROM categorie WHERE id = ${categorieId} AND salon_id = ${ctx.salonId}`;
  if (!cat) throw new Refus("Type de service inconnu.");
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
    if (!c.competente) throw new Refus(`${c.nom} ne fait pas ce service (${nomCategorie}).`);
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
    // Le créneau est libéré (active = false) ; a_fait garde la trace de celles qui ont fait la coiffure (avis).
    await tx`UPDATE affectation
             SET a_fait = active, active = false,
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

/** FR-015 : la gérante crée un type de service (coiffure, ou ongles : manucure, pédicure…). */
export async function ajouterCategorie(ctx: Ctx, nom: string, famille: Famille = "coiffure"): Promise<R<string>> {
  autoriser(ctx, GERANTE);
  const n = nom.trim();
  if (n.length < 2 || n.length > 40) return ko("Le type de service doit faire entre 2 et 40 caractères.");
  if (famille !== "coiffure" && famille !== "ongles") return ko("Famille de service inconnue.");
  try {
    return await transaction(async (tx) => {
      const [c] = await tx<{ id: string }[]>`INSERT INTO categorie (salon_id, nom, famille) VALUES (${ctx.salonId}, ${n}, ${famille}) RETURNING id`;
      return c.id;
    });
  } catch (e) {
    if (codePg(e) === "23505") return ko("Ce type de service existe déjà.");
    throw e;
  }
}

/** FR-016 : la gérante indique ce que chaque coiffeuse sait faire. */
async function ecrireCompetences(tx: Tx, ctx: Ctx, coiffeuseId: string, categorieIds: string[]) {
  if (!categorieIds.every(estUuid) || new Set(categorieIds).size !== categorieIds.length) throw new Refus("Types de coiffure invalides.");
  if (categorieIds.length) {
    const ok = await tx`SELECT id FROM categorie WHERE salon_id = ${ctx.salonId} AND id IN ${tx(categorieIds)}`;
    if (ok.length !== categorieIds.length) throw new Refus("Type de service inconnu.");
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
export async function ajouterCoiffeuse(
  ctx: Ctx,
  s: { nom: string; joursConge: number[]; categorieIds: string[]; photo?: string | null },
): Promise<R<string>> {
  autoriser(ctx, GERANTE);
  const erreur = verifierFiche(s.nom, s.joursConge);
  if (erreur) return ko(erreur);
  const photo = s.photo ? decoderPhoto(s.photo) : null;
  if (photo && "erreur" in photo) return ko(photo.erreur);
  return transaction(async (tx) => {
    const [c] = await tx<{ id: string }[]>`
      INSERT INTO coiffeuse (salon_id, nom, jours_conge, photo, photo_type, photo_maj)
      VALUES (${ctx.salonId}, ${s.nom.trim()}, ${s.joursConge}, ${photo ? photo.octets : null}, ${photo ? photo.type : null}, ${photo ? new Date() : null})
      RETURNING id`;
    await ecrireCompetences(tx, ctx, c.id, s.categorieIds);
    return c.id;
  });
}

/** `photo` : absent = on garde l'ancienne ; texte (base64) = nouvelle photo ; null = on la retire. */
export async function modifierCoiffeuse(
  ctx: Ctx,
  id: string,
  s: { nom: string; joursConge: number[]; actif: boolean; categorieIds: string[]; photo?: string | null },
): Promise<R> {
  autoriser(ctx, GERANTE);
  const erreur = !estUuid(id) ? "Coiffeuse inconnue." : verifierFiche(s.nom, s.joursConge);
  if (erreur) return ko(erreur);
  const photo = s.photo ? decoderPhoto(s.photo) : null;
  if (photo && "erreur" in photo) return ko(photo.erreur);
  return transaction(async (tx) => {
    const r = await tx`UPDATE coiffeuse SET nom = ${s.nom.trim()}, jours_conge = ${s.joursConge}, actif = ${s.actif}
                       WHERE id = ${id} AND salon_id = ${ctx.salonId} RETURNING id`;
    if (r.length === 0) throw new Refus("Coiffeuse inconnue.");
    if (photo) {
      await tx`UPDATE coiffeuse SET photo = ${photo.octets}, photo_type = ${photo.type}, photo_maj = now() WHERE id = ${id}`;
    } else if (s.photo === null) {
      await tx`UPDATE coiffeuse SET photo = NULL, photo_type = NULL, photo_maj = NULL WHERE id = ${id}`;
    }
    await ecrireCompetences(tx, ctx, id, s.categorieIds);
    return undefined;
  });
}

/** Photo publique d'une coiffeuse de l'équipe (seulement si elle en fait encore partie). */
export async function photoCoiffeuse(id: string): Promise<{ octets: Buffer; type: string } | null> {
  if (!estUuid(id)) return null;
  const [r] = await db()<{ photo: Buffer; photo_type: string }[]>`
    SELECT photo, photo_type FROM coiffeuse WHERE id = ${id} AND actif AND photo IS NOT NULL`;
  return r ? { octets: r.photo, type: r.photo_type } : null;
}

/* ------------------------------------------------------------------ */
/* Salon (paramètres visibles par les clientes)                        */
/* ------------------------------------------------------------------ */

export async function parametresSalon(ctx: Ctx): Promise<{ nom: string; whatsapp: string | null; slug: string | null }> {
  autoriser(ctx, PERSONNEL);
  const [r] = await db()<{ nom: string; whatsapp: string | null; slug: string | null }[]>`
    SELECT nom, whatsapp, slug FROM salon WHERE id = ${ctx.salonId}`;
  return r;
}

/** FR-B08 : numéro WhatsApp du salon affiché aux clientes (pour envoyer la photo du modèle). */
export async function modifierWhatsappSalon(ctx: Ctx, whatsapp: string): Promise<R> {
  autoriser(ctx, GERANTE);
  const tel = verifierTelephone(whatsapp, false);
  if (tel.erreur) return ko(tel.erreur);
  await db()`UPDATE salon SET whatsapp = ${tel.tel} WHERE id = ${ctx.salonId}`;
  return ok(undefined);
}

/* ------------------------------------------------------------------ */
/* Demandes en ligne — côté secrétaire (FR-B04 à FR-B06)               */
/* ------------------------------------------------------------------ */

export interface Demande {
  id: string;
  reference: string;
  clientNom: string;
  clientTel: string;
  categorieId: string | null;
  categorie: string | null;
  jour: Jour;
  moment: Moment | null;
  coiffeuseSouhaitee: { id: string; nom: string } | null;
  remarque: string | null;
  recueLe: string;
  dureeMin: number;
  modele: { nom: string; photoUrl: string } | null;
}

export async function demandesEnAttente(ctx: Ctx): Promise<Demande[]> {
  autoriser(ctx, PERSONNEL);
  const rows = await db()<
    {
      id: string; reference: string; client_nom: string; client_tel: string; categorie_id: string | null; categorie: string | null;
      jour: string; souhait_moment: Moment | null; cs_id: string | null; cs_nom: string | null; modele: string | null; cree_le: Date;
      duree_min: number; m_id: string | null; m_nom: string | null; m_maj: Date | null;
    }[]
  >`
    SELECT p.id, p.reference, p.client_nom, p.client_tel, p.categorie_id, k.nom AS categorie, p.jour, p.souhait_moment,
           c.id AS cs_id, c.nom AS cs_nom, p.modele, p.cree_le, p.duree_min, m.id AS m_id, m.nom AS m_nom, m.maj_le AS m_maj
    FROM prestation p
    LEFT JOIN modele m ON m.id = p.modele_id AND m.salon_id = p.salon_id
    LEFT JOIN categorie k ON k.id = p.categorie_id AND k.salon_id = p.salon_id
    LEFT JOIN coiffeuse c ON c.id = p.coiffeuse_souhaitee AND c.salon_id = p.salon_id
    WHERE p.salon_id = ${ctx.salonId} AND p.statut = 'demandee'
    ORDER BY p.jour, p.cree_le`;
  return rows.map((r) => ({
    id: r.id,
    reference: r.reference,
    clientNom: r.client_nom,
    clientTel: r.client_tel,
    categorieId: r.categorie_id,
    categorie: r.categorie,
    jour: r.jour,
    moment: r.souhait_moment,
    coiffeuseSouhaitee: r.cs_id ? { id: r.cs_id, nom: r.cs_nom! } : null,
    remarque: r.modele,
    recueLe: r.cree_le.toISOString(),
    dureeMin: r.duree_min,
    modele: r.m_id ? { nom: r.m_nom!, photoUrl: urlPhoto(r.m_id, r.m_maj!) } : null,
  }));
}

/** FR-B05 : la secrétaire fixe l'heure exacte, la durée et les coiffeuses ; la demande devient un rendez-vous. */
export async function confirmerDemande(
  ctx: Ctx,
  id: string,
  s: { jour: Jour; heure: string; dureeMin: number; coiffeuseIds: string[] },
  now = new Date(),
): Promise<R<{ reference: string; clientNom: string; clientTel: string; coiffeuses: string[] }>> {
  autoriser(ctx, PERSONNEL);
  const erreur = verifierJourHeure(s.jour, s.heure) ?? verifierDuree(s.dureeMin) ?? verifierChoixCoiffeuses(s.coiffeuseIds, true);
  if (erreur) return ko(erreur);
  const debut = instant(s.jour, s.heure);
  if (debut.getTime() < now.getTime() - 15 * 60_000) return ko("Cette heure est déjà passée.");
  return transaction(async (tx) => {
    const p = await charger(tx, ctx, id, "confirmer");
    await verifierCoiffeuses(tx, ctx, s.coiffeuseIds, s.jour, p.categorie_id);
    const [d] = await tx<{ reference: string; client_nom: string; client_tel: string }[]>`
      UPDATE prestation SET statut = 'prevue', jour = ${s.jour}, debut = ${debut}, duree_min = ${s.dureeMin}, maj_le = now()
      WHERE id = ${id} RETURNING reference, client_nom, client_tel`;
    await poserAffectations(tx, ctx, id, s.coiffeuseIds, debut, s.dureeMin);
    const noms = await tx<{ nom: string }[]>`SELECT nom FROM coiffeuse WHERE salon_id = ${ctx.salonId} AND id IN ${tx(s.coiffeuseIds)} ORDER BY nom`;
    return { reference: d.reference, clientNom: d.client_nom, clientTel: d.client_tel, coiffeuses: noms.map((n) => n.nom) };
  });
}

/** FR-B06 : refus avec un motif lisible par la cliente. */
export async function refuserDemande(ctx: Ctx, id: string, motif: string): Promise<R<{ clientNom: string; clientTel: string }>> {
  autoriser(ctx, PERSONNEL);
  const m = motif.trim();
  if (m.length < 3 || m.length > 200) return ko("Indiquez un motif (3 à 200 caractères).");
  return transaction(async (tx) => {
    await charger(tx, ctx, id, "refuser");
    const [d] = await tx<{ client_nom: string; client_tel: string }[]>`
      UPDATE prestation SET statut = 'refusee', motif_refus = ${m}, maj_le = now() WHERE id = ${id} RETURNING client_nom, client_tel`;
    return { clientNom: d.client_nom, clientTel: d.client_tel };
  });
}

/* ------------------------------------------------------------------ */
/* Côté clientes — pages publiques, sans connexion (FR-B01 à FR-B03)   */
/* ------------------------------------------------------------------ */

export interface CoiffeusePublique {
  id: string;
  nom: string;
  categorieIds: string[];
  joursConge: number[];
  photoUrl: string | null;
  /** Moyenne affichable (« 4,8 »), seulement à partir de 3 avis. */
  note: string | null;
  nbAvis: number;
}

export interface SalonPublic {
  nom: string;
  whatsapp: string | null;
  telephone: string | null;
  email: string | null;
  adresse: string | null;
  horaires: string | null;
  carteUrl: string | null;
  categories: Categorie[];
  /** Les mieux notées d'abord. */
  coiffeuses: CoiffeusePublique[];
  modeles: Modele[];
  videos: Video[];
}

interface LigneSalon {
  id: string;
  nom: string;
  whatsapp: string | null;
  telephone: string | null;
  email: string | null;
  adresse: string | null;
  horaires: string | null;
  carte_url: string | null;
}

async function salonParSlug(slug: string): Promise<LigneSalon | null> {
  if (!/^[a-z0-9-]{3,60}$/.test(slug)) return null;
  const [s] = await db()<LigneSalon[]>`
    SELECT id, nom, whatsapp, telephone, email, adresse, horaires, carte_url FROM salon WHERE slug = ${slug}`;
  return s ?? null;
}

/** Ce qu'une cliente peut voir : services, équipe (prénom, photo, note), vidéos. Aucune donnée personnelle de clientes. */
export async function salonPublic(slug: string): Promise<SalonPublic | null> {
  const s = await salonParSlug(slug);
  if (!s) return null;
  const ctx: Ctx = { salonId: s.id, utilisateurId: "", role: "secretaire" };
  const [coiffeuses, categories, modeles, videos] = await Promise.all([
    lireCoiffeuses(ctx),
    lireCategories(ctx),
    lireModeles(ctx, false),
    lireVideos(ctx, false),
  ]);
  return {
    nom: s.nom,
    whatsapp: s.whatsapp,
    telephone: s.telephone,
    email: s.email,
    adresse: s.adresse,
    horaires: s.horaires,
    carteUrl: s.carte_url,
    categories,
    modeles,
    videos,
    coiffeuses: trierParNote(coiffeuses.filter((c) => c.actif)).map((c) => ({
      id: c.id,
      nom: c.nom,
      categorieIds: c.categorieIds,
      joursConge: c.joursConge,
      photoUrl: c.photoUrl,
      note: noteAffichee(c.moyenne, c.nbAvis),
      nbAvis: c.nbAvis,
    })),
  };
}

export interface SaisieDemande {
  clientNom: string;
  clientTel: string;
  categorieId: string | null;
  /** Modèle choisi sur photo (facultatif). */
  modeleId: string | null;
  jour: Jour;
  moment: string | null;
  coiffeuseSouhaitee: string | null;
  remarque: string;
  /** Champ invisible : rempli seulement par les robots. */
  piege: string;
}

/** FR-B02 : une cliente envoie une demande ; elle reçoit une référence de suivi. */
export async function creerDemande(slug: string, s: SaisieDemande, now = new Date()): Promise<R<{ reference: string }>> {
  if (s.piege) return ko("Demande refusée.");
  const salon = await salonParSlug(slug);
  if (!salon) return ko("Salon introuvable.");
  const ctx: Ctx = { salonId: salon.id, utilisateurId: "", role: "secretaire" };
  const tel = verifierTelephone(s.clientTel, true);
  const erreur =
    verifierNom(s.clientNom) ??
    tel.erreur ??
    verifierJourDemande(s.jour, todayIso(now)) ??
    (verifierMoment(s.moment) ? null : "Moment de la journée invalide.") ??
    verifierModele(s.remarque);
  if (erreur) return ko(erreur);
  if (s.coiffeuseSouhaitee !== null && !estUuid(s.coiffeuseSouhaitee)) return ko("Coiffeuse inconnue.");
  if (s.modeleId !== null && !estUuid(s.modeleId)) return ko("Modèle inconnu.");

  return transaction(async (tx) => {
    // Anti-abus (SEC-B01) : limite les demandes en attente par numéro et le volume par heure.
    const [{ n }] = await tx<{ n: number }[]>`
      SELECT count(*)::int AS n FROM prestation
      WHERE salon_id = ${ctx.salonId} AND client_tel = ${tel.tel} AND statut = 'demandee'`;
    if (n >= DEMANDES_EN_ATTENTE_MAX_PAR_NUMERO) {
      throw new Refus(`Vous avez déjà ${n} demandes en attente. Le salon vous répondra bientôt sur WhatsApp.`);
    }
    const [{ h }] = await tx<{ h: number }[]>`
      SELECT count(*)::int AS h FROM prestation
      WHERE salon_id = ${ctx.salonId} AND canal = 'en_ligne' AND cree_le > ${new Date(now.getTime() - 3_600_000)}`;
    if (h >= 60) throw new Refus("Beaucoup de demandes en ce moment : réessayez dans quelques minutes ou écrivez au salon sur WhatsApp.");

    // Un modèle choisi sur photo donne son type de service et sa durée habituelle.
    let categorieId = s.categorieId;
    let duree = 180;
    if (s.modeleId) {
      const [m] = await tx<{ categorie_id: string | null; duree_min: number | null }[]>`
        SELECT categorie_id, duree_min FROM modele WHERE id = ${s.modeleId} AND salon_id = ${ctx.salonId} AND actif`;
      if (!m) throw new Refus("Ce modèle n'est plus proposé.");
      categorieId = categorieId ?? m.categorie_id;
      duree = m.duree_min ?? duree;
    }
    await verifierCategorie(tx, ctx, categorieId);
    if (s.coiffeuseSouhaitee) await verifierCoiffeuses(tx, ctx, [s.coiffeuseSouhaitee], s.jour, categorieId);

    for (let essai = 0; essai < 5; essai++) {
      const reference = nouvelleReference((n) => randomBytes(n));
      const r = await tx<{ reference: string }[]>`
        INSERT INTO prestation (salon_id, origine, statut, canal, reference, client_nom, client_tel, modele, categorie_id, modele_id,
                                jour, duree_min, souhait_moment, coiffeuse_souhaitee)
        VALUES (${ctx.salonId}, 'rendez_vous', 'demandee', 'en_ligne', ${reference}, ${s.clientNom.trim()}, ${tel.tel},
                ${s.remarque.trim() || null}, ${categorieId}, ${s.modeleId}, ${s.jour}, ${duree}, ${s.moment}, ${s.coiffeuseSouhaitee})
        ON CONFLICT (reference) DO NOTHING
        RETURNING reference`;
      if (r.length) return { reference: r[0].reference };
    }
    throw new Error("Impossible de générer une référence unique.");
  });
}

export interface SuiviDemande {
  reference: string;
  salonNom: string;
  salonWhatsapp: string | null;
  prenom: string;
  statut: Statut;
  jour: Jour;
  moment: Moment | null;
  heure: string | null;
  categorie: string | null;
  coiffeuses: string[];
  motifRefus: string | null;
  modele: { nom: string; photoUrl: string } | null;
  /** Coiffeuses de la prestation terminée, avec la note déjà donnée par la cliente (pour les noter). */
  aNoter: { id: string; nom: string; photoUrl: string | null; note: number | null }[];
}

/** FR-B03 : suivi par référence. Ne renvoie ni le téléphone ni le nom complet. */
export async function suiviDemande(reference: string): Promise<SuiviDemande | null> {
  if (!estReference(reference)) return null;
  const [r] = await db()<
    {
      prestation_id: string; reference: string; salon_nom: string; salon_whatsapp: string | null; client_nom: string; statut: Statut; jour: string;
      souhait_moment: Moment | null; debut: Date | null; categorie: string | null; coiffeuses: string[]; motif_refus: string | null;
      m_id: string | null; m_nom: string | null; m_maj: Date | null;
    }[]
  >`
    SELECT p.id AS prestation_id, p.reference, s.nom AS salon_nom, s.whatsapp AS salon_whatsapp, p.client_nom, p.statut, p.jour, p.souhait_moment, p.debut,
           k.nom AS categorie, p.motif_refus, m.id AS m_id, m.nom AS m_nom, m.maj_le AS m_maj,
           COALESCE((SELECT array_agg(c.nom ORDER BY c.nom) FROM affectation a JOIN coiffeuse c ON c.id = a.coiffeuse_id
                     WHERE a.prestation_id = p.id AND a.active), '{}') AS coiffeuses
    FROM prestation p
    JOIN salon s ON s.id = p.salon_id
    LEFT JOIN categorie k ON k.id = p.categorie_id AND k.salon_id = p.salon_id
    LEFT JOIN modele m ON m.id = p.modele_id AND m.salon_id = p.salon_id
    WHERE p.reference = ${reference}`;
  if (!r) return null;
  const aNoter =
    r.statut === "terminee"
      ? await db()<{ id: string; nom: string; photo_maj: Date | null; a_photo: boolean; note: number | null }[]>`
          SELECT c.id, c.nom, c.photo_maj, (c.photo IS NOT NULL) AS a_photo, v.note
          FROM affectation a
          JOIN coiffeuse c ON c.id = a.coiffeuse_id AND c.salon_id = a.salon_id
          LEFT JOIN avis v ON v.prestation_id = a.prestation_id AND v.coiffeuse_id = a.coiffeuse_id
          WHERE a.prestation_id = ${r.prestation_id} AND a.a_fait
          ORDER BY c.nom`
      : [];
  return {
    reference: r.reference,
    salonNom: r.salon_nom,
    salonWhatsapp: r.salon_whatsapp,
    prenom: r.client_nom.trim().split(/\s+/)[0],
    statut: r.statut,
    jour: r.jour,
    moment: r.souhait_moment,
    heure: r.debut ? r.debut.toISOString().slice(11, 16) : null,
    categorie: r.categorie,
    coiffeuses: r.coiffeuses,
    motifRefus: r.motif_refus,
    modele: r.m_id ? { nom: r.m_nom!, photoUrl: urlPhoto(r.m_id, r.m_maj!) } : null,
    aNoter: aNoter.map((c) => ({ id: c.id, nom: c.nom, photoUrl: c.a_photo ? urlPhotoCoiffeuse(c.id, c.photo_maj) : null, note: c.note })),
  };
}

/* ------------------------------------------------------------------ */
/* Catalogue de modèles en photo (FR-C01 à FR-C05)                     */
/* ------------------------------------------------------------------ */

/** Adresse de la photo ; le paramètre v change à chaque modification (cache navigateur sûr). */
const urlPhoto = (id: string, maj: Date) => `/modeles/${id}/photo?v=${maj.getTime().toString(36)}`;

async function lireModeles(ctx: Ctx, inclureInactifs: boolean): Promise<Modele[]> {
  const rows = await db()<
    { id: string; nom: string; categorie_id: string | null; prix_min: number | null; prix_max: number | null;
      duree_min: number | null; duree_max: number | null; actif: boolean; maj_le: Date }[]
  >`
    SELECT id, nom, categorie_id, prix_min, prix_max, duree_min, duree_max, actif, maj_le FROM modele
    WHERE salon_id = ${ctx.salonId} AND (actif OR ${inclureInactifs})
    ORDER BY actif DESC, ordre, cree_le`;
  return rows.map((r) => ({
    id: r.id,
    nom: r.nom,
    categorieId: r.categorie_id,
    photoUrl: urlPhoto(r.id, r.maj_le),
    prixMin: r.prix_min,
    prixMax: r.prix_max,
    dureeMin: r.duree_min,
    dureeMax: r.duree_max,
    actif: r.actif,
  }));
}

export async function listerModeles(ctx: Ctx): Promise<Modele[]> {
  autoriser(ctx, GERANTE);
  return lireModeles(ctx, true);
}

export interface SaisieModele {
  nom: string;
  categorieId: string | null;
  prixMin: number | null;
  prixMax: number | null;
  dureeMin: number | null;
  dureeMax: number | null;
  /** Photo encodée en base64 (avec ou sans préfixe data:) ; facultative en modification. */
  photo: string | null;
  actif?: boolean;
}

function decoderPhoto(b64: string): { octets: Buffer; type: string } | { erreur: string } {
  const brut = b64.replace(/^data:[^;]+;base64,/, "");
  if (!/^[A-Za-z0-9+/=\s]+$/.test(brut)) return { erreur: "Photo illisible." };
  const octets = Buffer.from(brut, "base64");
  if (octets.length < 1000) return { erreur: "Photo trop petite ou vide." };
  if (octets.length > PHOTO_TAILLE_MAX) return { erreur: "Photo trop lourde : réessayez, elle sera réduite automatiquement." };
  const type = typeImage(octets);
  if (!type) return { erreur: "Format non accepté : utilisez une photo JPEG, PNG ou WebP." };
  return { octets, type };
}

function verifierSaisieModele(s: SaisieModele): string | null {
  const n = s.nom.trim();
  if (n.length < 2 || n.length > 60) return "Le nom du modèle doit faire entre 2 et 60 caractères.";
  if (s.categorieId !== null && !estUuid(s.categorieId)) return "Type de service inconnu.";
  return verifierFourchettes(s);
}

/** FR-C02 : la gérante ajoute un modèle avec sa photo. */
export async function ajouterModele(ctx: Ctx, s: SaisieModele): Promise<R<string>> {
  autoriser(ctx, GERANTE);
  const erreur = verifierSaisieModele(s) ?? (s.photo ? null : "Ajoutez une photo du modèle.");
  if (erreur) return ko(erreur);
  const photo = decoderPhoto(s.photo!);
  if ("erreur" in photo) return ko(photo.erreur);
  return transaction(async (tx) => {
    await verifierCategorie(tx, ctx, s.categorieId);
    const [{ n }] = await tx<{ n: number }[]>`SELECT COALESCE(max(ordre), 0) + 1 AS n FROM modele WHERE salon_id = ${ctx.salonId}`;
    const [m] = await tx<{ id: string }[]>`
      INSERT INTO modele (salon_id, categorie_id, nom, photo, photo_type, prix_min, prix_max, duree_min, duree_max, ordre)
      VALUES (${ctx.salonId}, ${s.categorieId}, ${s.nom.trim()}, ${photo.octets}, ${photo.type},
              ${s.prixMin}, ${s.prixMax}, ${s.dureeMin}, ${s.dureeMax}, ${n})
      RETURNING id`;
    return m.id;
  });
}

/** FR-C03 : modifier, remplacer la photo, retirer du catalogue (sans effacer l'historique des demandes). */
export async function modifierModele(ctx: Ctx, id: string, s: SaisieModele): Promise<R> {
  autoriser(ctx, GERANTE);
  if (!estUuid(id)) return ko("Modèle inconnu.");
  const erreur = verifierSaisieModele(s);
  if (erreur) return ko(erreur);
  const photo = s.photo ? decoderPhoto(s.photo) : null;
  if (photo && "erreur" in photo) return ko(photo.erreur);
  return transaction(async (tx) => {
    await verifierCategorie(tx, ctx, s.categorieId);
    const r = await tx`
      UPDATE modele SET nom = ${s.nom.trim()}, categorie_id = ${s.categorieId}, prix_min = ${s.prixMin}, prix_max = ${s.prixMax},
             duree_min = ${s.dureeMin}, duree_max = ${s.dureeMax}, actif = ${s.actif !== false},
             photo = COALESCE(${photo ? photo.octets : null}::bytea, photo),
             photo_type = COALESCE(${photo ? photo.type : null}, photo_type), maj_le = now()
      WHERE id = ${id} AND salon_id = ${ctx.salonId} RETURNING id`;
    if (r.length === 0) throw new Refus("Modèle inconnu.");
    return undefined;
  });
}

/** FR-C04 : photo publique d'un modèle du catalogue (seulement s'il est proposé). */
export async function photoModele(id: string): Promise<{ octets: Buffer; type: string } | null> {
  if (!estUuid(id)) return null;
  const [r] = await db()<{ photo: Buffer; photo_type: string }[]>`SELECT photo, photo_type FROM modele WHERE id = ${id} AND actif`;
  return r ? { octets: r.photo, type: r.photo_type } : null;
}

/* ------------------------------------------------------------------ */
/* Avis des clientes : 1 à 5 étoiles par coiffeuse, après la prestation */
/* ------------------------------------------------------------------ */

/**
 * La cliente note une coiffeuse de sa prestation terminée. Elle s'identifie par sa référence de suivi
 * (secrète). Une seule note par coiffeuse et par prestation ; elle peut la corriger.
 */
export async function noterCoiffeuse(reference: string, coiffeuseId: string, note: number, commentaire: string): Promise<R> {
  if (!estReference(reference) || !estUuid(coiffeuseId)) return ko("Avis impossible.");
  const c = commentaire.trim();
  const erreur = verifierAvis(note, c);
  if (erreur) return ko(erreur);
  return transaction(async (tx) => {
    const [p] = await tx<{ id: string; salon_id: string; statut: Statut }[]>`
      SELECT id, salon_id, statut FROM prestation WHERE reference = ${reference}`;
    if (!p) throw new Refus("Rendez-vous introuvable.");
    if (p.statut !== "terminee") throw new Refus("Vous pourrez noter votre coiffeuse une fois la prestation terminée.");
    const a = await tx`SELECT 1 FROM affectation WHERE prestation_id = ${p.id} AND coiffeuse_id = ${coiffeuseId} AND a_fait`;
    if (a.length === 0) throw new Refus("Cette coiffeuse n'a pas fait votre prestation.");
    await tx`
      INSERT INTO avis (prestation_id, coiffeuse_id, salon_id, note, commentaire)
      VALUES (${p.id}, ${coiffeuseId}, ${p.salon_id}, ${note}, ${c || null})
      ON CONFLICT (prestation_id, coiffeuse_id) DO UPDATE SET note = EXCLUDED.note, commentaire = EXCLUDED.commentaire, maj_le = now()`;
    return undefined;
  });
}

/**
 * Référence de suivi d'une prestation terminée, créée à la demande pour les clientes venues au salon
 * (sans demande en ligne) : la secrétaire peut ainsi leur envoyer le lien pour donner leur avis.
 */
export async function referenceAvis(ctx: Ctx, prestationId: string): Promise<R<{ reference: string; clientNom: string; clientTel: string }>> {
  autoriser(ctx, PERSONNEL);
  if (!estUuid(prestationId)) return ko("Prestation inconnue.");
  return transaction(async (tx) => {
    const [p] = await tx<{ reference: string | null; client_nom: string; client_tel: string | null; statut: Statut }[]>`
      SELECT reference, client_nom, client_tel, statut FROM prestation WHERE id = ${prestationId} AND salon_id = ${ctx.salonId} FOR UPDATE`;
    if (!p) throw new Refus("Prestation inconnue.");
    if (p.statut !== "terminee") throw new Refus("Les avis se demandent une fois la prestation terminée.");
    if (!p.client_tel) throw new Refus("Cette cliente n'a pas de numéro WhatsApp enregistré.");
    if (p.reference) return { reference: p.reference, clientNom: p.client_nom, clientTel: p.client_tel };
    for (let essai = 0; essai < 5; essai++) {
      const reference = nouvelleReference((n) => randomBytes(n));
      const r = await tx<{ reference: string }[]>`
        UPDATE prestation SET reference = ${reference} WHERE id = ${prestationId}
        AND NOT EXISTS (SELECT 1 FROM prestation WHERE reference = ${reference}) RETURNING reference`;
      if (r.length) return { reference, clientNom: p.client_nom, clientTel: p.client_tel };
    }
    throw new Error("Impossible de générer une référence unique.");
  });
}

export interface AvisRecent {
  coiffeuse: string;
  note: number;
  commentaire: string | null;
  jour: Jour;
}

/** La gérante lit les derniers avis, commentaires compris (les commentaires ne sont jamais publics). */
export async function derniersAvis(ctx: Ctx, limite = 12): Promise<AvisRecent[]> {
  autoriser(ctx, GERANTE);
  const rows = await db()<{ nom: string; note: number; commentaire: string | null; jour: string }[]>`
    SELECT c.nom, v.note, v.commentaire, p.jour
    FROM avis v
    JOIN coiffeuse c ON c.id = v.coiffeuse_id
    JOIN prestation p ON p.id = v.prestation_id
    WHERE v.salon_id = ${ctx.salonId}
    ORDER BY v.maj_le DESC LIMIT ${Math.min(Math.max(limite, 1), 50)}`;
  return rows.map((r) => ({ coiffeuse: r.nom, note: r.note, commentaire: r.commentaire, jour: r.jour }));
}

/* ------------------------------------------------------------------ */
/* Vidéos courtes : montrent volume, couleur et qualité d'une coiffure   */
/* ------------------------------------------------------------------ */

async function lireVideos(ctx: Ctx, inclureInactives: boolean): Promise<Video[]> {
  const rows = await db()<{ id: string; titre: string; url: string; modele_id: string | null; actif: boolean }[]>`
    SELECT id, titre, url, modele_id, actif FROM video
    WHERE salon_id = ${ctx.salonId} AND (actif OR ${inclureInactives})
    ORDER BY actif DESC, cree_le DESC`;
  return rows.map((r) => ({ id: r.id, titre: r.titre, url: r.url, modeleId: r.modele_id, actif: r.actif }));
}

export async function listerVideos(ctx: Ctx): Promise<Video[]> {
  autoriser(ctx, GERANTE);
  return lireVideos(ctx, true);
}

async function verifierModeleDuSalon(tx: Tx, ctx: Ctx, modeleId: string | null) {
  if (modeleId === null) return;
  if (!estUuid(modeleId)) throw new Refus("Modèle inconnu.");
  const m = await tx`SELECT 1 FROM modele WHERE id = ${modeleId} AND salon_id = ${ctx.salonId}`;
  if (m.length === 0) throw new Refus("Modèle inconnu.");
}

export async function ajouterVideo(ctx: Ctx, s: { titre: string; url: string; modeleId: string | null }): Promise<R<string>> {
  autoriser(ctx, GERANTE);
  const erreur = verifierVideo(s.titre, s.url.trim());
  if (erreur) return ko(erreur);
  return transaction(async (tx) => {
    await verifierModeleDuSalon(tx, ctx, s.modeleId);
    const [v] = await tx<{ id: string }[]>`
      INSERT INTO video (salon_id, modele_id, titre, url) VALUES (${ctx.salonId}, ${s.modeleId}, ${s.titre.trim()}, ${s.url.trim()}) RETURNING id`;
    return v.id;
  });
}

export async function modifierVideo(ctx: Ctx, id: string, s: { titre: string; modeleId: string | null; actif: boolean }): Promise<R> {
  autoriser(ctx, GERANTE);
  if (!estUuid(id)) return ko("Vidéo inconnue.");
  const t = s.titre.trim();
  if (t.length < 2 || t.length > 60) return ko("Le titre de la vidéo doit faire entre 2 et 60 caractères.");
  return transaction(async (tx) => {
    await verifierModeleDuSalon(tx, ctx, s.modeleId);
    const r = await tx`UPDATE video SET titre = ${t}, modele_id = ${s.modeleId}, actif = ${s.actif} WHERE id = ${id} AND salon_id = ${ctx.salonId} RETURNING id`;
    if (r.length === 0) throw new Refus("Vidéo inconnue.");
    return undefined;
  });
}
