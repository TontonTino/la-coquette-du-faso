// @vitest-environment node
/**
 * Tests d'intégration sur un vrai PostgreSQL (exigences FR-006 à FR-013, SEC-002, BR-001 à BR-003).
 * Lancés seulement si DATABASE_URL_TEST est défini, par exemple :
 *   DATABASE_URL_TEST=postgres://postgres@127.0.0.1:5432/mia_test npm test
 * ATTENTION : la base de test est entièrement effacée à chaque lancement.
 */
import { readFileSync } from "node:fs";
import postgres from "postgres";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

const URL_TEST = process.env.DATABASE_URL_TEST;
const suite = URL_TEST ? describe : describe.skip;

// Samedi 10 octobre 2026, 11:00 (Ouagadougou = UTC).
const NOW = new Date("2026-10-10T11:00:00Z");
const JOUR = "2026-10-10";

suite("service salon (PostgreSQL)", () => {
  let admin: postgres.Sql;
  let svc: typeof import("./service");
  let A: import("./service").Ctx;
  let B: import("./service").Ctx;
  let secA: import("./service").Ctx;
  const c: Record<string, string> = {};

  beforeAll(async () => {
    process.env.DATABASE_URL = URL_TEST;
    admin = postgres(URL_TEST!, { max: 1, onnotice: () => {} });
    await admin.unsafe("DROP SCHEMA public CASCADE; CREATE SCHEMA public;");
    for (const f of ["001_schema_initial.sql", "002_competences.sql"]) {
      await admin.unsafe(readFileSync(new URL(`../../../db/migrations/${f}`, import.meta.url), "utf8"));
    }
    svc = await import("./service");
  });

  afterAll(async () => {
    const { __fermerDbPourTests } = await import("@/server/db");
    await __fermerDbPourTests();
    await admin?.end();
  });

  beforeEach(async () => {
    await admin.unsafe("TRUNCATE salon, utilisateur, session, coiffeuse, absence, prestation, affectation, categorie, competence CASCADE");
    const [sa] = await admin`INSERT INTO salon (nom) VALUES ('Salon A') RETURNING id`;
    const [sb] = await admin`INSERT INTO salon (nom) VALUES ('Salon B') RETURNING id`;
    const [ga] = await admin`INSERT INTO utilisateur (salon_id, identifiant, nom, role, mot_de_passe_hash) VALUES (${sa.id}, 'gerante-a', 'Gérante A', 'gerante', 'x') RETURNING id`;
    const [se] = await admin`INSERT INTO utilisateur (salon_id, identifiant, nom, role, mot_de_passe_hash) VALUES (${sa.id}, 'secretaire-a', 'Secrétaire A', 'secretaire', 'x') RETURNING id`;
    const [gb] = await admin`INSERT INTO utilisateur (salon_id, identifiant, nom, role, mot_de_passe_hash) VALUES (${sb.id}, 'gerante-b', 'Gérante B', 'gerante', 'x') RETURNING id`;
    A = { salonId: sa.id, utilisateurId: ga.id, role: "gerante" };
    secA = { salonId: sa.id, utilisateurId: se.id, role: "secretaire" };
    B = { salonId: sb.id, utilisateurId: gb.id, role: "gerante" };
    for (const [cle, nom, conges, salon] of [
      ["awa", "Awa", [1], sa.id],
      ["fatim", "Fatim", [1], sa.id],
      ["clarisse", "Clarisse", [6], sa.id], // en congé le samedi
      ["zoe", "Zoé (salon B)", [], sb.id],
    ] as const) {
      const [row] = await admin`INSERT INTO coiffeuse (salon_id, nom, jours_conge) VALUES (${salon}, ${nom}, ${[...conges]}) RETURNING id`;
      c[cle] = row.id;
    }
    const [tresses] = await admin`INSERT INTO categorie (salon_id, nom) VALUES (${sa.id}, 'Tresses') RETURNING id`;
    const [tissage] = await admin`INSERT INTO categorie (salon_id, nom) VALUES (${sa.id}, 'Tissage') RETURNING id`;
    const [tressesB] = await admin`INSERT INTO categorie (salon_id, nom) VALUES (${sb.id}, 'Tresses') RETURNING id`;
    c.tresses = tresses.id;
    c.tissage = tissage.id;
    c.tressesB = tressesB.id;
    // Awa fait tresses et tissage ; Fatim seulement le tissage.
    await admin`INSERT INTO competence (coiffeuse_id, categorie_id, salon_id) VALUES
      (${c.awa}, ${tresses.id}, ${sa.id}), (${c.awa}, ${tissage.id}, ${sa.id}), (${c.fatim}, ${tissage.id}, ${sa.id})`;
  });

  const rdv = (over: Partial<import("./service").SaisieRendezVous> = {}) => ({
    clientNom: "Nadège",
    clientTel: "70 12 34 56",
    jour: JOUR,
    heure: "14:00",
    dureeMin: 180,
    coiffeuseIds: [c.awa],
    modele: "",
    categorieId: null,
    ...over,
  });

  it("enregistre un rendez-vous et refuse un chevauchement sur la même coiffeuse (FR-006, FR-007)", async () => {
    expect((await svc.creerRendezVous(secA, rdv(), NOW)).ok).toBe(true);
    const doublon = await svc.creerRendezVous(secA, rdv({ heure: "15:00", clientNom: "Prisca" }), NOW);
    expect(doublon).toEqual({ ok: false, erreur: expect.stringMatching(/vient d'être prise/) });
    // bout à bout : 17:00 commence quand la première finit
    expect((await svc.creerRendezVous(secA, rdv({ heure: "17:00", clientNom: "Inès" }), NOW)).ok).toBe(true);
    // autre coiffeuse au même horaire
    expect((await svc.creerRendezVous(secA, rdv({ coiffeuseIds: [c.fatim] }), NOW)).ok).toBe(true);
  });

  it("deux enregistrements simultanés sur le même créneau : un seul réussit (BR-001)", async () => {
    const res = await Promise.all(
      Array.from({ length: 5 }, (_, i) => svc.creerRendezVous(secA, rdv({ clientNom: `Cliente ${i}` }), NOW)),
    );
    expect(res.filter((r) => r.ok)).toHaveLength(1);
    const [{ n }] = await admin`SELECT count(*)::int AS n FROM affectation WHERE coiffeuse_id = ${c.awa} AND active`;
    expect(n).toBe(1);
  });

  it("refuse une coiffeuse en congé ou absente, et compte les rendez-vous à réattribuer (BR-003, FR-003)", async () => {
    const conge = await svc.creerRendezVous(secA, rdv({ coiffeuseIds: [c.clarisse] }), NOW);
    expect(conge).toEqual({ ok: false, erreur: "Clarisse est en congé ce jour-là." });
    await svc.creerRendezVous(secA, rdv(), NOW);
    const abs = await svc.basculerAbsence(secA, c.awa, JOUR);
    expect(abs).toEqual({ ok: true, valeur: { absente: true, aReattribuer: 1 } });
    const refus = await svc.creerRendezVous(secA, rdv({ heure: "09:00", jour: "2026-10-10", clientNom: "Rokia" }), new Date("2026-10-10T08:00:00Z"));
    expect(refus).toEqual({ ok: false, erreur: "Awa est absente ce jour-là." });
    const j = await svc.journee(secA, JOUR, NOW);
    expect(j.aVenir[0].aReattribuer).toEqual(["Awa"]);
    expect(await svc.basculerAbsence(secA, c.awa, JOUR)).toEqual({ ok: true, valeur: { absente: false, aReattribuer: 0 } });
  });

  it("ne propose et n'accepte que les coiffeuses compétentes (BR-009, FR-015, FR-016)", async () => {
    const libres = await svc.coiffeusesLibres(secA, { jour: JOUR, heure: "14:00", dureeMin: 60, ignorer: null, categorieId: c.tresses }, NOW);
    expect(libres.ok && libres.valeur.map((x) => x.nom)).toEqual(["Awa"]);
    const refus = await svc.creerRendezVous(secA, rdv({ coiffeuseIds: [c.fatim], categorieId: c.tresses }), NOW);
    expect(refus).toEqual({ ok: false, erreur: "Fatim ne fait pas ce type de coiffure (Tresses)." });
    expect((await svc.creerRendezVous(secA, rdv({ coiffeuseIds: [c.fatim], categorieId: c.tissage }), NOW)).ok).toBe(true);
    // Type d'un autre salon refusé
    expect(await svc.creerRendezVous(secA, rdv({ heure: "18:00", categorieId: c.tressesB }), NOW)).toEqual({ ok: false, erreur: "Type de coiffure inconnu." });
    // Le démarrage respecte le type demandé à l'arrivée
    const w = await svc.ajouterSansRendezVous(secA, { clientNom: "Prisca", clientTel: "", modele: "", categorieId: c.tresses }, NOW);
    if (!w.ok) throw new Error(w.erreur);
    expect(await svc.demarrer(secA, w.valeur, { dureeMin: 60, coiffeuseIds: [c.fatim] }, NOW)).toEqual({
      ok: false,
      erreur: "Fatim ne fait pas ce type de coiffure (Tresses).",
    });
    // La gérante met à jour les spécialités
    await svc.modifierCoiffeuse(A, c.fatim, { nom: "Fatim", joursConge: [1], actif: true, categorieIds: [c.tresses, c.tissage] });
    expect((await svc.demarrer(secA, w.valeur, { dureeMin: 60, coiffeuseIds: [c.fatim] }, NOW)).ok).toBe(true);
    expect(await svc.ajouterCategorie(A, "Tresses")).toEqual({ ok: false, erreur: "Ce type de coiffure existe déjà." });
    const equipe = await svc.listerEquipe(A);
    expect(equipe.categories.map((x) => x.nom)).toEqual(["Tissage", "Tresses"]);
  });

  it("réattribue un rendez-vous à une autre coiffeuse (FR-012)", async () => {
    const r = await svc.creerRendezVous(secA, rdv(), NOW);
    if (!r.ok) throw new Error(r.erreur);
    const m = await svc.modifierRendezVous(secA, r.valeur, rdv({ coiffeuseIds: [c.fatim] }), NOW);
    expect(m.ok).toBe(true);
    const libres = await svc.coiffeusesLibres(secA, { jour: JOUR, heure: "14:00", dureeMin: 180, ignorer: null, categorieId: null }, NOW);
    expect(libres.ok && libres.valeur.map((x) => x.nom)).toEqual(["Awa"]);
  });

  it("parcours sans rendez-vous : file, démarrage, fin, bilan (FR-008, FR-010, FR-011, FR-013)", async () => {
    const w = await svc.ajouterSansRendezVous(secA, { clientNom: "Odile", clientTel: "", modele: "Nattes", categorieId: null }, NOW);
    if (!w.ok) throw new Error(w.erreur);
    let j = await svc.journee(secA, JOUR, NOW);
    expect(j.attente.map((p) => p.clientNom)).toEqual(["Odile"]);

    expect((await svc.terminer(secA, w.valeur, { prix: 5000, paiement: "especes" }, NOW)).ok).toBe(false); // pas encore démarrée
    expect((await svc.demarrer(secA, w.valeur, { dureeMin: 120, coiffeuseIds: [c.awa, c.fatim] }, NOW)).ok).toBe(true);
    j = await svc.journee(secA, JOUR, NOW);
    expect(j.enCours[0].heureFin).toBe("13:00");
    expect(j.compteurs.occupees).toBe(2);

    const libresAvant = await svc.coiffeusesLibres(secA, { jour: JOUR, heure: null, dureeMin: 60, ignorer: null, categorieId: null }, new Date("2026-10-10T12:00:00Z"));
    expect(libresAvant.ok && libresAvant.valeur).toEqual([]);
    expect((await svc.terminer(secA, w.valeur, { prix: 12000, paiement: "mobile_money" }, new Date("2026-10-10T12:00:00Z"))).ok).toBe(true);
    const libresApres = await svc.coiffeusesLibres(secA, { jour: JOUR, heure: null, dureeMin: 60, ignorer: null, categorieId: null }, new Date("2026-10-10T12:00:00Z"));
    expect(libresApres.ok && libresApres.valeur.map((x) => x.nom)).toEqual(["Awa", "Fatim"]);

    const b = await svc.bilan(A, JOUR);
    expect(b).toMatchObject({ total: 12000, mobileMoney: 12000, especes: 0, terminees: 1 });
    expect(b.plusDemandees.noms).toEqual(["Awa", "Fatim"]);
    expect(b.absences).toEqual([{ nom: "Clarisse", motif: "conge" }]);
  });

  it("annulation, absence de la cliente et départ libèrent le créneau (FR-012)", async () => {
    const r = await svc.creerRendezVous(secA, rdv(), NOW);
    if (!r.ok) throw new Error(r.erreur);
    expect((await svc.annuler(secA, r.valeur)).ok).toBe(true);
    expect((await svc.annuler(secA, r.valeur)).ok).toBe(false); // déjà annulé
    const r2 = await svc.creerRendezVous(secA, rdv(), NOW);
    expect(r2.ok).toBe(true);
    if (!r2.ok) return;
    expect((await svc.marquerAbsente(secA, r2.valeur)).ok).toBe(true);
    expect((await svc.creerRendezVous(secA, rdv({ clientNom: "Grâce" }), NOW)).ok).toBe(true);
  });

  it("isole les salons : B ne voit ni ne modifie les données de A (SEC-002, multi-salons)", async () => {
    const r = await svc.creerRendezVous(A, rdv(), NOW);
    if (!r.ok) throw new Error(r.erreur);
    expect((await svc.journee(B, JOUR, NOW)).aVenir).toEqual([]);
    expect(await svc.annuler(B, r.valeur)).toEqual({ ok: false, erreur: "Cette prestation n'existe pas." });
    expect(await svc.creerRendezVous(B, rdv({ coiffeuseIds: [c.awa] }), NOW)).toEqual({ ok: false, erreur: "Coiffeuse inconnue." });
    expect((await svc.basculerAbsence(B, c.awa, JOUR)).ok).toBe(false);
    const libresB = await svc.coiffeusesLibres(B, { jour: JOUR, heure: "14:00", dureeMin: 60, ignorer: null, categorieId: null }, NOW);
    expect(libresB.ok && libresB.valeur.map((x) => x.nom)).toEqual(["Zoé (salon B)"]);
    // La base elle-même refuse d'affecter une coiffeuse de A à une prestation de B.
    const [pb] = await admin`INSERT INTO prestation (salon_id, origine, statut, client_nom, jour, duree_min, arrivee)
                             VALUES (${B.salonId}, 'sans_rendez_vous', 'en_attente', 'Test', ${JOUR}, 60, now()) RETURNING id`;
    await expect(
      admin`INSERT INTO affectation (prestation_id, coiffeuse_id, salon_id, plage)
            VALUES (${pb.id}, ${c.awa}, ${B.salonId}, tstzrange(now(), now() + interval '1 hour', '[)'))`,
    ).rejects.toThrow(/foreign key/);
  });

  it("réserve le bilan et l'équipe à la gérante (SEC-002)", async () => {
    await expect(svc.bilan(secA, JOUR)).rejects.toThrow(/non autorisée/);
    await expect(svc.ajouterCoiffeuse(secA, { nom: "Nouvelle", joursConge: [], categorieIds: [] })).rejects.toThrow(/non autorisée/);
    const ajout = await svc.ajouterCoiffeuse(A, { nom: "Nouvelle", joursConge: [0, 3], categorieIds: [c.tresses] });
    expect(ajout.ok).toBe(true);
    expect((await svc.listerEquipe(A)).coiffeuses.map((x) => x.nom)).toContain("Nouvelle");
  });

  it("refuse les saisies invalides avant d'écrire", async () => {
    expect(await svc.creerRendezVous(secA, rdv({ clientTel: "123" }), NOW)).toEqual({ ok: false, erreur: expect.stringMatching(/8 chiffres/) });
    expect(await svc.creerRendezVous(secA, rdv({ heure: "08:00" }), NOW)).toEqual({ ok: false, erreur: "Cette heure est déjà passée." });
    expect(await svc.creerRendezVous(secA, rdv({ coiffeuseIds: ["pas-un-uuid"] }), NOW)).toEqual({ ok: false, erreur: "Coiffeuse inconnue." });
    expect(await svc.demarrer(secA, "pas-un-uuid", { dureeMin: 60, coiffeuseIds: [c.awa] }, NOW)).toEqual({ ok: false, erreur: "Cette prestation n'existe pas." });
  });
});
