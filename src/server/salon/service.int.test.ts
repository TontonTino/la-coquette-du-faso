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
    for (const f of ["001_schema_initial.sql", "002_competences.sql", "003_demandes_en_ligne.sql", "004_modeles_photo.sql"]) {
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
    await admin.unsafe("TRUNCATE salon, utilisateur, session, coiffeuse, absence, prestation, affectation, categorie, competence, modele CASCADE");
    const [sa] = await admin`INSERT INTO salon (nom, slug) VALUES ('Salon A', 'salon-a') RETURNING id`;
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

  /* ---------------- Phase B : demandes en ligne ---------------- */

  const demande = (over: Partial<import("./service").SaisieDemande> = {}): import("./service").SaisieDemande => ({
    clientNom: "Aminata Ouédraogo",
    clientTel: "70 11 22 33",
    categorieId: c.tresses,
    modeleId: null,
    jour: "2026-10-12", // lundi : Awa et Fatim sont en congé le lundi dans ce jeu de test
    moment: "matin",
    coiffeuseSouhaitee: null,
    remarque: "Photo envoyée sur WhatsApp",
    piege: "",
    ...over,
  });

  it("une cliente envoie une demande, la secrétaire la voit puis la confirme (FR-B02, FR-B04, FR-B05)", async () => {
    const d = await svc.creerDemande("salon-a", demande({ jour: "2026-10-13" }), NOW);
    if (!d.ok) throw new Error(d.erreur);
    expect(d.valeur.reference).toMatch(/^[A-Z2-9]{8}$/);

    let suivi = await svc.suiviDemande(d.valeur.reference);
    expect(suivi).toMatchObject({ statut: "demandee", prenom: "Aminata", categorie: "Tresses", heure: null });
    expect(JSON.stringify(suivi)).not.toContain("70 11 22 33"); // jamais de téléphone en public

    const enAttente = await svc.demandesEnAttente(secA);
    expect(enAttente.map((x) => x.reference)).toEqual([d.valeur.reference]);
    expect(enAttente[0]).toMatchObject({ clientTel: "+226 70 11 22 33", moment: "matin", categorie: "Tresses" });

    // Fatim ne fait pas les tresses : refusée
    const id = enAttente[0].id;
    expect(await svc.confirmerDemande(secA, id, { jour: "2026-10-13", heure: "09:00", dureeMin: 240, coiffeuseIds: [c.fatim] }, NOW)).toEqual({
      ok: false,
      erreur: "Fatim ne fait pas ce type de coiffure (Tresses).",
    });
    const conf = await svc.confirmerDemande(secA, id, { jour: "2026-10-13", heure: "09:00", dureeMin: 240, coiffeuseIds: [c.awa] }, NOW);
    expect(conf).toEqual({ ok: true, valeur: { reference: d.valeur.reference, clientNom: "Aminata Ouédraogo", clientTel: "+226 70 11 22 33", coiffeuses: ["Awa"] } });

    suivi = await svc.suiviDemande(d.valeur.reference);
    expect(suivi).toMatchObject({ statut: "prevue", heure: "09:00", coiffeuses: ["Awa"], jour: "2026-10-13" });
    expect(await svc.demandesEnAttente(secA)).toEqual([]);
    // Le créneau d'Awa est désormais pris (BR-001)
    expect((await svc.creerRendezVous(secA, rdv({ jour: "2026-10-13", heure: "10:00" }), NOW)).ok).toBe(false);
    // Une demande déjà confirmée ne peut pas l'être deux fois
    expect((await svc.confirmerDemande(secA, id, { jour: "2026-10-13", heure: "15:00", dureeMin: 60, coiffeuseIds: [c.awa] }, NOW)).ok).toBe(false);
  });

  it("refus avec motif visible par la cliente (FR-B06)", async () => {
    const d = await svc.creerDemande("salon-a", demande(), NOW);
    if (!d.ok) throw new Error(d.erreur);
    const [{ id }] = await svc.demandesEnAttente(secA);
    expect(await svc.refuserDemande(secA, id, "Complet ce jour-là")).toEqual({
      ok: true,
      valeur: { clientNom: "Aminata Ouédraogo", clientTel: "+226 70 11 22 33" },
    });
    expect(await svc.suiviDemande(d.valeur.reference)).toMatchObject({ statut: "refusee", motifRefus: "Complet ce jour-là" });
  });

  it("valide les demandes publiques et limite les abus (SEC-B01)", async () => {
    expect(await svc.creerDemande("salon-a", demande({ jour: "2026-10-09" }), NOW)).toEqual({ ok: false, erreur: "Cette date est déjà passée." });
    expect(await svc.creerDemande("salon-a", demande({ jour: "2027-03-01" }), NOW)).toMatchObject({ ok: false });
    expect(await svc.creerDemande("salon-a", demande({ clientTel: "" }), NOW)).toMatchObject({ ok: false, erreur: expect.stringMatching(/WhatsApp/) });
    expect(await svc.creerDemande("salon-a", demande({ piege: "http://spam" }), NOW)).toEqual({ ok: false, erreur: "Demande refusée." });
    expect(await svc.creerDemande("inconnu", demande(), NOW)).toEqual({ ok: false, erreur: "Salon introuvable." });
    // Coiffeuse souhaitée en congé ce jour-là (lundi) ou d'un autre salon
    expect(await svc.creerDemande("salon-a", demande({ coiffeuseSouhaitee: c.awa }), NOW)).toEqual({ ok: false, erreur: "Awa est en congé ce jour-là." });
    expect(await svc.creerDemande("salon-a", demande({ coiffeuseSouhaitee: c.zoe }), NOW)).toEqual({ ok: false, erreur: "Coiffeuse inconnue." });
    expect(await svc.creerDemande("salon-a", demande({ categorieId: c.tressesB }), NOW)).toEqual({ ok: false, erreur: "Type de coiffure inconnu." });
    // 3 demandes en attente maximum par numéro
    for (let i = 0; i < 3; i++) expect((await svc.creerDemande("salon-a", demande(), NOW)).ok).toBe(true);
    expect(await svc.creerDemande("salon-a", demande(), NOW)).toMatchObject({ ok: false, erreur: expect.stringMatching(/déjà 3 demandes/) });
    // Le salon B ne voit pas les demandes du salon A
    expect(await svc.demandesEnAttente(B)).toEqual([]);
    expect(await svc.suiviDemande("pas-une-ref")).toBeNull();
    expect(await svc.suiviDemande("AAAAAAAA")).toBeNull();
  });

  it("page publique : types et coiffeuses actives, sans données de clientes", async () => {
    const pub = await svc.salonPublic("salon-a");
    expect(pub?.categories.map((x) => x.nom)).toEqual(["Tissage", "Tresses"]);
    expect(pub?.coiffeuses.map((x) => x.nom)).toEqual(["Awa", "Clarisse", "Fatim"]);
    expect(await svc.salonPublic("inconnu")).toBeNull();
    expect(await svc.modifierWhatsappSalon(secA, "70 00 00 00").catch((e) => e.message)).toMatch(/non autorisée/);
    expect(await svc.modifierWhatsappSalon(A, "70 00 00 00")).toEqual({ ok: true, valeur: undefined });
    expect((await svc.salonPublic("salon-a"))?.whatsapp).toBe("+226 70 00 00 00");
  });

  /* ---------------- Catalogue de modèles en photo ---------------- */

  // Faux JPEG : bons premiers octets, taille réaliste (le serveur vérifie le format et la taille).
  const jpeg = "data:image/jpeg;base64," + Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(4000, 7)]).toString("base64");
  const modele = (over: Partial<import("./service").SaisieModele> = {}): import("./service").SaisieModele => ({
    nom: "Nattes et vanilles",
    categorieId: c.tresses,
    prixMin: 5000,
    prixMax: 12000,
    dureeMin: 150,
    dureeMax: 240,
    photo: jpeg,
    ...over,
  });

  it("la gérante ajoute un modèle photo ; il apparaît sur la page publique (FR-C01, FR-C02, FR-C04)", async () => {
    await expect(svc.ajouterModele(secA, modele())).rejects.toThrow(/non autorisée/);
    const m = await svc.ajouterModele(A, modele());
    if (!m.ok) throw new Error(m.erreur);
    const pub = await svc.salonPublic("salon-a");
    expect(pub?.modeles).toHaveLength(1);
    expect(pub?.modeles[0]).toMatchObject({ nom: "Nattes et vanilles", prixMin: 5000, dureeMin: 150, categorieId: c.tresses });
    expect(pub?.modeles[0].photoUrl).toMatch(new RegExp(`^/modeles/${m.valeur}/photo\\?v=`));
    const photo = await svc.photoModele(m.valeur);
    expect(photo?.type).toBe("image/jpeg");
    expect(photo?.octets.length).toBe(4004);
  });

  it("refuse les photos invalides et les fourchettes incohérentes", async () => {
    const svg = "data:image/svg+xml;base64," + Buffer.from("<svg onload=alert(1)>" + "x".repeat(2000)).toString("base64");
    expect(await svc.ajouterModele(A, modele({ photo: svg }))).toMatchObject({ ok: false, erreur: expect.stringMatching(/Format non accepté/) });
    expect(await svc.ajouterModele(A, modele({ photo: null }))).toEqual({ ok: false, erreur: "Ajoutez une photo du modèle." });
    const lourde = "data:image/jpeg;base64," + Buffer.concat([Buffer.from([0xff, 0xd8, 0xff]), Buffer.alloc(900_000)]).toString("base64");
    expect(await svc.ajouterModele(A, modele({ photo: lourde }))).toMatchObject({ ok: false, erreur: expect.stringMatching(/trop lourde/) });
    expect(await svc.ajouterModele(A, modele({ prixMin: 9000, prixMax: 3000 }))).toMatchObject({ ok: false });
    expect(await svc.ajouterModele(A, modele({ categorieId: c.tressesB }))).toEqual({ ok: false, erreur: "Type de coiffure inconnu." });
  });

  it("une demande sur photo reprend le type et la durée du modèle (FR-C05)", async () => {
    const m = await svc.ajouterModele(A, modele());
    if (!m.ok) throw new Error(m.erreur);
    const d = await svc.creerDemande("salon-a", demande({ categorieId: null, modeleId: m.valeur, jour: "2026-10-13" }), NOW);
    if (!d.ok) throw new Error(d.erreur);
    const [att] = await svc.demandesEnAttente(secA);
    expect(att).toMatchObject({ categorieId: c.tresses, categorie: "Tresses", dureeMin: 150, modele: { nom: "Nattes et vanilles" } });
    expect((await svc.suiviDemande(d.valeur.reference))?.modele?.nom).toBe("Nattes et vanilles");
    // Un modèle d'un autre salon ou retiré du catalogue est refusé
    const mb = await svc.ajouterModele(B, modele({ categorieId: c.tressesB }));
    if (!mb.ok) throw new Error(mb.erreur);
    expect(await svc.creerDemande("salon-a", demande({ modeleId: mb.valeur, clientTel: "70 99 99 99" }), NOW)).toEqual({ ok: false, erreur: "Ce modèle n'est plus proposé." });
    await svc.modifierModele(A, m.valeur, modele({ photo: null, actif: false }));
    expect((await svc.salonPublic("salon-a"))?.modeles).toEqual([]);
    expect(await svc.photoModele(m.valeur)).toBeNull();
    expect((await svc.listerModeles(A)).map((x) => x.actif)).toEqual([false]);
    expect(await svc.creerDemande("salon-a", demande({ modeleId: m.valeur, clientTel: "70 88 88 88" }), NOW)).toEqual({ ok: false, erreur: "Ce modèle n'est plus proposé." });
  });
});
