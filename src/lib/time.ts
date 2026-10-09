import type { HourMinute, IsoDate } from "./types";

export const TIME_ZONE = "Africa/Ouagadougou";

const NBSP = " ";

const isoFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

const clockFormatter = new Intl.DateTimeFormat("en-GB", {
  timeZone: TIME_ZONE,
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

/** Date du jour à Ouagadougou (AAAA-MM-JJ). */
export function todayIso(now: Date = new Date()): IsoDate {
  return isoFormatter.format(now);
}

/** Minutes écoulées depuis minuit à Ouagadougou. */
export function nowMinutes(now: Date = new Date()): number {
  const [h, m] = clockFormatter.format(now).split(":").map(Number);
  return h * 60 + m;
}

export function toMinutes(time: HourMinute): number {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + m;
}

export function fromMinutes(total: number): HourMinute {
  const h = Math.floor(total / 60);
  const m = total % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

export function isValidIsoDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const d = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === value;
}

export function isValidTime(value: string): boolean {
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(value);
}

function utcDate(date: IsoDate): Date {
  return new Date(`${date}T00:00:00Z`);
}

export function addDays(date: IsoDate, days: number): IsoDate {
  const d = utcDate(date);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** 0 = dimanche … 6 = samedi. */
export function weekday(date: IsoDate): number {
  return utcDate(date).getUTCDay();
}

export function compareDateTime(
  a: { date: IsoDate; start: HourMinute },
  b: { date: IsoDate; start: HourMinute },
): number {
  if (a.date !== b.date) return a.date < b.date ? -1 : 1;
  return toMinutes(a.start) - toMinutes(b.start);
}

// Les dates calendaires sont formatées en UTC : le fuseau de Ouagadougou est
// UTC+0 sans heure d'été, et cela évite tout décalage selon le fuseau de l'appareil.
const longDate = new Intl.DateTimeFormat("fr-FR", {
  timeZone: "UTC",
  weekday: "long",
  day: "numeric",
  month: "long",
  year: "numeric",
});
const mediumDate = new Intl.DateTimeFormat("fr-FR", {
  timeZone: "UTC",
  weekday: "long",
  day: "numeric",
  month: "long",
});
const shortWeekday = new Intl.DateTimeFormat("fr-FR", { timeZone: "UTC", weekday: "short" });
const shortMonth = new Intl.DateTimeFormat("fr-FR", { timeZone: "UTC", month: "short" });

/** « mercredi 23 décembre 2026 » */
export function formatDateLong(date: IsoDate): string {
  return longDate.format(utcDate(date));
}

/** « mercredi 23 décembre » */
export function formatDateMedium(date: IsoDate): string {
  return mediumDate.format(utcDate(date));
}

/** Éléments d'une pastille de date : { jour: « mer. », numero: 23, mois: « déc. » } */
export function dateChip(date: IsoDate) {
  const d = utcDate(date);
  return {
    weekday: shortWeekday.format(d).replace(".", ""),
    day: d.getUTCDate(),
    month: shortMonth.format(d).replace(".", ""),
  };
}

/** Date relative : « Aujourd'hui », « Demain » ou la date moyenne. */
export function formatDateRelative(date: IsoDate, today: IsoDate): string {
  if (date === today) return "Aujourd'hui";
  if (date === addDays(today, 1)) return "Demain";
  if (date === addDays(today, -1)) return "Hier";
  return capitalize(formatDateMedium(date));
}

/** « 15 h 30 », « 9 h » */
export function formatTime(time: HourMinute): string {
  const [h, m] = time.split(":").map(Number);
  return m === 0 ? `${h}${NBSP}h` : `${h}${NBSP}h${NBSP}${String(m).padStart(2, "0")}`;
}

/** « 2 h 30 », « 3 h », « 45 min » */
export function formatDuration(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m}${NBSP}min`;
  if (m === 0) return `${h}${NBSP}h`;
  return `${h}${NBSP}h${NBSP}${String(m).padStart(2, "0")}`;
}

/** « 15 000 FCFA » */
export function formatFcfa(amount: number): string {
  const digits = Math.round(amount)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, NBSP);
  return `${digits}${NBSP}FCFA`;
}

export function capitalize(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}
