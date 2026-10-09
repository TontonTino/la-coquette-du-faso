/** Date calendaire au format AAAA-MM-JJ (heure de Ouagadougou). */
export type IsoDate = string;
/** Heure au format HH:MM (24 h). */
export type HourMinute = string;

export interface Service {
  id: string;
  name: string;
  durationMin: number;
  priceFcfa: number;
  description: string;
}

export interface Stylist {
  id: string;
  name: string;
  initials: string;
  specialty: string;
  bio: string;
  serviceIds: string[];
  /** Jours travaillés : 0 = dimanche … 6 = samedi. */
  workDays: number[];
}

export type AppointmentStatus = "en_attente" | "confirme" | "annule" | "termine";

export type Actor = "cliente" | "coiffeuse" | "gerante";

export interface Appointment {
  id: string;
  reference: string;
  clientName: string;
  clientPhone: string;
  note?: string;
  stylistId: string;
  serviceId: string;
  date: IsoDate;
  start: HourMinute;
  durationMin: number;
  priceFcfa: number;
  status: AppointmentStatus;
  createdAt: string;
  updatedAt: string;
  /** Qui a annulé, le cas échéant. */
  cancelledBy?: Actor;
}

/** Créneau de 30 minutes bloqué par une coiffeuse (pause, absence…). */
export interface Block {
  id: string;
  stylistId: string;
  date: IsoDate;
  start: HourMinute;
}

export interface DemoState {
  version: 1;
  /** Date (Ouagadougou) à laquelle les données de démonstration ont été générées. */
  seededOn: IsoDate;
  appointments: Appointment[];
  blocks: Block[];
  /** Rendez-vous pris depuis l'espace cliente de ce navigateur. */
  myAppointmentIds: string[];
}
