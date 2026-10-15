import type { Metadata } from "next";
import { metadonneesSalon } from "./_salon/metadonnees";
import { SALON_PUBLIC } from "@/server/salon/public-config";
import { AccueilSalon } from "./_salon/Accueil";


export function generateMetadata(): Promise<Metadata> {
  return metadonneesSalon(SALON_PUBLIC, "Demander un rendez-vous");
}

export default function Accueil() {
  return <AccueilSalon slug={SALON_PUBLIC} base="" />;
}
