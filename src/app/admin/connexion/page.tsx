import type { Metadata } from "next";
import { CadreConnexion } from "@/components/brand/CadreConnexion";
import { FormulaireConnexionAdmin } from "./FormulaireConnexionAdmin";

export const metadata: Metadata = { title: "Connexion MIA", robots: { index: false, follow: false } };

export default function PageConnexionAdmin() {
  return (
    <CadreConnexion sousTitre="Espace opérateur" titre="Connexion" aide="Réservé à l'équipe MIA : création et réglage des salons.">
      <FormulaireConnexionAdmin />
    </CadreConnexion>
  );
}
