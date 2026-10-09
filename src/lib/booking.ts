import { SALON, STYLISTS, getService, getStylist, stylistsForService } from "./catalog";
import { addDays, compareDateTime, fromMinutes, isValidIsoDate, isValidTime, nowMinutes, toMinutes, todayIso, weekday } from "./time";
import type { Actor, Appointment, AppointmentStatus, Block, DemoState, HourMinute, IsoDate, Stylist } from "./types";

/* ------------------------------------------------------------------ */
/* Vérification d'un créneau                                           */
/* ------------------------------------------------------------------ */

export type SlotRefusal =
  | "donnees_invalides"
  | "prestation_non_proposee"
  | "salon_ferme"
  | "jour_non_travaille"
  | "hors_horaires"
  | "creneau_passe"
  | "creneau_bloque"
  | "deja_reserve";

export type SlotCheck = { ok: true } | { ok: false; reason: SlotRefusal; message: string };

export interface SlotRequest {
  stylistId: string;
  serviceId: string;
  date: IsoDate;
  start: HourMinute;
}

export interface CheckOptions {
  /** Rendez-vous à ignorer (utile pour une modification). */
  ignoreAppointmentId?: string;
  /** Autorise un créneau passé (génération des données de démonstration). */
  allowPast?: boolean;
}

const OPEN = toMinutes(SALON.openingTime);
const CLOSE = toMinutes(SALON.closingTime);
const STEP = SALON.slotStepMin;

export function isActive(a: Appointment): boolean {
  return a.status !== "annule";
}

export function appointmentEnd(a: Pick<Appointment, "start" | "durationMin">): HourMinute {
  return fromMinutes(toMinutes(a.start) + a.durationMin);
}

function overlaps(aStart: number, aEnd: number, bStart: number, bEnd: number): boolean {
  return aStart < bEnd && bStart < aEnd;
}

export function isSalonOpen(date: IsoDate): boolean {
  return (SALON.openDays as readonly number[]).includes(weekday(date));
}

export function worksOn(stylist: Stylist, date: IsoDate): boolean {
  return isSalonOpen(date) && stylist.workDays.includes(weekday(date));
}

/** Le créneau commence-t-il avant l'instant présent (heure de Ouagadougou) ? */
export function isPast(date: IsoDate, start: HourMinute, now: Date): boolean {
  const today = todayIso(now);
  if (date !== today) return date < today;
  return toMinutes(start) <= nowMinutes(now);
}

export function checkSlot(state: DemoState, req: SlotRequest, now: Date, options: CheckOptions = {}): SlotCheck {
  const stylist = getStylist(req.stylistId);
  const service = getService(req.serviceId);
  if (!stylist || !service || !isValidIsoDate(req.date) || !isValidTime(req.start)) {
    return { ok: false, reason: "donnees_invalides", message: "La demande de réservation est incomplète." };
  }
  if (!stylist.serviceIds.includes(service.id)) {
    return {
      ok: false,
      reason: "prestation_non_proposee",
      message: `${stylist.name} ne propose pas la prestation « ${service.name} ».`,
    };
  }
  if (!isSalonOpen(req.date)) {
    return { ok: false, reason: "salon_ferme", message: "Le salon est fermé ce jour-là." };
  }
  if (!worksOn(stylist, req.date)) {
    return { ok: false, reason: "jour_non_travaille", message: `${stylist.name} ne travaille pas ce jour-là.` };
  }
  const start = toMinutes(req.start);
  const end = start + service.durationMin;
  if (start < OPEN || end > CLOSE || (start - OPEN) % STEP !== 0) {
    return {
      ok: false,
      reason: "hors_horaires",
      message: "Ce créneau ne permet pas de terminer la prestation avant la fermeture du salon.",
    };
  }
  if (!options.allowPast && isPast(req.date, req.start, now)) {
    return { ok: false, reason: "creneau_passe", message: "Ce créneau est déjà passé." };
  }
  const blocked = state.blocks.some(
    (b) => b.stylistId === stylist.id && b.date === req.date && overlaps(start, end, toMinutes(b.start), toMinutes(b.start) + STEP),
  );
  if (blocked) {
    return { ok: false, reason: "creneau_bloque", message: `${stylist.name} n'est pas disponible sur une partie de ce créneau.` };
  }
  const taken = state.appointments.some(
    (a) =>
      a.id !== options.ignoreAppointmentId &&
      isActive(a) &&
      a.stylistId === stylist.id &&
      a.date === req.date &&
      overlaps(start, end, toMinutes(a.start), toMinutes(a.start) + a.durationMin),
  );
  if (taken) {
    return { ok: false, reason: "deja_reserve", message: `Ce créneau vient d'être réservé avec ${stylist.name}.` };
  }
  return { ok: true };
}

/** Heures de début possibles pour une prestation avec une coiffeuse, un jour donné. */
export function availableStarts(state: DemoState, stylistId: string, serviceId: string, date: IsoDate, now: Date): HourMinute[] {
  const service = getService(serviceId);
  if (!service) return [];
  const starts: HourMinute[] = [];
  for (let t = OPEN; t + service.durationMin <= CLOSE; t += STEP) {
    const start = fromMinutes(t);
    if (checkSlot(state, { stylistId, serviceId, date, start }, now).ok) starts.push(start);
  }
  return starts;
}

/** Toutes les cases de 30 minutes de la journée d'ouverture. */
export function dayGrid(): HourMinute[] {
  const cells: HourMinute[] = [];
  for (let t = OPEN; t < CLOSE; t += STEP) cells.push(fromMinutes(t));
  return cells;
}

export type ScheduleCell =
  | { start: HourMinute; kind: "rdv"; appointment: Appointment; isFirst: boolean }
  | { start: HourMinute; kind: "bloque"; block: Block; past: boolean }
  | { start: HourMinute; kind: "libre"; past: boolean };

export interface DaySchedule {
  working: boolean;
  cells: ScheduleCell[];
}

/** Planning d'une coiffeuse découpé en cases de 30 minutes. */
export function daySchedule(state: DemoState, stylistId: string, date: IsoDate, now: Date): DaySchedule {
  const stylist = getStylist(stylistId);
  const working = !!stylist && worksOn(stylist, date);
  const appointments = appointmentsFor(state, { stylistId, date });
  const cells: ScheduleCell[] = dayGrid().map((start) => {
    const t = toMinutes(start);
    const appointment = appointments.find((a) => t >= toMinutes(a.start) && t < toMinutes(a.start) + a.durationMin);
    if (appointment) return { start, kind: "rdv", appointment, isFirst: appointment.start === start };
    const block = state.blocks.find((b) => b.stylistId === stylistId && b.date === date && b.start === start);
    const past = isPast(date, start, now);
    if (block) return { start, kind: "bloque", block, past };
    return { start, kind: "libre", past };
  });
  return { working, cells };
}

/* ------------------------------------------------------------------ */
/* Consultation                                                        */
/* ------------------------------------------------------------------ */

export function appointmentsFor(
  state: DemoState,
  filter: { stylistId?: string; date?: IsoDate; includeCancelled?: boolean } = {},
): Appointment[] {
  return state.appointments
    .filter(
      (a) =>
        (filter.includeCancelled || isActive(a)) &&
        (!filter.stylistId || a.stylistId === filter.stylistId) &&
        (!filter.date || a.date === filter.date),
    )
    .sort(compareDateTime);
}

export function isUpcoming(a: Appointment, now: Date): boolean {
  return !isPast(a.date, appointmentEnd(a), now);
}

/* ------------------------------------------------------------------ */
/* Alternatives                                                        */
/* ------------------------------------------------------------------ */

export interface Alternatives {
  /** Autres coiffeuses libres exactement à l'heure demandée. */
  sameTimeOtherStylists: Stylist[];
  /** Autres heures libres le même jour avec la même coiffeuse (les plus proches). */
  sameStylistSameDay: HourMinute[];
  /** Autres coiffeuses ayant des créneaux libres le même jour. */
  otherStylistsSameDay: { stylist: Stylist; starts: HourMinute[] }[];
  /** Prochains jours où la coiffeuse demandée a des créneaux libres. */
  sameStylistNextDays: { date: IsoDate; starts: HourMinute[] }[];
}

export function findAlternatives(
  state: DemoState,
  req: { serviceId: string; stylistId: string; date: IsoDate; start?: HourMinute },
  now: Date,
): Alternatives {
  const others = stylistsForService(req.serviceId).filter((s) => s.id !== req.stylistId);

  const sameTimeOtherStylists = req.start
    ? others.filter((s) => checkSlot(state, { stylistId: s.id, serviceId: req.serviceId, date: req.date, start: req.start! }, now).ok)
    : [];

  const target = req.start ? toMinutes(req.start) : 0;
  const sameStylistSameDay = availableStarts(state, req.stylistId, req.serviceId, req.date, now)
    .filter((s) => s !== req.start)
    .sort((a, b) => Math.abs(toMinutes(a) - target) - Math.abs(toMinutes(b) - target))
    .slice(0, 4)
    .sort((a, b) => toMinutes(a) - toMinutes(b));

  const otherStylistsSameDay = others
    .map((stylist) => ({ stylist, starts: availableStarts(state, stylist.id, req.serviceId, req.date, now).slice(0, 4) }))
    .filter((o) => o.starts.length > 0);

  const sameStylistNextDays: { date: IsoDate; starts: HourMinute[] }[] = [];
  for (let i = 1; i <= 21 && sameStylistNextDays.length < 3; i++) {
    const date = addDays(req.date, i);
    const starts = availableStarts(state, req.stylistId, req.serviceId, date, now);
    if (starts.length > 0) sameStylistNextDays.push({ date, starts: starts.slice(0, 4) });
  }

  return { sameTimeOtherStylists, sameStylistSameDay, otherStylistsSameDay, sameStylistNextDays };
}

export function hasAlternatives(alt: Alternatives): boolean {
  return (
    alt.sameTimeOtherStylists.length > 0 ||
    alt.sameStylistSameDay.length > 0 ||
    alt.otherStylistsSameDay.length > 0 ||
    alt.sameStylistNextDays.length > 0
  );
}

/* ------------------------------------------------------------------ */
/* Coordonnées de la cliente                                           */
/* ------------------------------------------------------------------ */

export interface ClientDetails {
  clientName: string;
  clientPhone: string;
  note?: string;
}

export type ClientErrors = Partial<Record<keyof ClientDetails, string>>;

/** Numéro burkinabè : 8 chiffres, avec ou sans indicatif +226. */
export function normalizePhone(raw: string): string | null {
  let digits = raw.replace(/[\s.\-()]/g, "");
  if (digits.startsWith("+226")) digits = digits.slice(4);
  else if (digits.startsWith("00226")) digits = digits.slice(5);
  if (!/^\d{8}$/.test(digits)) return null;
  return `+226 ${digits.replace(/(\d{2})(?=\d)/g, "$1 ")}`;
}

export function validateClient(details: ClientDetails): ClientErrors {
  const errors: ClientErrors = {};
  const name = details.clientName.trim();
  if (name.length < 2) errors.clientName = "Indiquez votre nom (2 caractères minimum).";
  else if (name.length > 60) errors.clientName = "Le nom ne doit pas dépasser 60 caractères.";
  if (!details.clientPhone.trim()) errors.clientPhone = "Indiquez un numéro de téléphone.";
  else if (!normalizePhone(details.clientPhone))
    errors.clientPhone = "Numéro invalide : 8 chiffres attendus, par exemple 70 12 34 56.";
  if (details.note && details.note.length > 300) errors.note = "La remarque ne doit pas dépasser 300 caractères.";
  return errors;
}

/* ------------------------------------------------------------------ */
/* Actions                                                             */
/* ------------------------------------------------------------------ */

export type ActionResult<T = undefined> =
  | { ok: true; state: DemoState; value: T }
  | { ok: false; message: string; reason?: SlotRefusal | "client_invalide" | "introuvable" | "transition_impossible" };

export function generateId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

function makeReference(existing: Appointment[]): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  for (;;) {
    let code = "";
    for (let i = 0; i < 5; i++) code += alphabet[Math.floor(Math.random() * alphabet.length)];
    const reference = `LCF-${code}`;
    if (!existing.some((a) => a.reference === reference)) return reference;
  }
}

export interface BookingInput extends SlotRequest, ClientDetails {
  status?: AppointmentStatus;
}

/**
 * Crée un rendez-vous après avoir revérifié la disponibilité.
 * C'est cette vérification, faite au moment de la confirmation, qui empêche
 * les doubles réservations.
 */
export function createAppointment(
  state: DemoState,
  input: BookingInput,
  now: Date,
  options: { markAsMine?: boolean; allowPast?: boolean } = {},
): ActionResult<Appointment> {
  const errors = validateClient(input);
  const firstError = Object.values(errors)[0];
  if (firstError) return { ok: false, reason: "client_invalide", message: firstError };

  const check = checkSlot(state, input, now, { allowPast: options.allowPast });
  if (!check.ok) return { ok: false, reason: check.reason, message: check.message };

  const service = getService(input.serviceId)!;
  const stamp = now.toISOString();
  const appointment: Appointment = {
    id: generateId(),
    reference: makeReference(state.appointments),
    clientName: input.clientName.trim(),
    clientPhone: normalizePhone(input.clientPhone)!,
    note: input.note?.trim() || undefined,
    stylistId: input.stylistId,
    serviceId: service.id,
    date: input.date,
    start: input.start,
    durationMin: service.durationMin,
    priceFcfa: service.priceFcfa,
    status: input.status ?? "en_attente",
    createdAt: stamp,
    updatedAt: stamp,
  };
  return {
    ok: true,
    value: appointment,
    state: {
      ...state,
      appointments: [...state.appointments, appointment],
      myAppointmentIds: options.markAsMine ? [...state.myAppointmentIds, appointment.id] : state.myAppointmentIds,
    },
  };
}

export type AppointmentAction = "confirmer" | "annuler" | "terminer";

/** Transitions possibles selon le statut et le moment. */
export function allowedActions(a: Appointment, actor: Actor, now: Date): AppointmentAction[] {
  if (a.status === "annule" || a.status === "termine") return [];
  const started = isPast(a.date, a.start, now);
  const actions: AppointmentAction[] = [];
  if (actor !== "cliente" && a.status === "en_attente" && !started) actions.push("confirmer");
  if (actor !== "cliente" && a.status === "confirme" && started) actions.push("terminer");
  if (!started) actions.push("annuler");
  return actions;
}

export function applyAction(
  state: DemoState,
  appointmentId: string,
  action: AppointmentAction,
  actor: Actor,
  now: Date,
): ActionResult<Appointment> {
  const current = state.appointments.find((a) => a.id === appointmentId);
  if (!current) return { ok: false, reason: "introuvable", message: "Ce rendez-vous n'existe plus." };
  if (!allowedActions(current, actor, now).includes(action)) {
    return { ok: false, reason: "transition_impossible", message: "Cette action n'est plus possible pour ce rendez-vous." };
  }
  const status: AppointmentStatus = action === "confirmer" ? "confirme" : action === "annuler" ? "annule" : "termine";
  const updated: Appointment = {
    ...current,
    status,
    updatedAt: now.toISOString(),
    cancelledBy: action === "annuler" ? actor : current.cancelledBy,
  };
  return {
    ok: true,
    value: updated,
    state: { ...state, appointments: state.appointments.map((a) => (a.id === appointmentId ? updated : a)) },
  };
}

/** Bloque un créneau libre de 30 minutes, ou le débloque s'il l'était déjà. */
export function toggleBlock(
  state: DemoState,
  stylistId: string,
  date: IsoDate,
  start: HourMinute,
  now: Date,
): ActionResult<"bloque" | "debloque"> {
  const existing = state.blocks.find((b) => b.stylistId === stylistId && b.date === date && b.start === start);
  if (existing) {
    return { ok: true, value: "debloque", state: { ...state, blocks: state.blocks.filter((b) => b.id !== existing.id) } };
  }
  const stylist = getStylist(stylistId);
  if (!stylist || !isValidIsoDate(date) || !dayGrid().includes(start)) {
    return { ok: false, reason: "donnees_invalides", message: "Créneau invalide." };
  }
  if (!worksOn(stylist, date)) {
    return { ok: false, reason: "jour_non_travaille", message: `${stylist.name} ne travaille pas ce jour-là.` };
  }
  if (isPast(date, start, now)) {
    return { ok: false, reason: "creneau_passe", message: "Impossible de bloquer un créneau déjà passé." };
  }
  const t = toMinutes(start);
  const busy = state.appointments.some(
    (a) => isActive(a) && a.stylistId === stylistId && a.date === date && overlaps(t, t + STEP, toMinutes(a.start), toMinutes(a.start) + a.durationMin),
  );
  if (busy) {
    return { ok: false, reason: "deja_reserve", message: "Un rendez-vous occupe déjà ce créneau : annulez-le d'abord." };
  }
  const block: Block = { id: generateId(), stylistId, date, start };
  return { ok: true, value: "bloque", state: { ...state, blocks: [...state.blocks, block] } };
}

/* ------------------------------------------------------------------ */
/* Indicateurs                                                         */
/* ------------------------------------------------------------------ */

export function dayStats(state: DemoState, date: IsoDate) {
  const all = state.appointments.filter((a) => a.date === date);
  const active = all.filter(isActive);
  const booked = active.reduce((sum, a) => sum + a.durationMin, 0);
  const capacity = STYLISTS.filter((s) => worksOn(s, date)).length * (CLOSE - OPEN);
  return {
    total: active.length,
    pending: active.filter((a) => a.status === "en_attente").length,
    cancelled: all.length - active.length,
    revenueFcfa: active.reduce((sum, a) => sum + a.priceFcfa, 0),
    blocks: state.blocks.filter((b) => b.date === date).length,
    occupancy: capacity === 0 ? 0 : Math.round((booked / capacity) * 100),
  };
}
