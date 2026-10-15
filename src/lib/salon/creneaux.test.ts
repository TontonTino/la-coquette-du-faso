import { describe, expect, it } from "vitest";
import { creneauxLibres, gene, heureDepuisMinutes, minutesDepuisHeure, verifierHoraires, verifierService, type HoraireSaisi } from "./creneaux";

const h = (s: string) => minutesDepuisHeure(s)!;
const HORAIRE = { ouvreMin: h("08:00"), fermeMin: h("12:00") };
const semaine = (surcharge: Partial<HoraireSaisi> = {}): HoraireSaisi[] => Array.from({ length: 7 }, (_, jour) => ({ jour, ouvert: jour !== 0, ouvre: "08:00", ferme: "19:00", ...(jour === 1 ? surcharge : {}) }));

describe("créneaux libres", () => {
  it("convertit les heures", () => {
    expect(heureDepuisMinutes(390)).toBe("06:30");
    expect(minutesDepuisHeure("23:00")).toBe(1380);
    expect(minutesDepuisHeure("24:00")).toBe(1440);
    expect(minutesDepuisHeure("7h30")).toBeNull();
    expect(minutesDepuisHeure("25:00")).toBeNull();
  });

  it("propose tous les créneaux d'une journée vide, jusqu'à la dernière heure où la prestation tient", () => {
    const c = creneauxLibres({ horaire: HORAIRE, dureeMin: 120, pauseMin: 30, coiffeuses: [{ id: "a", occupations: [] }] });
    expect(c[0].heure).toBe("08:00");
    expect(c.at(-1)?.heure).toBe("10:00"); // 10 h + 2 h = fermeture à 12 h
    expect(c).toHaveLength(9);
  });

  it("ne propose rien si le salon est fermé ce jour-là ou si la durée est nulle", () => {
    expect(creneauxLibres({ horaire: null, dureeMin: 60, pauseMin: 30, coiffeuses: [{ id: "a", occupations: [] }] })).toEqual([]);
    expect(creneauxLibres({ horaire: HORAIRE, dureeMin: 0, pauseMin: 30, coiffeuses: [{ id: "a", occupations: [] }] })).toEqual([]);
  });

  it("garde 30 minutes de pause avant et après une cliente", () => {
    // Cliente de 9 h à 10 h : une prestation d'1 h devrait finir avant 8 h 30 (donc commencer avant 7 h 30, hors horaires)
    // ou commencer à partir de 10 h 30.
    const a = { id: "a", occupations: [{ debutMin: h("09:00"), finMin: h("10:00") }] };
    const c = creneauxLibres({ horaire: HORAIRE, dureeMin: 60, pauseMin: 30, coiffeuses: [a] });
    expect(c.map((x) => x.heure)).toEqual(["10:30", "10:45", "11:00"]);
    expect(gene(h("08:00"), h("09:00"), a.occupations[0], 30)).toBe(true); // finit pile au début de la cliente : pas de pause
    expect(gene(h("08:00"), h("08:30"), a.occupations[0], 30)).toBe(false);
  });

  it("sans pause, les rendez-vous peuvent s'enchaîner", () => {
    const a = { id: "a", occupations: [{ debutMin: h("09:00"), finMin: h("10:00") }] };
    const c = creneauxLibres({ horaire: HORAIRE, dureeMin: 60, pauseMin: 0, coiffeuses: [a] });
    expect(c.map((x) => x.heure)).toContain("10:00");
    expect(c.map((x) => x.heure)).toContain("08:00");
    expect(c.map((x) => x.heure)).not.toContain("08:15");
  });

  it("propose un créneau tant qu'une coiffeuse est libre, et dit lesquelles", () => {
    const a = { id: "a", occupations: [{ debutMin: h("08:00"), finMin: h("12:00") }] };
    const b = { id: "b", occupations: [] };
    const c = creneauxLibres({ horaire: HORAIRE, dureeMin: 60, pauseMin: 30, coiffeuses: [a, b] });
    expect(c.every((x) => x.coiffeuseIds.join() === "b")).toBe(true);
    expect(creneauxLibres({ horaire: HORAIRE, dureeMin: 60, pauseMin: 30, coiffeuses: [a] })).toEqual([]);
  });

  it("n'offre pas le passé aujourd'hui", () => {
    const c = creneauxLibres({ horaire: HORAIRE, dureeMin: 60, pauseMin: 30, coiffeuses: [{ id: "a", occupations: [] }], maintenantMin: h("10:10") });
    expect(c[0].heure).toBe("10:15");
  });
});

describe("saisie des horaires", () => {
  it("accepte une semaine valide et refuse le reste avec un message clair", () => {
    expect(verifierHoraires(semaine(), 30)).toBeNull();
    expect(verifierHoraires(semaine(), 0)).toBeNull();
    expect(verifierHoraires(semaine(), 33)).toMatch(/pause/);
    expect(verifierHoraires(semaine(), 200)).toMatch(/pause/);
    expect(verifierHoraires(semaine({ ouvre: "18:00", ferme: "09:00" }), 30)).toMatch(/Lundi : la fermeture/);
    expect(verifierHoraires(semaine({ ouvre: "10:00", ferme: "10:15" }), 30)).toMatch(/au moins 30 minutes/);
    expect(verifierHoraires(semaine({ ouvre: "ab" }), 30)).toMatch(/Lundi : heure invalide/);
    expect(verifierHoraires(semaine().map((j) => ({ ...j, ouvert: false })), 30)).toMatch(/au moins un jour/);
    expect(verifierHoraires(semaine().slice(0, 6), 30)).toMatch(/sept jours/);
  });

  it("une heure d'un jour fermé n'est pas contrôlée", () => {
    expect(verifierHoraires(semaine().map((j) => (j.jour === 0 ? { ...j, ouvre: "zz" } : j)), 30)).toBeNull();
  });

  it("vérifie durée et prix d'un service", () => {
    expect(verifierService({ dureeMin: 180, prix: 15000 })).toBeNull();
    expect(verifierService({ dureeMin: null, prix: null })).toBeNull();
    expect(verifierService({ dureeMin: 20, prix: null })).toMatch(/durée/);
    expect(verifierService({ dureeMin: 100, prix: null })).toMatch(/durée/);
    expect(verifierService({ dureeMin: 60, prix: -5 })).toMatch(/Prix/);
    expect(verifierService({ dureeMin: 60, prix: 2_000_000 })).toMatch(/Prix/);
  });
});
