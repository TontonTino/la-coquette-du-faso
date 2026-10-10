import { Suspense } from "react";
import { todayIso } from "@/lib/time";
import { ctxDe, exigerPage } from "@/server/auth";
import { demandesEnAttente, journee, parametresSalon } from "@/server/salon/service";
import { EcranSalon } from "./EcranSalon";
import { ChargementListe } from "./ui";

export default function PageSalon() {
  return (
    <Suspense fallback={<ChargementListe />}>
      <Donnees />
    </Suspense>
  );
}

async function Donnees() {
  const u = await exigerPage();
  const now = new Date();
  const aujourdhui = todayIso(now);
  const ctx = ctxDe(u);
  const [j, demandes, salon] = await Promise.all([journee(ctx, aujourdhui, now), demandesEnAttente(ctx), parametresSalon(ctx)]);
  return <EcranSalon journee={j} aujourdhui={aujourdhui} demandes={demandes} salonNom={salon.nom} />;
}
