import type { Metadata } from "next";
import { connection } from "next/server";
import { Suspense } from "react";
import { HabillagePublic } from "@/components/public/Habillage";
import { todayIso } from "@/lib/time";
import { SALON_PUBLIC } from "@/server/salon/public-config";
import { salonPublic } from "@/server/salon/service";
import { FormulaireDemande } from "./FormulaireDemande";

export const metadata: Metadata = { title: "Demander un rendez-vous" };

export default function PageReserver({ searchParams }: PageProps<"/reserver">) {
  return (
    <HabillagePublic>
      <h1 className="font-display text-[2.5rem] leading-[0.95] font-bold">
        Demander un <span className="whitespace-nowrap">rendez-vous</span>
      </h1>
      <p className="mt-3 text-sm text-sourdine">Une minute suffit. Le salon vous confirme l&apos;heure exacte sur WhatsApp.</p>
      <Suspense fallback={<div className="mt-6 h-96 animate-pulse rounded-3xl bg-sable" />}>
        <Donnees searchParams={searchParams} />
      </Suspense>
    </HabillagePublic>
  );
}

async function Donnees({ searchParams }: { searchParams: PageProps<"/reserver">["searchParams"] }) {
  await connection();
  const [salon, sp] = await Promise.all([salonPublic(SALON_PUBLIC), searchParams]);
  if (!salon) return <p className="mt-6">Les demandes en ligne ne sont pas encore ouvertes.</p>;
  const type = typeof sp.type === "string" && salon.categories.some((c) => c.id === sp.type) ? sp.type : "";
  const modele = typeof sp.modele === "string" && salon.modeles.some((m) => m.id === sp.modele) ? sp.modele : "";
  const coiffeuse = typeof sp.coiffeuse === "string" && salon.coiffeuses.some((c) => c.id === sp.coiffeuse) ? sp.coiffeuse : "";
  return <FormulaireDemande salon={salon} aujourdhui={todayIso()} typeInitial={type} modeleInitial={modele} coiffeuseInitiale={coiffeuse} />;
}
