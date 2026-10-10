import type { Metadata } from "next";
import { ManagerDashboard } from "./ManagerDashboard";

export const metadata: Metadata = { title: "Tableau de bord" };

export default function EspaceGerantePage() {
  return <ManagerDashboard />;
}
