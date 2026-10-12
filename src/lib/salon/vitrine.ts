/**
 * Page d'accueil d'un salon : textes et photos propres à chaque salon, rien de plus.
 * La structure, la typographie, les couleurs « par rôle » (voir theme.ts) et l'accessibilité sont communes.
 *
 * Ajouter un salon = ajouter une entrée dans VITRINES (clé : identifiant du salon).
 * Chaque photo est facultative : une section sans photo disparaît ou se présente sans image, jamais de trou.
 * Les photos se rangent dans `public/salons/<identifiant>/` ; le texte alternatif décrit ce que l'on voit.
 */
export interface PhotoVitrine {
  src: string;
  alt: string;
  largeur: number;
  hauteur: number;
  /** Cadrage lorsque la photo est recadrée (ex. « 50% 40% »). */
  cadrage?: string;
}

export interface Vitrine {
  /** Titre de la couverture ; le mot entre `*` est mis en valeur. */
  titre: string;
  /** Petite ligne au-dessus du titre. */
  etiquette: string;
  accroche: string;
  couverture: PhotoVitrine | null;
  /** Section « Le salon ». */
  salon: { titre: string; texte: string; equipe: PhotoVitrine | null; portraits: PhotoVitrine[] } | null;
  facade: PhotoVitrine | null;
  /** Photos de coiffures réalisées par le salon (autorisations confirmées par la gérante). */
  realisations: PhotoVitrine[];
  /** Illustration de la carte de chaque famille de services (sans photo : aplat de couleur). */
  familles: Partial<Record<"coiffure" | "ongles", PhotoVitrine | null>>;
}

const DOSSIER = "/salons/la-coquette-du-faso";
const photo = (nom: string, alt: string, largeur: number, hauteur: number, cadrage?: string): PhotoVitrine => ({ src: `${DOSSIER}/${nom}`, alt, largeur, hauteur, cadrage });

const REALISATIONS: PhotoVitrine[] = [
  photo("realisation-1.webp", "Coiffure tressée en motif, vue de dos, dans le salon", 546, 725),
  photo("realisation-2.webp", "Longues tresses fines, cliente souriante", 546, 728),
  photo("realisation-3.webp", "Queue haute en tresses collées, vue de dos", 545, 724),
  photo("realisation-4.webp", "Chignon haut sur tresses collées, vue de dos", 545, 729),
  photo("realisation-5.webp", "Chignon sur tresses en motif, vue de dos", 545, 725),
  photo("realisation-6.webp", "Coiffure sculptée en motif, vue de profil", 545, 726),
  photo("realisation-7.webp", "Coiffure en nœuds bantous, cliente souriante", 546, 729),
  photo("realisation-8.webp", "Longues twists torsadées, cliente souriante", 548, 725),
];

export const VITRINE_PAR_DEFAUT: Vitrine = {
  titre: "Là où vous vous sentez *belle*",
  etiquette: "Salon de beauté",
  accroche: "Choisissez votre coiffure et demandez votre rendez-vous en une minute. Le salon vous confirme l'heure sur WhatsApp.",
  couverture: null,
  salon: null,
  facade: null,
  realisations: [],
  familles: {},
};

export const VITRINES: Record<string, Partial<Vitrine>> = {
  "la-coquette-du-faso": {
    etiquette: "Coiffure et ongles · Ouagadougou",
    couverture: photo("couverture-interieur.webp", "L'intérieur lumineux du salon La Coquette du Faso : miroirs dorés, fauteuils bleus et coiffeuses au travail", 1037, 1024, "50% 45%"),
    salon: {
      titre: "Derrière chaque coiffure, une équipe",
      texte: "Coiffure et ongles, dans un salon clair et animé où toute l'équipe vous accueille.",
      equipe: photo("equipe-groupe.webp", "Les coiffeuses de La Coquette du Faso réunies devant le salon", 1686, 624),
      portraits: [
        photo("portrait-1.webp", "Une coiffeuse du salon, souriante, avec de longues tresses dorées", 592, 560, "50% 20%"),
        photo("portrait-2.webp", "Une coiffeuse du salon, en tresses collées", 599, 560, "50% 20%"),
        photo("portrait-3.webp", "Une coiffeuse du salon, avec une coiffure afro naturelle", 587, 560, "50% 20%"),
      ],
    },
    facade: photo("facade.webp", "La façade du salon La Coquette du Faso, à Ouagadougou", 896, 1188),
    realisations: REALISATIONS,
    familles: { coiffure: photo("realisation-2.webp", "Longues tresses fines, cliente souriante", 546, 728, "50% 30%") },
  },
};

/** Vitrine d'un salon : ses valeurs, complétées par celles par défaut. */
export function vitrineDuSalon(slug: string): Vitrine {
  return { ...VITRINE_PAR_DEFAUT, ...(VITRINES[slug] ?? {}) };
}
