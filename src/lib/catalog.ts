import type { Service, Stylist } from "./types";

/**
 * Données de démonstration : prestations, tarifs, équipe et horaires sont
 * fictifs et ne reflètent pas les disponibilités réelles du salon.
 */

export const SALON = {
  name: "La Coquette du Faso",
  city: "Ouagadougou, Burkina Faso",
  /** Horaires de démonstration. */
  openingTime: "08:00",
  closingTime: "19:00",
  /** Jours d'ouverture : lundi (1) à samedi (6). */
  openDays: [1, 2, 3, 4, 5, 6],
  slotStepMin: 30,
} as const;

export const SERVICES: Service[] = [
  {
    id: "tresses-fulani",
    name: "Tresses Fulani",
    durationMin: 150,
    priceFcfa: 15000,
    description: "Tresses fines inspirées de la tradition peule, avec nattes collées sur le devant.",
  },
  {
    id: "braids",
    name: "Braids",
    durationMin: 180,
    priceFcfa: 20000,
    description: "Box braids classiques, longueur et épaisseur au choix.",
  },
  {
    id: "nattes-collees",
    name: "Nattes collées",
    durationMin: 90,
    priceFcfa: 10000,
    description: "Nattes plaquées droites ou en motifs, nettes et durables.",
  },
];

export const STYLISTS: Stylist[] = [
  {
    id: "aicha-k",
    name: "Aïcha K.",
    initials: "AK",
    specialty: "Tresses & Braids",
    bio: "Spécialiste des tresses longues et des braids, attentive à la tenue et au confort du cuir chevelu.",
    serviceIds: ["tresses-fulani", "braids"],
    workDays: [1, 2, 3, 4, 5, 6],
  },
  {
    id: "fatou-s",
    name: "Fatou S.",
    initials: "FS",
    specialty: "Coiffure et tresses",
    bio: "Polyvalente, elle réalise toutes les prestations du salon et conseille sur le choix du style.",
    serviceIds: ["tresses-fulani", "braids", "nattes-collees"],
    workDays: [2, 3, 4, 5, 6],
  },
  {
    id: "salimata-b",
    name: "Salimata B.",
    initials: "SB",
    specialty: "Nattes collées et coiffures",
    bio: "Précise et rapide, elle excelle dans les nattes collées à motifs et les coiffures du quotidien.",
    serviceIds: ["nattes-collees", "tresses-fulani"],
    workDays: [1, 2, 3, 4, 5],
  },
];

const DAY_NAMES = ["dimanche", "lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi"];

export function dayName(day: number): string {
  return DAY_NAMES[day];
}

/** « du lundi au samedi », ou liste des jours si non consécutifs. */
export function formatWorkDays(days: number[]): string {
  const sorted = [...days].sort((a, b) => a - b);
  const consecutive = sorted.every((d, i) => i === 0 || d === sorted[i - 1] + 1);
  if (consecutive && sorted.length > 2) {
    return `du ${dayName(sorted[0])} au ${dayName(sorted[sorted.length - 1])}`;
  }
  return sorted.map(dayName).join(", ");
}

export function getService(id: string): Service | undefined {
  return SERVICES.find((s) => s.id === id);
}

export function getStylist(id: string): Stylist | undefined {
  return STYLISTS.find((s) => s.id === id);
}

export function stylistsForService(serviceId: string): Stylist[] {
  return STYLISTS.filter((s) => s.serviceIds.includes(serviceId));
}

/** Scénario principal présenté à la gérante. */
export const DEMO_SCENARIO = {
  serviceId: "tresses-fulani",
  stylistId: "aicha-k",
  date: "2026-12-23",
  start: "15:30",
} as const;
