import type { Metadata } from "next";
import { Suspense } from "react";
import { ctxDe, exigerPage } from "@/server/auth";
import { derniersAvis, listerEquipe, parametresSalon } from "@/server/salon/service";
import { ChargementListe } from "../ui";
import { GestionEquipe } from "./GestionEquipe";

export const metadata: Metadata = { title: "Équipe" };

export default function PageEquipe() {
  return (
    <Suspense fallback={<ChargementListe />}>
      <Donnees />
    </Suspense>
  );
}

async function Donnees() {
  const u = await exigerPage(["gerante"]);
  const ctx = ctxDe(u);
  const [{ coiffeuses, categories }, salon, avis] = await Promise.all([listerEquipe(ctx), parametresSalon(ctx), derniersAvis(ctx)]);
  return <GestionEquipe coiffeuses={coiffeuses} categories={categories} whatsappSalon={salon.whatsapp} avis={avis} />;
}
