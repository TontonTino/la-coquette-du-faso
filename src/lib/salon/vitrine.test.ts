import { existsSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { VITRINES, vitrineDuSalon, type PhotoVitrine } from "./vitrine";

const toutes = (v: ReturnType<typeof vitrineDuSalon>): PhotoVitrine[] =>
  [v.couverture, v.facade, v.salon?.equipe, ...(v.salon?.portraits ?? []), ...v.realisations, ...Object.values(v.familles)].filter((p): p is PhotoVitrine => !!p);

describe("vitrine des salons", () => {
  it("chaque photo existe dans public/ et a un texte alternatif utile", () => {
    for (const slug of Object.keys(VITRINES)) {
      for (const p of toutes(vitrineDuSalon(slug))) {
        expect(existsSync(join(process.cwd(), "public", p.src)), p.src).toBe(true);
        expect(p.alt.length, p.src).toBeGreaterThan(15);
        expect(p.largeur).toBeGreaterThan(0);
        expect(p.hauteur).toBeGreaterThan(0);
      }
    }
  });
  it("un salon sans vitrine reçoit les valeurs par défaut, sans photo", () => {
    const v = vitrineDuSalon("autre-salon");
    expect(v.couverture).toBeNull();
    expect(v.realisations).toEqual([]);
    expect(v.titre).toContain("*belle*");
  });
});
