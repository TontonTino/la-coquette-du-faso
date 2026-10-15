import type { Metadata } from "next";
import { metadonneesSalon } from "../_salon/metadonnees";
import { SALON_PUBLIC } from "@/server/salon/public-config";
import { RealisationsSalon } from "../_salon/Realisations";


export function generateMetadata(): Promise<Metadata> {
  return metadonneesSalon(SALON_PUBLIC, "Nos réalisations");
}

export default function PageRealisations() {
  return <RealisationsSalon slug={SALON_PUBLIC} base="" />;
}
