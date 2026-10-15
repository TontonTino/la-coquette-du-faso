import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import { ToastProvider } from "@/components/ui/Toast";
import "./globals.css";

const poppins = localFont({
  variable: "--font-poppins",
  display: "swap",
  src: [
    // Versions WOFF2 réduites à l'alphabet latin (mêmes dessins que les .ttf d'origine, ~15 fois plus légères).
    // Poppins Light (300) n'est utilisé nulle part : il n'est plus chargé.
    { path: "./fonts/Poppins-Regular.woff2", weight: "400" },
    { path: "./fonts/Poppins-Medium.woff2", weight: "500" },
    { path: "./fonts/Poppins-Bold.woff2", weight: "700" },
  ],
});

const cormorant = localFont({
  variable: "--font-cormorant",
  display: "swap",
  src: [
    { path: "./fonts/CormorantGaramond-SemiBold.woff2", weight: "600" },
    { path: "./fonts/CormorantGaramond-Bold.woff2", weight: "700" },
  ],
});

export const metadata: Metadata = {
  title: { default: "MIA — Réservation pour salons de coiffure", template: "%s · MIA" },
  description: "MIA : l'application de réservation des salons de coiffure et de beauté, Ouagadougou.",
  // Demande aux moteurs de recherche de ne pas indexer la démo. Ce n'est PAS un contrôle d'accès :
  // les pages restent lisibles par toute personne qui connaît l'adresse.
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  themeColor: "#0A0A0A",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="fr" className={`${poppins.variable} ${cormorant.variable} h-full antialiased`}>
      <body className="min-h-full font-sans">
        <ToastProvider>{children}</ToastProvider>
      </body>
    </html>
  );
}
