"use client";

import { useState, useTransition } from "react";
import { Alerte } from "@/components/public/formulaire";
import { Button } from "@/components/ui/Button";
import { payerAcompteAction } from "./actions";

/** Bouton « Payer l'acompte » : crée la facture côté serveur puis envoie la cliente sur la page de paiement PayDunya. */
export function PayerAcompte({ reference, libelle }: { reference: string; libelle: string }) {
  const [enCours, demarrer] = useTransition();
  const [erreur, setErreur] = useState<string | null>(null);
  const [redirection, setRedirection] = useState(false);

  function payer() {
    setErreur(null);
    demarrer(async () => {
      const r = await payerAcompteAction(reference);
      if (r.ok) {
        setRedirection(true);
        window.location.assign(r.valeur.url);
      } else {
        setErreur(r.erreur);
      }
    });
  }

  return (
    <div className="mt-3">
      <Button variant="action" size="md" className="w-full" onClick={payer} loading={enCours || redirection}>
        {redirection ? "Redirection vers le paiement…" : libelle}
      </Button>
      {erreur && (
        <div className="mt-3">
          <Alerte ton="erreur">{erreur}</Alerte>
        </div>
      )}
    </div>
  );
}
