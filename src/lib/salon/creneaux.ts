/**
 * Créneaux libres d'un salon : fonctions pures (aucun accès base), testées une à une.
 * Un créneau est proposé quand le salon est ouvert, que la prestation tient avant la fermeture, et qu'au moins une
 * coiffeuse disponible est libre, y compris le temps de pause avant et après ses autres clientes.
 */
export const PAS_CRENEAU = 15;
export const PAUSE_MAX = 120;

/** Heures d'ouverture d'un jour, en minutes depuis minuit. */
export interface HoraireJour {
  ouvreMin: number;
  fermeMin: number;
}

/** Plage déjà prise par une cliente, en minutes depuis minuit du jour concerné. */
export interface Occupation {
  debutMin: number;
  finMin: number;
}

export interface CoiffeuseLibre {
  id: string;
  occupations: Occupation[];
}

export interface Creneau {
  /** « HH:MM » */
  heure: string;
  /** Coiffeuses libres sur ce créneau, pause comprise. */
  coiffeuseIds: string[];
}

export const heureDepuisMinutes = (m: number) => `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;

export function minutesDepuisHeure(h: string): number | null {
  const m = /^(\d{2}):(\d{2})$/.exec(h);
  if (!m) return null;
  const [hh, mm] = [Number(m[1]), Number(m[2])];
  return hh <= 24 && mm <= 59 && hh * 60 + mm <= 1440 ? hh * 60 + mm : null;
}

/** Vrai si la plage [debut, fin[ gêne l'occupation une fois la pause ajoutée de chaque côté. */
export const gene = (debut: number, fin: number, o: Occupation, pause: number) => debut < o.finMin + pause && o.debutMin - pause < fin;

export function creneauxLibres(p: {
  horaire: HoraireJour | null;
  dureeMin: number;
  pauseMin: number;
  coiffeuses: CoiffeuseLibre[];
  /** Minutes depuis minuit déjà écoulées aujourd'hui (pour ne pas proposer le passé) ; absent pour un autre jour. */
  maintenantMin?: number;
}): Creneau[] {
  if (!p.horaire || p.dureeMin <= 0) return [];
  const sortie: Creneau[] = [];
  for (let debut = p.horaire.ouvreMin; debut + p.dureeMin <= p.horaire.fermeMin; debut += PAS_CRENEAU) {
    if (p.maintenantMin !== undefined && debut < p.maintenantMin) continue;
    const libres = p.coiffeuses.filter((c) => c.occupations.every((o) => !gene(debut, debut + p.dureeMin, o, p.pauseMin))).map((c) => c.id);
    if (libres.length > 0) sortie.push({ heure: heureDepuisMinutes(debut), coiffeuseIds: libres });
  }
  return sortie;
}

/* ---------------- Saisie des horaires par la gérante ---------------- */

export interface HoraireSaisi {
  /** 0 = dimanche … 6 = samedi */
  jour: number;
  ouvert: boolean;
  ouvre: string;
  ferme: string;
}

export const JOURS_SEMAINE = ["Dimanche", "Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi"];

/** Message d'erreur lisible, ou null si les horaires et la pause sont valides. */
export function verifierHoraires(jours: HoraireSaisi[], pauseMin: number): string | null {
  if (!Number.isInteger(pauseMin) || pauseMin < 0 || pauseMin > PAUSE_MAX || pauseMin % 5 !== 0) return `La pause entre deux clientes va de 0 à ${PAUSE_MAX} minutes, par pas de 5.`;
  if (jours.length !== 7 || new Set(jours.map((j) => j.jour)).size !== 7 || jours.some((j) => !Number.isInteger(j.jour) || j.jour < 0 || j.jour > 6)) return "Les horaires doivent couvrir les sept jours.";
  if (!jours.some((j) => j.ouvert)) return "Le salon doit être ouvert au moins un jour.";
  for (const j of jours.filter((x) => x.ouvert)) {
    const [o, f] = [minutesDepuisHeure(j.ouvre), minutesDepuisHeure(j.ferme)];
    const nom = JOURS_SEMAINE[j.jour];
    if (o === null || f === null) return `${nom} : heure invalide.`;
    if (o >= 1440 || f <= o) return `${nom} : la fermeture doit être après l'ouverture.`;
    if (f - o < 30) return `${nom} : le salon doit rester ouvert au moins 30 minutes.`;
  }
  return null;
}

/** Durée (30 min à 12 h, par pas de 15) et prix (FCFA) d'un service ; null = pas encore réglé. */
export function verifierService(s: { dureeMin: number | null; prix: number | null }): string | null {
  if (s.dureeMin !== null && (!Number.isInteger(s.dureeMin) || s.dureeMin < 30 || s.dureeMin > 720 || s.dureeMin % 15 !== 0)) return "La durée va de 30 min à 12 h, par pas de 15 min.";
  if (s.prix !== null && (!Number.isInteger(s.prix) || s.prix < 0 || s.prix > 1_000_000)) return "Prix invalide (en FCFA, nombre entier).";
  return null;
}
