import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import { ToastProvider } from "@/components/ui/Toast";
import "./globals.css";

const poppins = localFont({
  variable: "--font-poppins",
  display: "swap",
  src: [
    { path: "./fonts/Poppins-Light.ttf", weight: "300" },
    { path: "./fonts/Poppins-Regular.ttf", weight: "400" },
    { path: "./fonts/Poppins-Medium.ttf", weight: "500" },
    { path: "./fonts/Poppins-Bold.ttf", weight: "700" },
  ],
});

const cormorant = localFont({
  variable: "--font-cormorant",
  display: "swap",
  src: [
    { path: "./fonts/CormorantGaramond-SemiBold.ttf", weight: "600" },
    { path: "./fonts/CormorantGaramond-Bold.ttf", weight: "700" },
  ],
});

export const metadata: Metadata = {
  title: { default: "La Coquette du Faso — Réservation", template: "%s · La Coquette du Faso" },
  description: "Démonstration de l'application de réservation du salon La Coquette du Faso, Ouagadougou.",
  icons: { icon: "/brand/logo.png" },
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
