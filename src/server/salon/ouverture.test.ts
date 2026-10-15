import { describe, expect, it } from "vitest";
import { lireServices, motDePasseAleatoire, numeroBurkina, slugDepuisNom } from "../../../scripts/lib/ouverture.mts";
import { lireTextesVitrine, vitrineDuSalon } from "@/lib/salon/vitrine";

describe("ouverture d'un salon : outils", () => {
  it("fabrique un identifiant lisible à partir du nom", () => {
    expect(slugDepuisNom("Black Roots Salon")).toBe("black-roots-salon");
    expect(slugDepuisNom("  L'Orchidée — Ouaga 2000 ")).toBe("l-orchidee-ouaga-2000");
    expect(slugDepuisNom("Dany Coiffure")).toBe("dany-coiffure");
  });

  it("normalise les numéros burkinabè", () => {
    expect(numeroBurkina("70 12 34 56")).toBe("+226 70 12 34 56");
    expect(numeroBurkina("+22670123456")).toBe("+226 70 12 34 56");
    expect(numeroBurkina("0022670123456")).toBe("+226 70 12 34 56");
    expect(numeroBurkina("1234")).toBeNull();
  });

  it("lit la liste de services, coiffure par défaut", () => {
    expect(lireServices("Tresses, Tissage, Manucure:ongles; Pédicure : ongles")).toEqual([
      { nom: "Tresses", famille: "coiffure" },
      { nom: "Tissage", famille: "coiffure" },
      { nom: "Manucure", famille: "ongles" },
      { nom: "Pédicure", famille: "ongles" },
    ]);
    expect(() => lireServices("Massage:spa")).toThrow(/Famille inconnue/);
  });

  it("génère des mots de passe de 14 caractères sans caractère ambigu, tous différents", () => {
    const liste = Array.from({ length: 50 }, () => motDePasseAleatoire());
    for (const m of liste) expect(m).toMatch(/^[a-zA-Z2-9]{14}$/);
    for (const m of liste) expect(m).not.toMatch(/[0OIl1]/);
    expect(new Set(liste).size).toBe(50);
  });
});

describe("textes de la page d'accueil en base", () => {
  it("n'accepte que titre, étiquette et accroche, de longueur raisonnable", () => {
    expect(lireTextesVitrine({ titre: " Beauté *naturelle* ", etiquette: "Salon", logo: { src: "x" }, accroche: "a".repeat(300) })).toEqual({ titre: "Beauté *naturelle*", etiquette: "Salon" });
    expect(lireTextesVitrine("x")).toEqual({});
  });

  it("un salon sans texte enregistré garde les valeurs par défaut, et n'hérite d'aucune photo de La Coquette", () => {
    const v = vitrineDuSalon("nouveau-salon", { titre: "Chez Awa" });
    expect(v.titre).toBe("Chez Awa");
    expect(v.logo).toBeNull();
    expect(v.couverture).toBeNull();
    expect(v.realisations).toEqual([]);
    expect(v.noteVenir).toBeNull();
    expect(JSON.stringify(v)).not.toMatch(/coquette/i);
  });
});
