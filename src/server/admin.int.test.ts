// @vitest-environment node
/**
 * Espace MIA (opérateur) sur un vrai PostgreSQL : connexion, blocage, salons, logo, mots de passe.
 * Lancé seulement si DATABASE_URL_TEST est défini. La base de test est entièrement effacée.
 */
import { readFileSync } from "node:fs";
import postgres from "postgres";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { configAdmin, connecterAdmin, ESSAIS_MAX, fermerSessionAdmin, sessionAdminValide } from "./admin-core";
import { definirLogo, listerSalons, logoDuSalon, modifierSalon, reinitialiserMotDePasse, salonAdmin } from "./salon/admin-salons";
import { lireLogo } from "./salon/logo";
import { ouvrirSalon } from "./salon/ouverture";
import { verifyPassword } from "./password";

const URL_TEST = process.env.DATABASE_URL_TEST;
const suite = URL_TEST ? describe : describe.skip;

const ENV = { MIA_ADMIN_IDENTIFIANT: "Operateur", MIA_ADMIN_MOT_DE_PASSE: "un-mot-de-passe-long-12" };
const png = (taille = 400) => `data:image/png;base64,${Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(taille, 7)]).toString("base64")}`;

describe("configuration de l'opérateur", () => {
  it("est éteinte sans variables ou avec un mot de passe trop court", () => {
    expect(configAdmin({})).toBeNull();
    expect(configAdmin({ MIA_ADMIN_IDENTIFIANT: "moi", MIA_ADMIN_MOT_DE_PASSE: "court" })).toBeNull();
    expect(configAdmin(ENV)).toEqual({ identifiant: "operateur", motDePasse: "un-mot-de-passe-long-12" });
  });
});

describe("logo envoyé", () => {
  it("accepte un vrai format, refuse le reste", () => {
    expect(lireLogo(png())).toMatchObject({ type: "image/png" });
    expect(lireLogo("data:image/png;base64,AAAA")).toEqual({ erreur: "Logo trop petit ou vide." });
    expect(lireLogo(`data:image/png;base64,${Buffer.alloc(400, 1).toString("base64")}`)).toEqual({ erreur: "Format non accepté : utilisez un logo JPEG, PNG ou WebP." });
    expect(lireLogo(png(310_000))).toEqual({ erreur: "Logo trop lourd (300 Ko maximum après réduction)." });
    expect(lireLogo("<svg onload=alert(1)>")).toEqual({ erreur: "Logo illisible." });
    expect(lireLogo(42)).toEqual({ erreur: "Logo illisible ou trop lourd." });
  });
});

suite("espace MIA (PostgreSQL)", () => {
  let sql: postgres.Sql;
  const config = configAdmin(ENV);

  beforeAll(async () => {
    sql = postgres(URL_TEST!, { max: 2, onnotice: () => {} });
    await sql.unsafe("DROP SCHEMA public CASCADE; CREATE SCHEMA public;");
    for (const f of ["001_schema_initial.sql", "002_competences.sql", "003_demandes_en_ligne.sql", "004_modeles_photo.sql", "005_equipe_avis_videos.sql", "006_acompte.sql", "007_identite_salon.sql", "008_espace_mia.sql"]) {
      await sql.unsafe(readFileSync(new URL(`../../db/migrations/${f}`, import.meta.url), "utf8"));
    }
  });
  afterAll(async () => {
    await sql?.end();
  });
  beforeEach(async () => {
    await sql.unsafe("TRUNCATE session_admin, tentative_admin, salon CASCADE");
  });

  describe("connexion", () => {
    it("ouvre une session avec le bon couple, la garde valide, puis la ferme", async () => {
      const r = await connecterAdmin(sql, config, "OPERATEUR", ENV.MIA_ADMIN_MOT_DE_PASSE);
      if (!r.ok) throw new Error("connexion refusée");
      expect(await sessionAdminValide(sql, config, r.jeton)).toBe(true);
      // Seule l'empreinte est en base
      const lignes = await sql`SELECT jeton_hash FROM session_admin`;
      expect(lignes).toHaveLength(1);
      expect(lignes[0].jeton_hash).not.toBe(r.jeton);
      await fermerSessionAdmin(sql, r.jeton);
      expect(await sessionAdminValide(sql, config, r.jeton)).toBe(false);
    });

    it("refuse un mauvais mot de passe ou identifiant, et un jeton inventé", async () => {
      expect(await connecterAdmin(sql, config, "operateur", "mauvais-mot-de-passe")).toEqual({ ok: false, raison: "refuse" });
      expect(await connecterAdmin(sql, config, "autre", ENV.MIA_ADMIN_MOT_DE_PASSE)).toEqual({ ok: false, raison: "refuse" });
      expect(await sessionAdminValide(sql, config, "jeton-invente")).toBe(false);
      expect(await sessionAdminValide(sql, config, undefined)).toBe(false);
    });

    it("est éteinte sans configuration, même avec le « bon » mot de passe", async () => {
      expect(await connecterAdmin(sql, null, "operateur", ENV.MIA_ADMIN_MOT_DE_PASSE)).toEqual({ ok: false, raison: "eteint" });
      const r = await connecterAdmin(sql, config, "operateur", ENV.MIA_ADMIN_MOT_DE_PASSE);
      if (!r.ok) throw new Error("connexion refusée");
      expect(await sessionAdminValide(sql, null, r.jeton)).toBe(false);
    });

    it("bloque après trop d'échecs, même avec le bon mot de passe", async () => {
      for (let i = 0; i < ESSAIS_MAX; i++) await sql`INSERT INTO tentative_admin DEFAULT VALUES`;
      expect(await connecterAdmin(sql, config, "operateur", ENV.MIA_ADMIN_MOT_DE_PASSE)).toEqual({ ok: false, raison: "bloque" });
      await sql`UPDATE tentative_admin SET cree_le = now() - interval '20 minutes'`;
      expect((await connecterAdmin(sql, config, "operateur", ENV.MIA_ADMIN_MOT_DE_PASSE)).ok).toBe(true);
    });

    it("une session expirée ne marche plus", async () => {
      const r = await connecterAdmin(sql, config, "operateur", ENV.MIA_ADMIN_MOT_DE_PASSE);
      if (!r.ok) throw new Error("connexion refusée");
      await sql`UPDATE session_admin SET expire_le = now() - interval '1 minute'`;
      expect(await sessionAdminValide(sql, config, r.jeton)).toBe(false);
    });
  });

  describe("salons", () => {
    it("crée un salon avec logo, le liste et sert le logo", async () => {
      const logo = lireLogo(png());
      if ("erreur" in logo) throw new Error(logo.erreur);
      const r = await ouvrirSalon(sql, { nom: "Dany Coiffure", services: [{ nom: "Tresses", famille: "coiffure" }], logo });
      const l = await listerSalons(sql);
      expect(l).toHaveLength(1);
      expect(l[0]).toMatchObject({ slug: "dany-coiffure", aLogo: true, services: 1, coiffeuses: 0, demandes: 0 });
      const servi = await logoDuSalon(sql, "dany-coiffure");
      expect(servi?.type).toBe("image/png");
      expect(servi?.octets.length).toBe(logo.octets.length);
      expect(await logoDuSalon(sql, "inconnu")).toBeNull();
      expect(await logoDuSalon(sql, "../etc/passwd")).toBeNull();
      const d = await salonAdmin(sql, r.salonId);
      expect(d?.aLogo).toBe(true);
      expect(d?.logoV).toMatch(/^\d+$/);
      expect(d?.comptes.map((c) => c.identifiant)).toEqual(["gerante.dany-coiffure", "secretaire.dany-coiffure"]);
    });

    it("modifie l'identité, change puis retire le logo", async () => {
      const r = await ouvrirSalon(sql, { nom: "Salon Un" });
      expect((await listerSalons(sql))[0].aLogo).toBe(false);
      const ok = await modifierSalon(sql, r.salonId, { nom: "Salon Un Bis", whatsapp: "70 11 22 33", horaires: "Lun-Sam", theme: { marque: "#222222" }, textes: { titre: "Chez *Un*", accroche: "" } });
      expect(ok).toEqual({ ok: true });
      const d = await salonAdmin(sql, r.salonId);
      expect(d).toMatchObject({ nom: "Salon Un Bis", slug: "salon-un", whatsapp: "+226 70 11 22 33", horaires: "Lun-Sam", theme: { marque: "#222222" }, textes: { titre: "Chez *Un*" } });
      const logo = lireLogo(png());
      if ("erreur" in logo) throw new Error(logo.erreur);
      expect(await definirLogo(sql, r.salonId, logo)).toBe(true);
      expect((await salonAdmin(sql, r.salonId))?.aLogo).toBe(true);
      expect(await definirLogo(sql, r.salonId, null)).toBe(true);
      expect((await salonAdmin(sql, r.salonId))?.aLogo).toBe(false);
      expect(await logoDuSalon(sql, "salon-un")).toBeNull();
    });

    it("refuse les modifications invalides et les salons inconnus", async () => {
      const r = await ouvrirSalon(sql, { nom: "Salon Deux" });
      expect(await modifierSalon(sql, r.salonId, { nom: "X" })).toMatchObject({ ok: false, erreur: expect.stringContaining("entre 2 et 80") });
      expect(await modifierSalon(sql, r.salonId, { nom: "Salon Deux", theme: { marque: "#ffff00" } })).toMatchObject({ ok: false, erreur: expect.stringContaining("pas assez lisibles") });
      expect(await modifierSalon(sql, r.salonId, { nom: "Salon Deux", theme: { marque: "jaune" } })).toMatchObject({ ok: false, erreur: expect.stringContaining("#rrggbb") });
      expect(await modifierSalon(sql, r.salonId, { nom: "Salon Deux", carteUrl: "http://x.y" })).toMatchObject({ ok: false });
      expect(await modifierSalon(sql, r.salonId, { nom: "Salon Deux", textes: { titre: "x".repeat(81) } })).toMatchObject({ ok: false });
      expect(await modifierSalon(sql, "00000000-0000-0000-0000-000000000000", { nom: "Salon Deux" })).toEqual({ ok: false, erreur: "Salon introuvable." });
      expect(await salonAdmin(sql, "pas-un-uuid")).toBeNull();
      // Rien n'a bougé
      expect((await salonAdmin(sql, r.salonId))?.nom).toBe("Salon Deux");
    });

    it("réinitialise un mot de passe : l'ancien ne marche plus, les sessions sont fermées", async () => {
      const r = await ouvrirSalon(sql, { nom: "Salon Trois", motsDePasse: { gerante: "ancien-mot-de-passe", secretaire: "autre-mot-de-passe" } });
      const [u] = await sql`SELECT id FROM utilisateur WHERE identifiant = 'gerante.salon-trois'`;
      await sql`INSERT INTO session (jeton_hash, utilisateur_id, expire_le) VALUES ('abc', ${u.id}, now() + interval '1 day')`;
      const n = await reinitialiserMotDePasse(sql, r.salonId, "gerante");
      expect(n?.identifiant).toBe("gerante.salon-trois");
      expect(n?.motDePasse).toHaveLength(14);
      const [apres] = await sql`SELECT mot_de_passe_hash FROM utilisateur WHERE id = ${u.id}`;
      expect(await verifyPassword(n!.motDePasse, apres.mot_de_passe_hash)).toBe(true);
      expect(await verifyPassword("ancien-mot-de-passe", apres.mot_de_passe_hash)).toBe(false);
      expect(await sql`SELECT 1 FROM session WHERE utilisateur_id = ${u.id}`).toHaveLength(0);
      // La secrétaire n'est pas touchée
      const [sec] = await sql`SELECT mot_de_passe_hash FROM utilisateur WHERE identifiant = 'secretaire.salon-trois'`;
      expect(await verifyPassword("autre-mot-de-passe", sec.mot_de_passe_hash)).toBe(true);
      expect(await reinitialiserMotDePasse(sql, "00000000-0000-0000-0000-000000000000", "gerante")).toBeNull();
    });
  });
});
