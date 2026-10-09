import { createAppointment, generateId, isPast, worksOn } from "./booking";
import { getService, getStylist } from "./catalog";
import { addDays, fromMinutes, toMinutes, todayIso } from "./time";
import type { AppointmentStatus, Block, DemoState, IsoDate } from "./types";

/**
 * Jeu de données de démonstration. Toutes les clientes et tous les numéros
 * (+226 70 00 00 xx) sont fictifs.
 */
const CLIENTS = [
  "Awa T.",
  "Mariam O.",
  "Rasmata K.",
  "Bintou Z.",
  "Nafissatou D.",
  "Clarisse Y.",
  "Aminata S.",
  "Pélagie C.",
  "Safiatou N.",
  "Estelle B.",
];

/** Rendez-vous types par jour (indice de jour relatif à aujourd'hui). */
const TEMPLATES: { day: number; stylistId: string; serviceId: string; start: string }[] = [
  { day: 0, stylistId: "aicha-k", serviceId: "braids", start: "08:30" },
  { day: 0, stylistId: "aicha-k", serviceId: "tresses-fulani", start: "14:00" },
  { day: 0, stylistId: "fatou-s", serviceId: "nattes-collees", start: "09:00" },
  { day: 0, stylistId: "fatou-s", serviceId: "tresses-fulani", start: "11:00" },
  { day: 0, stylistId: "fatou-s", serviceId: "braids", start: "15:00" },
  { day: 0, stylistId: "salimata-b", serviceId: "nattes-collees", start: "08:00" },
  { day: 0, stylistId: "salimata-b", serviceId: "nattes-collees", start: "10:00" },
  { day: 0, stylistId: "salimata-b", serviceId: "tresses-fulani", start: "15:30" },
  { day: 1, stylistId: "aicha-k", serviceId: "tresses-fulani", start: "09:00" },
  { day: 1, stylistId: "fatou-s", serviceId: "braids", start: "13:00" },
  { day: 1, stylistId: "salimata-b", serviceId: "nattes-collees", start: "11:00" },
  { day: 2, stylistId: "aicha-k", serviceId: "braids", start: "10:00" },
  { day: 2, stylistId: "salimata-b", serviceId: "tresses-fulani", start: "14:00" },
  { day: 3, stylistId: "fatou-s", serviceId: "nattes-collees", start: "16:00" },
  { day: 4, stylistId: "aicha-k", serviceId: "tresses-fulani", start: "08:00" },
];

/** Rendez-vous fixes autour du scénario principal (23 décembre 2026). */
const SCENARIO_DAY: { date: IsoDate; stylistId: string; serviceId: string; start: string }[] = [
  { date: "2026-12-23", stylistId: "aicha-k", serviceId: "braids", start: "09:00" },
  // Fatou est occupée à 15 h 30 : seule Salimata est proposée en alternative à la même heure.
  { date: "2026-12-23", stylistId: "fatou-s", serviceId: "braids", start: "14:00" },
];

export function createSeed(now: Date = new Date()): DemoState {
  const today = todayIso(now);
  let state: DemoState = { version: 1, seededOn: today, appointments: [], blocks: [], myAppointmentIds: [] };
  let n = 0;

  const add = (date: IsoDate, stylistId: string, serviceId: string, start: string) => {
    const stylist = getStylist(stylistId)!;
    const service = getService(serviceId)!;
    if (!worksOn(stylist, date)) return;
    const ended = isPast(date, fromMinutes(toMinutes(start) + service.durationMin), now);
    const status: AppointmentStatus = ended ? "termine" : n % 3 === 1 ? "en_attente" : "confirme";
    const result = createAppointment(
      state,
      {
        stylistId,
        serviceId,
        date,
        start,
        status,
        clientName: CLIENTS[n % CLIENTS.length],
        clientPhone: `700000${String(n + 1).padStart(2, "0")}`,
      },
      now,
      { allowPast: true },
    );
    if (result.ok) {
      state = result.state;
      n++;
    }
  };

  for (const t of TEMPLATES) add(addDays(today, t.day), t.stylistId, t.serviceId, t.start);
  for (const s of SCENARIO_DAY) if (s.date >= today) add(s.date, s.stylistId, s.serviceId, s.start);

  // Pause déjeuner bloquée pour Salimata aujourd'hui et demain.
  const blocks: Block[] = [];
  for (const day of [0, 1]) {
    const date = addDays(today, day);
    if (!worksOn(getStylist("salimata-b")!, date)) continue;
    for (const start of ["12:30", "13:00"]) {
      const busy = state.appointments.some((a) => a.stylistId === "salimata-b" && a.date === date && a.start === start);
      if (!busy) blocks.push({ id: generateId(), stylistId: "salimata-b", date, start });
    }
  }
  return { ...state, blocks };
}
