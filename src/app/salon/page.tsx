import { Suspense } from "react";
import { todayIso } from "@/lib/time";
import { ctxDe, exigerPage } from "@/server/auth";
import { journee } from "@/server/salon/service";
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
  const j = await journee(ctxDe(u), aujourdhui, now);
  return <EcranSalon journee={j} aujourdhui={aujourdhui} />;
}
