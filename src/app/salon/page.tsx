import { Suspense } from "react";
import { isValidIsoDate, todayIso } from "@/lib/time";
import { ctxDe, exigerPage } from "@/server/auth";
import { demandesEnAttente, journee, parametresSalon } from "@/server/salon/service";
import { EcranSalon } from "./EcranSalon";
import { ChargementListe } from "./ui";

export default function PageSalon({ searchParams }: { searchParams: Promise<{ jour?: string }> }) {
  return (
    <Suspense fallback={<ChargementListe />}>
      <Donnees searchParams={searchParams} />
    </Suspense>
  );
}

async function Donnees({ searchParams }: { searchParams: Promise<{ jour?: string }> }) {
  const { jour: jourDemande } = await searchParams;
  const u = await exigerPage();
  const now = new Date();
  const aujourdhui = todayIso(now);
  const ctx = ctxDe(u);
  const jour = jourDemande && isValidIsoDate(jourDemande) ? jourDemande : aujourdhui;
  const [j, demandes, salon] = await Promise.all([journee(ctx, jour, now), demandesEnAttente(ctx), parametresSalon(ctx)]);
  return <EcranSalon journee={j} aujourdhui={aujourdhui} demandes={demandes} salonNom={salon.nom} />;
}
