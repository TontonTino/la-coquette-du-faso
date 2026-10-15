import type { Metadata } from "next";
import { metadonneesSalon } from "../_salon/metadonnees";
import { SALON_PUBLIC } from "@/server/salon/public-config";
import { ReserverSalon } from "../_salon/Reserver";


export function generateMetadata(): Promise<Metadata> {
  return metadonneesSalon(SALON_PUBLIC, "Demander un rendez-vous");
}

export default function PageReserver({ searchParams }: PageProps<"/reserver">) {
  return <ReserverSalon slug={SALON_PUBLIC} base="" searchParams={searchParams} />;
}
