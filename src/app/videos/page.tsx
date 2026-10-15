import type { Metadata } from "next";
import { metadonneesSalon } from "../_salon/metadonnees";
import { SALON_PUBLIC } from "@/server/salon/public-config";
import { VideosSalon } from "../_salon/Videos";


export function generateMetadata(): Promise<Metadata> {
  return metadonneesSalon(SALON_PUBLIC, "Vidéos");
}

export default function PageVideos() {
  return <VideosSalon slug={SALON_PUBLIC} base="" />;
}
