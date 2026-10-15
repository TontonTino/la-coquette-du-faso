"use client";

import { useActionState } from "react";
import { IdentifiantsAffiches } from "@/app/admin/IdentifiantsAffiches";
import { reinitialiserMotDePasseAction } from "@/app/admin/actions";
import { Button } from "@/components/ui/Button";

export function ReinitialiserMotDePasse({ salonId, role, libelle }: { salonId: string; role: "gerante" | "secretaire"; libelle: string }) {
  const [etat, action, enCours] = useActionState(reinitialiserMotDePasseAction, null);
  return (
    <div className="flex flex-col gap-3">
      <form
        action={action}
        onSubmit={(e) => {
          if (!window.confirm(`Générer un nouveau mot de passe pour ${libelle} ? L'ancien ne marchera plus et elle sera déconnectée.`)) e.preventDefault();
        }}
      >
        <input type="hidden" name="id" value={salonId} />
        <input type="hidden" name="role" value={role} />
        <Button type="submit" variant="contour" size="md" loading={enCours}>
          Nouveau mot de passe : {libelle}
        </Button>
      </form>
      {etat?.erreur && (
        <p role="alert" className="text-sm text-rouge">
          {etat.erreur}
        </p>
      )}
      {etat?.compte && <IdentifiantsAffiches comptes={[{ role, ...etat.compte }]} titre={`Nouveau mot de passe : ${libelle}`} />}
    </div>
  );
}
