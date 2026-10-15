import type { Metadata } from "next";
import Link from "next/link";
import { CadreConnexion } from "@/components/brand/CadreConnexion";
import { FormulaireConnexion } from "./FormulaireConnexion";

export const metadata: Metadata = { title: "Connexion" };

export default function PageConnexion() {
  return (
    <CadreConnexion
      sousTitre="Espace salon"
      titre="Connexion"
      aide="Réservé à la gérante et à la secrétaire."
      pied={
        <Link href="/" className="text-sm text-sourdine underline underline-offset-4 hover:text-mia-cacao">
          Retour au site des clientes
        </Link>
      }
    >
      <FormulaireConnexion />
    </CadreConnexion>
  );
}
