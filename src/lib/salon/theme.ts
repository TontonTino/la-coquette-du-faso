import type { CSSProperties } from "react";

/**
 * Identité visuelle d'un salon sur les pages clientes : quelques couleurs « par rôle », rien de plus.
 * Tout le reste (fond lin, texte encre, succès vert, erreur rouge, typographie, espacements) est commun à
 * tous les salons : c'est ce qui garantit lisibilité et accessibilité, quel que soit le salon.
 *
 * Ajouter un salon = ajouter une entrée dans THEMES (clé : identifiant du salon). Le test `theme.test.ts`
 * refuse tout thème dont les contrastes seraient insuffisants.
 */
export interface ThemeSalon {
  /** Aplats d'identité (bandeaux, pied de page) : doit porter du texte blanc. */
  marque: string;
  /** Bouton principal sur fond clair, et son survol. */
  action: string;
  actionFort: string;
  /** Texte du bouton principal. */
  actionTexte: string;
  /** Prix, liens et mises en valeur sur fond clair. */
  accentTexte: string;
  /** Fond léger d'une sélection (doit porter `accentTexte`). */
  accentPale: string;
  /** Filets et petits détails ; sert aussi de texte sur `marque`. */
  detail: string;
}

/** « Warm beauty, bold digital » : thème de La Coquette du Faso et valeurs par défaut. */
export const THEME_PAR_DEFAUT: ThemeSalon = {
  marque: "#3e2a22",
  action: "#a44e3a",
  actionFort: "#964733",
  actionTexte: "#ffffff",
  accentTexte: "#a44e3a",
  accentPale: "#f3e8da",
  detail: "#c8a44d",
};

/** Surcharges par salon ; un salon absent de la liste reçoit le thème par défaut. */
export const THEMES: Record<string, Partial<ThemeSalon>> = {
  "la-coquette-du-faso": {},
};

export function themeDuSalon(slug: string): ThemeSalon {
  return { ...THEME_PAR_DEFAUT, ...THEMES[slug] };
}

/** Variables CSS à poser sur le conteneur des pages clientes (Tailwind lit `--color-*`). */
export function variablesCss(t: ThemeSalon): CSSProperties {
  return {
    "--color-marque": t.marque,
    "--color-action": t.action,
    "--color-action-fort": t.actionFort,
    "--color-action-texte": t.actionTexte,
    "--color-accent-texte": t.accentTexte,
    "--color-accent-pale": t.accentPale,
    "--color-detail": t.detail,
  } as CSSProperties;
}

/* ---- Contrastes (WCAG 2.2) ---- */

function luminance(hex: string): number {
  const h = hex.replace("#", "");
  const [r, g, b] = [0, 2, 4].map((i) => {
    const c = parseInt(h.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** Rapport de contraste entre deux couleurs « #rrggbb » (1 à 21). */
export function contraste(a: string, b: string): number {
  const [la, lb] = [luminance(a), luminance(b)];
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

const LIN = "#fffdf9";
const BLANC = "#ffffff";
const AA_TEXTE = 4.5;

/** Liste les contrastes insuffisants d'un thème (vide = thème accepté). */
export function verifierTheme(t: ThemeSalon): string[] {
  const exigences: [string, string, string][] = [
    ["texte du bouton principal sur le bouton", t.actionTexte, t.action],
    ["texte du bouton principal sur son survol", t.actionTexte, t.actionFort],
    ["texte d'accent sur le fond de page", t.accentTexte, LIN],
    ["texte d'accent sur fond blanc", t.accentTexte, BLANC],
    ["texte d'accent sur le fond de sélection", t.accentTexte, t.accentPale],
    ["texte blanc sur la couleur de marque", BLANC, t.marque],
    ["détail (texte) sur la couleur de marque", t.detail, t.marque],
  ];
  return exigences.filter(([, a, b]) => contraste(a, b) < AA_TEXTE).map(([nom, a, b]) => `${nom} : ${contraste(a, b).toFixed(2)}:1 (minimum ${AA_TEXTE}:1)`);
}
