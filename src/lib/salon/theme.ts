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

const CLES_THEME = ["marque", "action", "actionFort", "actionTexte", "accentTexte", "accentPale", "detail"] as const;
const COULEUR = /^#[0-9a-f]{6}$/i;

/** Ne garde de la base que des couleurs « #rrggbb » connues : tout le reste est ignoré. */
export function lireSurchargeTheme(brut: unknown): Partial<ThemeSalon> {
  if (!brut || typeof brut !== "object" || Array.isArray(brut)) return {};
  const sortie: Partial<ThemeSalon> = {};
  for (const cle of CLES_THEME) {
    const v = (brut as Record<string, unknown>)[cle];
    if (typeof v === "string" && COULEUR.test(v)) sortie[cle] = v.toLowerCase();
  }
  return sortie;
}

/**
 * Thème d'un salon : défaut, puis surcharges du code, puis surcharges enregistrées en base.
 * Si les couleurs de la base ne respectent pas les contrastes, elles sont écartées (lisibilité d'abord).
 */
export function themeDuSalon(slug: string, depuisBase?: unknown): ThemeSalon {
  const base = { ...THEME_PAR_DEFAUT, ...THEMES[slug] };
  const candidat = { ...base, ...lireSurchargeTheme(depuisBase) };
  return verifierTheme(candidat).length === 0 ? candidat : base;
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

/* ---- Thème à partir de trois couleurs (formulaire de l'espace MIA) ---- */

const versHex = (n: number) => Math.round(Math.min(255, Math.max(0, n))).toString(16).padStart(2, "0");
function melanger(hex: string, avec: [number, number, number], part: number): string {
  const h = hex.replace("#", "");
  return "#" + [0, 2, 4].map((i, k) => versHex(parseInt(h.slice(i, i + 2), 16) * (1 - part) + avec[k] * part)).join("");
}

/**
 * Trois couleurs choisies par l'opérateur → thème complet : le survol du bouton est la couleur d'action assombrie,
 * le fond de sélection est la couleur d'action très éclaircie. Chaque couleur est facultative (défaut = thème MIA).
 * Les contrastes sont vérifiés ensuite par `verifierTheme` : un choix illisible est refusé avec un message clair.
 */
export function themeDepuisCouleurs(c: { marque?: string; action?: string; detail?: string }): Partial<ThemeSalon> {
  const t: Partial<ThemeSalon> = {};
  const ok = (v?: string) => (v && /^#[0-9a-f]{6}$/i.test(v) ? v.toLowerCase() : undefined);
  const marque = ok(c.marque);
  const action = ok(c.action);
  const detail = ok(c.detail);
  if (marque) t.marque = marque;
  if (detail) t.detail = detail;
  if (action) {
    t.action = action;
    t.actionFort = melanger(action, [0, 0, 0], 0.1);
    t.accentTexte = action;
    t.accentPale = melanger(action, [255, 255, 255], 0.9);
  }
  return t;
}
