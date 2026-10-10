import type { Metadata } from "next";
import { Availability } from "./Availability";

export const metadata: Metadata = { title: "Disponibilités" };

export default function DisponibilitesPage() {
  return <Availability />;
}
