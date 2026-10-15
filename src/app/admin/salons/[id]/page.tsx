import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { Carte } from "@/app/salon/ui";
import { exigerAdminPage } from "@/server/admin";
import { db } from "@/server/db";
import { salonAdmin } from "@/server/salon/admin-salons";
import { EnteteAdmin } from "../../Entete";
import { FormulaireSalon } from "../../FormulaireSalon";
import { ReinitialiserMotDePasse } from "./ReinitialiserMotDePasse";

export const metadata: Metadata = { title: "Régler un salon" };

export default function PageSalonAdmin({ params }: PageProps<"/admin/salons/[id]">) {
  return (
    <>
      <EnteteAdmin retour={{ href: "/admin", libelle: "← Salons" }} />
      <main className="mx-auto max-w-xl px-4 py-6 pb-16">
        <Suspense fallback={<p className="text-sm text-sourdine">Chargement…</p>}>
          <Contenu params={params} />
        </Suspense>
      </main>
    </>
  );
}

async function Contenu({ params }: { params: PageProps<"/admin/salons/[id]">["params"] }) {
  await exigerAdminPage();
  const { id } = await params;
  const salon = await salonAdmin(db(), id);
  if (!salon) notFound();
  return (
    <>
      <h1 className="font-display text-3xl leading-none font-bold">{salon.nom}</h1>
      <p className="mt-1 mb-5 text-sm text-sourdine">
        <Link href={`/s/${salon.slug}`} className="underline underline-offset-4">
          /s/{salon.slug}
        </Link>
        {salon.services.length > 0 && <> · {salon.services.map((s) => s.nom).join(", ")}</>}
      </p>
      <FormulaireSalon salon={salon} />
      <Carte className="mt-6">
        <h2 className="mb-1 text-[15px] font-semibold">Accès du personnel</h2>
        <p className="mb-3 text-xs text-sourdine">
          Comptes : {salon.comptes.map((c) => `${c.identifiant}${c.actif ? "" : " (désactivé)"}`).join(", ")}. Les mots de passe ne sont pas lisibles : on peut seulement en générer de nouveaux.
        </p>
        <div className="flex flex-col gap-3">
          <ReinitialiserMotDePasse salonId={salon.id} role="gerante" libelle="la gérante" />
          <ReinitialiserMotDePasse salonId={salon.id} role="secretaire" libelle="la secrétaire" />
        </div>
      </Carte>
    </>
  );
}
