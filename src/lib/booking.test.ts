import { describe, expect, it } from "vitest";
import {
  allowedActions,
  applyAction,
  availableStarts,
  checkSlot,
  createAppointment,
  daySchedule,
  findAlternatives,
  normalizePhone,
  toggleBlock,
  validateClient,
} from "./booking";
import { DEMO_SCENARIO } from "./catalog";
import { createSeed } from "./seed";
import type { DemoState } from "./types";

// Vendredi 9 octobre 2026, 10 h 00 à Ouagadougou.
const NOW = new Date("2026-10-09T10:00:00Z");
const empty = (): DemoState => ({ version: 1, seededOn: "2026-10-09", appointments: [], blocks: [], myAppointmentIds: [] });
const client = { clientName: "Cliente Démo", clientPhone: "70 00 00 00" };
const scenario = { ...DEMO_SCENARIO, ...client };

function book(state: DemoState, input: Parameters<typeof createAppointment>[1]) {
  const r = createAppointment(state, input, NOW, { markAsMine: true });
  if (!r.ok) throw new Error(r.message);
  return r;
}

describe("réservation du scénario principal", () => {
  it("réserve Tresses Fulani avec Aïcha K. le 23/12/2026 à 15 h 30, 2 h 30, 15 000 FCFA", () => {
    const r = book(empty(), scenario);
    expect(r.value).toMatchObject({
      stylistId: "aicha-k",
      serviceId: "tresses-fulani",
      date: "2026-12-23",
      start: "15:30",
      durationMin: 150,
      priceFcfa: 15000,
      status: "en_attente",
      clientPhone: "+226 70 00 00 00",
    });
    expect(r.value.reference).toMatch(/^LCF-[A-Z0-9]{5}$/);
    expect(r.state.myAppointmentIds).toEqual([r.value.id]);
  });

  it("est possible avec les données de démonstration initiales", () => {
    const seed = createSeed(NOW);
    expect(checkSlot(seed, DEMO_SCENARIO, NOW)).toEqual({ ok: true });
  });
});

describe("prévention des doubles réservations", () => {
  it("refuse exactement le même créneau une seconde fois", () => {
    const first = book(empty(), scenario);
    const second = createAppointment(first.state, scenario, NOW);
    expect(second.ok).toBe(false);
    if (!second.ok) expect(second.reason).toBe("deja_reserve");
    expect(first.state.appointments).toHaveLength(1);
  });

  it("refuse un créneau qui chevauche un rendez-vous existant", () => {
    const first = book(empty(), scenario); // 15 h 30 – 18 h 00
    // Nattes collées n'est pas proposée par Aïcha : on teste avec Braids (3 h).
    const overlapBefore = createAppointment(first.state, { ...scenario, serviceId: "braids", start: "13:00" }, NOW); // 13 h – 16 h
    const overlapInside = createAppointment(first.state, { ...scenario, start: "16:00" }, NOW);
    expect(overlapBefore.ok).toBe(false);
    expect(overlapInside.ok).toBe(false);
  });

  it("accepte un créneau contigu (fin = début)", () => {
    const first = book(empty(), scenario);
    const before = createAppointment(first.state, { ...scenario, serviceId: "braids", start: "12:30" }, NOW); // 12 h 30 – 15 h 30
    expect(before.ok).toBe(true);
  });

  it("n'empêche pas une autre coiffeuse de prendre la même heure", () => {
    const first = book(empty(), scenario);
    const other = createAppointment(first.state, { ...scenario, stylistId: "salimata-b" }, NOW);
    expect(other.ok).toBe(true);
  });

  it("libère le créneau après annulation", () => {
    const first = book(empty(), scenario);
    const cancelled = applyAction(first.state, first.value.id, "annuler", "cliente", NOW);
    expect(cancelled.ok).toBe(true);
    if (!cancelled.ok) return;
    expect(cancelled.value.status).toBe("annule");
    expect(cancelled.value.cancelledBy).toBe("cliente");
    expect(createAppointment(cancelled.state, scenario, NOW).ok).toBe(true);
  });

  it("retire le créneau réservé des horaires proposés", () => {
    const before = availableStarts(empty(), "aicha-k", "tresses-fulani", "2026-12-23", NOW);
    const after = availableStarts(book(empty(), scenario).state, "aicha-k", "tresses-fulani", "2026-12-23", NOW);
    expect(before).toContain("15:30");
    expect(after).not.toContain("15:30");
    expect(after).not.toContain("14:00"); // 14 h – 16 h 30 chevaucherait
    expect(after).toContain("13:00"); // 13 h – 15 h 30, contigu
  });
});

describe("règles de disponibilité", () => {
  it("refuse une prestation non proposée par la coiffeuse", () => {
    expect(checkSlot(empty(), { ...DEMO_SCENARIO, serviceId: "nattes-collees" }, NOW)).toMatchObject({ ok: false, reason: "prestation_non_proposee" });
  });

  it("refuse le dimanche (salon fermé)", () => {
    expect(checkSlot(empty(), { ...DEMO_SCENARIO, date: "2026-12-27" }, NOW)).toMatchObject({ ok: false, reason: "salon_ferme" });
  });

  it("refuse un jour de repos de la coiffeuse", () => {
    // Salimata ne travaille pas le samedi.
    expect(checkSlot(empty(), { ...DEMO_SCENARIO, stylistId: "salimata-b", date: "2026-12-26" }, NOW)).toMatchObject({ ok: false, reason: "jour_non_travaille" });
  });

  it("refuse une prestation qui finirait après la fermeture (19 h)", () => {
    expect(checkSlot(empty(), { ...DEMO_SCENARIO, start: "17:00" }, NOW)).toMatchObject({ ok: false, reason: "hors_horaires" });
    expect(checkSlot(empty(), { ...DEMO_SCENARIO, start: "16:30" }, NOW)).toEqual({ ok: true });
  });

  it("refuse un créneau passé, en heure de Ouagadougou", () => {
    expect(checkSlot(empty(), { ...DEMO_SCENARIO, date: "2026-10-09", start: "09:30" }, NOW)).toMatchObject({ ok: false, reason: "creneau_passe" });
    expect(checkSlot(empty(), { ...DEMO_SCENARIO, date: "2026-10-09", start: "10:30" }, NOW)).toEqual({ ok: true });
  });

  it("refuse un créneau bloqué par la coiffeuse", () => {
    const blocked = toggleBlock(empty(), "aicha-k", "2026-12-23", "17:00", NOW);
    expect(blocked.ok).toBe(true);
    if (!blocked.ok) return;
    expect(checkSlot(blocked.state, DEMO_SCENARIO, NOW)).toMatchObject({ ok: false, reason: "creneau_bloque" });
    const unblocked = toggleBlock(blocked.state, "aicha-k", "2026-12-23", "17:00", NOW);
    expect(unblocked.ok && unblocked.value).toBe("debloque");
    if (unblocked.ok) expect(checkSlot(unblocked.state, DEMO_SCENARIO, NOW)).toEqual({ ok: true });
  });

  it("interdit de bloquer un créneau occupé par un rendez-vous", () => {
    const first = book(empty(), scenario);
    expect(toggleBlock(first.state, "aicha-k", "2026-12-23", "16:00", NOW)).toMatchObject({ ok: false, reason: "deja_reserve" });
  });
});

describe("alternatives", () => {
  it("propose d'autres expertes à la même heure et d'autres horaires", () => {
    const seed = createSeed(NOW);
    const taken = book(seed, scenario).state;
    const alt = findAlternatives(taken, { serviceId: "tresses-fulani", stylistId: "aicha-k", date: "2026-12-23", start: "15:30" }, NOW);
    // Fatou est occupée de 14 h à 17 h dans les données de démo : seule Salimata est libre.
    expect(alt.sameTimeOtherStylists.map((s) => s.id)).toEqual(["salimata-b"]);
    expect(alt.sameStylistSameDay.length).toBeGreaterThan(0);
    expect(alt.sameStylistSameDay).not.toContain("15:30");
    expect(alt.sameStylistNextDays[0].date).toBe("2026-12-24");
  });
});

describe("statuts", () => {
  it("la cliente ne peut pas confirmer, la coiffeuse oui", () => {
    const { value } = book(empty(), scenario);
    expect(allowedActions(value, "cliente", NOW)).toEqual(["annuler"]);
    expect(allowedActions(value, "coiffeuse", NOW)).toEqual(["confirmer", "annuler"]);
  });

  it("refuse une action devenue impossible", () => {
    const first = book(empty(), scenario);
    const cancelled = applyAction(first.state, first.value.id, "annuler", "gerante", NOW);
    if (!cancelled.ok) throw new Error();
    expect(applyAction(cancelled.state, first.value.id, "confirmer", "gerante", NOW)).toMatchObject({ ok: false, reason: "transition_impossible" });
  });
});

describe("planning du jour", () => {
  it("découpe la journée en cases de 30 min avec rendez-vous, blocages et créneaux libres", () => {
    const first = book(empty(), scenario);
    const blocked = toggleBlock(first.state, "aicha-k", "2026-12-23", "12:00", NOW);
    if (!blocked.ok) throw new Error();
    const { working, cells } = daySchedule(blocked.state, "aicha-k", "2026-12-23", NOW);
    expect(working).toBe(true);
    expect(cells).toHaveLength(22); // 8 h → 19 h
    const at = (t: string) => cells.find((c) => c.start === t)!;
    expect(at("15:30")).toMatchObject({ kind: "rdv", isFirst: true });
    expect(at("17:30")).toMatchObject({ kind: "rdv", isFirst: false });
    expect(at("18:00").kind).toBe("libre");
    expect(at("12:00").kind).toBe("bloque");
  });
});

describe("validation des coordonnées", () => {
  it("accepte les formats burkinabè usuels", () => {
    expect(normalizePhone("70123456")).toBe("+226 70 12 34 56");
    expect(normalizePhone("+226 70 12 34 56")).toBe("+226 70 12 34 56");
    expect(normalizePhone("00226-70.12.34.56")).toBe("+226 70 12 34 56");
  });

  it("refuse les entrées invalides avec des messages explicites", () => {
    const errors = validateClient({ clientName: " ", clientPhone: "1234" });
    expect(errors.clientName).toMatch(/nom/);
    expect(errors.clientPhone).toMatch(/8 chiffres/);
    expect(createAppointment(empty(), { ...DEMO_SCENARIO, clientName: "", clientPhone: "" }, NOW)).toMatchObject({ ok: false, reason: "client_invalide" });
  });
});

describe("données de démonstration", () => {
  it("sont cohérentes : aucun chevauchement entre rendez-vous actifs", () => {
    for (const iso of ["2026-10-09T06:00:00Z", "2026-10-09T13:00:00Z", "2026-10-11T09:00:00Z"]) {
      const now = new Date(iso);
      const seed = createSeed(now);
      expect(seed.appointments.length).toBeGreaterThan(5);
      for (const a of seed.appointments) {
        const others = { ...seed, appointments: seed.appointments.filter((x) => x.id !== a.id) };
        expect(checkSlot(others, a, now, { allowPast: true })).toEqual({ ok: true });
      }
    }
  });
});
