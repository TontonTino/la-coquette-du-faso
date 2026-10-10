import { describe, expect, it } from "vitest";
import {
  saitFaire,
  estIndisponible,
  peut,
  statutApresAnnulation,
  verifierChoixCoiffeuses,
  verifierDuree,
  verifierNom,
  verifierPrix,
  verifierTelephone,
} from "./regles";
import type { Coiffeuse, Prestation } from "./types";
import { construireBilan, construireJournee, heureDe } from "./vue";

// Samedi 10 octobre 2026 (weekday 6), 11:00 à Ouagadougou.
const JOUR = "2026-10-10";
const NOW = new Date("2026-10-10T11:00:00Z");

const c = (id: string, nom: string, joursConge: number[] = []): Coiffeuse => ({ id, nom, joursConge, actif: true, categorieIds: [] });
const p = (over: Partial<Prestation> & Pick<Prestation, "id" | "statut">): Prestation => ({
  origine: "rendez_vous",
  clientNom: `Cliente ${over.id}`,
  clientTel: null,
  modele: null,
  categorieId: null,
  jour: JOUR,
  debut: null,
  dureeMin: 120,
  arrivee: null,
  prixPaye: null,
  paiement: null,
  coiffeuseIds: [],
  ...over,
});

describe("règles de saisie", () => {
  it("valide le nom", () => {
    expect(verifierNom(" A ")).toMatch(/2 lettres/);
    expect(verifierNom("Awa")).toBeNull();
  });

  it("normalise le téléphone burkinabè (+226 facultatif)", () => {
    expect(verifierTelephone("70123456", true).tel).toBe("+226 70 12 34 56");
    expect(verifierTelephone("+226 70 12 34 56", true).tel).toBe("+226 70 12 34 56");
    expect(verifierTelephone("7012", true).erreur).toMatch(/8 chiffres/);
    expect(verifierTelephone("", true).erreur).toMatch(/numéro/);
    expect(verifierTelephone("", false)).toEqual({ tel: null, erreur: null });
  });

  it("borne la durée entre 30 min et 12 h par pas de 15 min (BR-005)", () => {
    expect(verifierDuree(15)).not.toBeNull();
    expect(verifierDuree(30)).toBeNull();
    expect(verifierDuree(600)).toBeNull();
    expect(verifierDuree(725)).not.toBeNull();
    expect(verifierDuree(100)).not.toBeNull();
  });

  it("limite à 2 coiffeuses distinctes (BR-002)", () => {
    expect(verifierChoixCoiffeuses([], false)).toBeNull();
    expect(verifierChoixCoiffeuses([], true)).toMatch(/au moins/);
    expect(verifierChoixCoiffeuses(["a", "b", "c"], true)).toMatch(/maximum/);
    expect(verifierChoixCoiffeuses(["a", "a"], true)).toMatch(/deux fois/);
  });

  it("refuse un prix négatif ou décimal", () => {
    expect(verifierPrix(15000)).toBeNull();
    expect(verifierPrix(-1)).not.toBeNull();
    expect(verifierPrix(12.5)).not.toBeNull();
  });
});

describe("disponibilité et cycle de vie", () => {
  it("congé habituel, absence imprévue, coiffeuse désactivée (BR-003)", () => {
    expect(estIndisponible(c("a", "A", [6]), JOUR, [])).toBe("conge");
    expect(estIndisponible(c("a", "A"), JOUR, ["a"])).toBe("absente");
    expect(estIndisponible({ ...c("a", "A"), actif: false }, JOUR, [])).toBe("inactive");
    expect(estIndisponible(c("a", "A", [1]), JOUR, [])).toBeNull();
  });

  it("ne retient que les coiffeuses compétentes pour le type demandé (BR-009)", () => {
    const tresseuse = { categorieIds: ["tresses"] };
    expect(saitFaire(tresseuse, "tresses")).toBe(true);
    expect(saitFaire(tresseuse, "tissage")).toBe(false);
    expect(saitFaire(tresseuse, null)).toBe(true);
  });

  it("n'autorise que les transitions prévues", () => {
    expect(peut("prevue", "arrivee")).toBe(true);
    expect(peut("en_attente", "demarrer")).toBe(true);
    expect(peut("en_cours", "terminer")).toBe(true);
    expect(peut("en_cours", "annuler")).toBe(false);
    expect(peut("terminee", "annuler")).toBe(false);
    expect(statutApresAnnulation("en_attente")).toBe("partie");
    expect(statutApresAnnulation("prevue")).toBe("annulee");
  });
});

describe("planning du jour", () => {
  const coiffeuses = [c("awa", "Awa K."), c("fatim", "Fatim O."), c("kadi", "Kadi Y."), c("clarisse", "Clarisse H.", [6])];
  const prestations = [
    p({ id: "1", statut: "en_cours", debut: "2026-10-10T09:00:00Z", dureeMin: 300, coiffeuseIds: ["awa"] }),
    p({ id: "2", statut: "en_attente", origine: "sans_rendez_vous", arrivee: "2026-10-10T10:40:00Z" }),
    p({ id: "3", statut: "en_attente", origine: "sans_rendez_vous", arrivee: "2026-10-10T10:20:00Z" }),
    p({ id: "4", statut: "prevue", debut: "2026-10-10T14:00:00Z", coiffeuseIds: ["fatim"] }),
    p({ id: "5", statut: "prevue", debut: "2026-10-10T15:00:00Z", coiffeuseIds: ["kadi"] }),
    p({ id: "6", statut: "prevue", debut: "2026-10-11T09:00:00Z", jour: "2026-10-11", coiffeuseIds: ["fatim"] }),
  ];
  const j = construireJournee({ coiffeuses, prestations, absences: ["kadi"], jour: JOUR, now: NOW });

  it("classe la file d'attente par heure d'arrivée (BR-004)", () => {
    expect(j.attente.map((x) => x.id)).toEqual(["3", "2"]);
    expect(j.attente[0].attenteMin).toBe(40);
  });

  it("donne l'état de chaque coiffeuse", () => {
    const etat = Object.fromEntries(j.coiffeuses.map((l) => [l.id, l.etat]));
    expect(etat).toEqual({ awa: "occupee", fatim: "libre", kadi: "absente", clarisse: "conge" });
    expect(j.coiffeuses.find((l) => l.id === "awa")?.jusqua).toBe("14:00");
    expect(j.coiffeuses.find((l) => l.id === "fatim")?.prochain).toEqual({ heure: "14:00", client: "Cliente 4" });
    expect(j.compteurs).toEqual({ libres: 1, occupees: 1, absentes: 2, total: 4 });
  });

  it("signale un rendez-vous dont la coiffeuse est absente (FR-003)", () => {
    expect(j.aVenir.map((x) => x.id)).toEqual(["4", "5"]);
    expect(j.aVenir[1].aReattribuer).toEqual(["Kadi Y."]);
    expect(j.aVenir[0].aReattribuer).toEqual([]);
  });

  it("formate les heures en heure de Ouagadougou", () => {
    expect(heureDe("2026-10-10T09:05:00Z")).toBe("09:05");
  });
});

describe("bilan du soir (FR-013)", () => {
  it("additionne les encaissements par moyen de paiement et trouve la plus demandée", () => {
    const coiffeuses = [c("awa", "Awa K."), c("fatim", "Fatim O."), c("clarisse", "Clarisse H.", [6])];
    const b = construireBilan({
      coiffeuses,
      absences: [],
      jour: JOUR,
      prestations: [
        p({ id: "1", statut: "terminee", prixPaye: 15000, paiement: "mobile_money", coiffeuseIds: ["awa", "fatim"] }),
        p({ id: "2", statut: "terminee", prixPaye: 5000, paiement: "especes", coiffeuseIds: ["awa"] }),
        p({ id: "3", statut: "en_cours", coiffeuseIds: ["fatim"] }),
        p({ id: "4", statut: "annulee", coiffeuseIds: ["fatim"] }),
        p({ id: "5", statut: "terminee", prixPaye: 9000, paiement: "especes", jour: "2026-10-09" }),
      ],
    });
    expect(b.total).toBe(20000);
    expect(b.especes).toBe(5000);
    expect(b.mobileMoney).toBe(15000);
    expect(b.terminees).toBe(2);
    expect(b.enCours).toBe(1);
    expect(b.plusDemandees).toEqual({ noms: ["Awa K."], nombre: 2 });
    expect(b.absences).toEqual([{ nom: "Clarisse H.", motif: "conge" }]);
  });
});

describe("messages WhatsApp", async () => {
  const { lienWhatsApp, messageConfirmation } = await import("./whatsapp");
  it("construit un lien wa.me avec l'indicatif 226", () => {
    expect(lienWhatsApp("+226 70 12 34 56", "Bonjour")).toBe("https://wa.me/22670123456?text=Bonjour");
    expect(lienWhatsApp("123")).toBeNull();
  });
  it("n'ajoute pas de double point après un nom abrégé", () => {
    const m = messageConfirmation({ clientNom: "Awa T.", salonNom: "Salon", jour: "2026-10-11", heure: "10:00", coiffeuses: ["Alima D."], lienSuivi: "x" });
    expect(m).toContain("avec Alima D.\n");
    expect(m).not.toContain("..");
    expect(m).toMatch(/^Bonjour Awa,/);
  });
});
