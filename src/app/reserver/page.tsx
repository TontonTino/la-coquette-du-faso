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
      <h1 className="font-display text-3xl font-bold">Demander un rendez-vous</h1>
      <p className="mt-1 text-sm text-sourdine">Le salon vous confirme l&apos;heure exacte sur WhatsApp.</p>
      <Suspense fallback={<div className="mt-6 h-96 animate-pulse rounded-2xl bg-white" />}>
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
  return <FormulaireDemande salon={salon} aujourdhui={todayIso()} typeInitial={type} modeleInitial={modele} />;
}
