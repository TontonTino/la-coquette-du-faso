/**
 * Salon historique (La Coquette du Faso par défaut) : ses anciennes adresses « /reserver », « /videos » et « /realisations »
 * redirigent vers « /s/<identifiant> » (voir next.config.ts). La racine du site (« / ») est la page de la plateforme MIA.
 */
export const SALON_PUBLIC = process.env.SALON_SLUG ?? "la-coquette-du-faso";

/** Début des adresses d'un salon : toujours « /s/<identifiant> ». */
export const baseDuSalon = (slug: string) => `/s/${slug}`;
