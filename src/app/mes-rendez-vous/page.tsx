import type { Metadata } from "next";
import { MyAppointments } from "./MyAppointments";

export const metadata: Metadata = { title: "Mes rendez-vous" };

export default function MesRendezVousPage() {
  return <MyAppointments />;
}
