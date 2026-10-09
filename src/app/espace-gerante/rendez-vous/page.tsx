import type { Metadata } from "next";
import { ManagerAppointments } from "./ManagerAppointments";

export const metadata: Metadata = { title: "Rendez-vous" };

export default function GeranteRendezVousPage() {
  return <ManagerAppointments />;
}
