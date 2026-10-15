import { describe, expect, it } from "vitest";
import { contraste, THEME_PAR_DEFAUT, THEMES, themeDuSalon, variablesCss, verifierTheme } from "./theme";

describe("thème des salons", () => {
  it("calcule le contraste WCAG (noir sur blanc = 21:1, identique = 1:1)", () => {
    expect(contraste("#000000", "#ffffff")).toBeCloseTo(21, 1);
    expect(contraste("#c8a44d", "#c8a44d")).toBeCloseTo(1, 5);
  });

  it("le thème par défaut respecte les contrastes AA", () => {
    expect(verifierTheme(THEME_PAR_DEFAUT)).toEqual([]);
  });

  it("chaque thème de salon déclaré respecte les contrastes AA", () => {
    for (const slug of Object.keys(THEMES)) expect(verifierTheme(themeDuSalon(slug)), slug).toEqual([]);
  });

  it("refuse un thème illisible", () => {
    const clair = { ...THEME_PAR_DEFAUT, action: "#e8d9a0" };
    expect(verifierTheme(clair).length).toBeGreaterThan(0);
  });

  it("un salon inconnu reçoit le thème par défaut, et les surcharges s'appliquent", () => {
    expect(themeDuSalon("inconnu")).toEqual(THEME_PAR_DEFAUT);
    THEMES["salon-test"] = { marque: "#123456" };
    expect(themeDuSalon("salon-test").marque).toBe("#123456");
    expect(themeDuSalon("salon-test").action).toBe(THEME_PAR_DEFAUT.action);
    delete THEMES["salon-test"];
  });

  it("expose les rôles sous forme de variables CSS", () => {
    const v = variablesCss(THEME_PAR_DEFAUT) as Record<string, string>;
    expect(v["--color-marque"]).toBe("#3e2a22");
    expect(v["--color-action"]).toBe("#a44e3a");
  });
});

describe("couleurs enregistrées en base", () => {
  it("n'accepte que des couleurs #rrggbb connues, le reste est ignoré", async () => {
    const { lireSurchargeTheme } = await import("./theme");
    expect(lireSurchargeTheme({ marque: "#123456", action: "rouge", piege: "#ffffff", detail: "#ABCDEF" })).toEqual({ marque: "#123456", detail: "#abcdef" });
    for (const brut of [null, undefined, "x", 3, [], ["#123456"]]) expect(lireSurchargeTheme(brut)).toEqual({});
  });

  it("un thème de base illisible est écarté : on garde le thème par défaut", () => {
    expect(themeDuSalon("nouveau-salon", { marque: "#ffff00" })).toEqual(THEME_PAR_DEFAUT);
    expect(themeDuSalon("nouveau-salon", { marque: "#222222" }).marque).toBe("#222222");
  });
});
