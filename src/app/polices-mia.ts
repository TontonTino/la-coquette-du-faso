import localFont from "next/font/local";

/**
 * Polices de la marque MIA (écrans de la plateforme : connexion, espace MIA) : Syne pour les titres,
 * Plus Jakarta Sans pour le texte et l'interface. Les pages publiques des salons gardent leurs propres polices.
 * Licences : SIL Open Font License 1.1.
 */
const syne = localFont({
  variable: "--font-syne",
  display: "swap",
  src: [
    { path: "./fonts/Syne-SemiBold.woff2", weight: "600" },
    { path: "./fonts/Syne-Bold.woff2", weight: "700" },
  ],
});

const jakarta = localFont({
  variable: "--font-jakarta",
  display: "swap",
  src: [
    { path: "./fonts/PlusJakartaSans-Regular.woff2", weight: "400" },
    { path: "./fonts/PlusJakartaSans-Medium.woff2", weight: "500" },
    { path: "./fonts/PlusJakartaSans-Bold.woff2", weight: "700" },
  ],
});

/** À poser sur le conteneur d'un écran MIA : charge les polices et applique `.marque-mia` (voir globals.css). */
export const classeMarqueMia = `marque-mia ${syne.variable} ${jakarta.variable}`;
