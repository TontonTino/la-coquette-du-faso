import type { Metadata } from "next";
import { TeamOverview } from "./TeamOverview";

export const metadata: Metadata = { title: "Équipe" };

export default function GeranteEquipePage() {
  return <TeamOverview />;
}
