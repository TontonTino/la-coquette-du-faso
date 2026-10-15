/** Salon affiché à la racine du site (« / », « /reserver »…). Les autres salons sont sous « /s/<identifiant> ». */
export const SALON_PUBLIC = process.env.SALON_SLUG ?? "la-coquette-du-faso";

/** Début des adresses d'un salon : vide à la racine, « /s/<identifiant> » ailleurs. */
export const baseDuSalon = (slug: string, racine: boolean) => (racine ? "" : `/s/${slug}`);
