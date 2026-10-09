import { describe, expect, it } from "vitest";
import { addDays, formatDateLong, formatDuration, formatFcfa, formatTime, isValidIsoDate, nowMinutes, todayIso, weekday } from "./time";

const nb = (s: string) => s.replace(/ /g, " ");

describe("formats français", () => {
  it("formate les prix en FCFA", () => {
    expect(nb(formatFcfa(15000))).toBe("15 000 FCFA");
    expect(nb(formatFcfa(1250000))).toBe("1 250 000 FCFA");
    expect(nb(formatFcfa(500))).toBe("500 FCFA");
  });

  it("formate les durées", () => {
    expect(nb(formatDuration(150))).toBe("2 h 30");
    expect(nb(formatDuration(180))).toBe("3 h");
    expect(nb(formatDuration(45))).toBe("45 min");
  });

  it("formate les heures", () => {
    expect(nb(formatTime("15:30"))).toBe("15 h 30");
    expect(nb(formatTime("09:00"))).toBe("9 h");
  });

  it("formate la date du scénario", () => {
    expect(formatDateLong("2026-12-23")).toBe("mercredi 23 décembre 2026");
    expect(weekday("2026-12-23")).toBe(3);
  });
});

describe("fuseau Africa/Ouagadougou (UTC+0)", () => {
  it("calcule la date et l'heure locales", () => {
    const now = new Date("2026-12-23T23:30:00Z");
    expect(todayIso(now)).toBe("2026-12-23");
    expect(nowMinutes(now)).toBe(23 * 60 + 30);
  });

  it("additionne les jours en changeant de mois et d'année", () => {
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
    expect(addDays("2026-03-01", -1)).toBe("2026-02-28");
  });

  it("valide les dates", () => {
    expect(isValidIsoDate("2026-12-23")).toBe(true);
    expect(isValidIsoDate("2026-02-30")).toBe(false);
    expect(isValidIsoDate("23/12/2026")).toBe(false);
  });
});
