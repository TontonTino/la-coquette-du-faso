import type { Metadata } from "next";
import { Suspense } from "react";
import { exigerAdminPage } from "@/server/admin";
import { EnteteAdmin } from "../Entete";
import { FormulaireSalon } from "../FormulaireSalon";

export const metadata: Metadata = { title: "Nouveau salon" };

export default function PageNouveauSalon() {
  return (
    <>
      <EnteteAdmin retour={{ href: "/admin", libelle: "← Salons" }} />
      <main className="mx-auto max-w-xl px-4 py-6 pb-16">
        <h1 className="mb-1 font-display text-3xl leading-none font-bold">Nouveau salon</h1>
        <p className="mb-5 text-sm text-sourdine">Le salon est créé vide et propre : ni coiffeuse, ni modèle, ni fausse donnée.</p>
        <Suspense fallback={<p className="text-sm text-sourdine">Chargement…</p>}>
          <Formulaire />
        </Suspense>
      </main>
    </>
  );
}

async function Formulaire() {
  await exigerAdminPage();
  return <FormulaireSalon />;
}
