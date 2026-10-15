"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/Button";
import { connexionAdminAction } from "../actions";

const champ = "h-12 rounded-2xl border border-trait bg-white px-4 text-base focus:border-or focus:ring-4 focus:ring-or/15 focus:outline-none";

export function FormulaireConnexionAdmin() {
  const [etat, action, enCours] = useActionState(connexionAdminAction, null);
  return (
    <form action={action} className="mt-5 flex flex-col gap-4">
      <label className="flex flex-col gap-1.5 text-sm font-medium text-encre">
        Identifiant
        <input name="identifiant" autoComplete="username" autoCapitalize="none" required className={champ} />
      </label>
      <label className="flex flex-col gap-1.5 text-sm font-medium text-encre">
        Mot de passe
        <input name="motDePasse" type="password" autoComplete="current-password" required className={champ} />
      </label>
      {etat?.erreur && (
        <p role="alert" className="rounded-xl bg-rouge-pale px-3 py-2 text-sm text-rouge">
          {etat.erreur}
        </p>
      )}
      <Button type="submit" variant="mia" size="lg" loading={enCours}>
        Se connecter
      </Button>
    </form>
  );
}
