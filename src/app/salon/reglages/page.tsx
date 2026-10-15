import type { Metadata } from "next";
import { Suspense } from "react";
import { ctxDe, exigerPage } from "@/server/auth";
import { lireReglages } from "@/server/salon/service";
import { ChargementListe } from "../ui";
import { ReglagesSalon } from "./ReglagesSalon";

export const metadata: Metadata = { title: "Réglages" };

export default function PageReglages() {
  return (
    <Suspense fallback={<ChargementListe />}>
      <Donnees />
    </Suspense>
  );
}

async function Donnees() {
  const u = await exigerPage(["gerante"]);
  const reglages = await lireReglages(ctxDe(u));
  return <ReglagesSalon reglages={reglages} />;
}
