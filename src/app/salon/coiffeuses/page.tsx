import type { Metadata } from "next";
import { Suspense } from "react";
import { todayIso } from "@/lib/time";
import { ctxDe, exigerPage } from "@/server/auth";
import { journee } from "@/server/salon/service";
import { ChargementListe } from "../ui";
import { ListeCoiffeuses } from "./ListeCoiffeuses";

export const metadata: Metadata = { title: "Coiffeuses" };

export default function PageCoiffeuses() {
  return (
    <Suspense fallback={<ChargementListe />}>
      <Donnees />
    </Suspense>
  );
}

async function Donnees() {
  const u = await exigerPage();
  const now = new Date();
  const jour = todayIso(now);
  const j = await journee(ctxDe(u), jour, now);
  return <ListeCoiffeuses lignes={j.coiffeuses} compteurs={j.compteurs} jour={jour} />;
}
