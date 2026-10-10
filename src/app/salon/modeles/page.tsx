import type { Metadata } from "next";
import { Suspense } from "react";
import { ctxDe, exigerPage } from "@/server/auth";
import { listerEquipe, listerModeles } from "@/server/salon/service";
import { ChargementListe } from "../ui";
import { GestionModeles } from "./GestionModeles";

export const metadata: Metadata = { title: "Modèles" };

export default function PageModeles() {
  return (
    <Suspense fallback={<ChargementListe />}>
      <Donnees />
    </Suspense>
  );
}

async function Donnees() {
  const u = await exigerPage(["gerante"]);
  const ctx = ctxDe(u);
  const [modeles, { categories }] = await Promise.all([listerModeles(ctx), listerEquipe(ctx)]);
  return <GestionModeles modeles={modeles} categories={categories} />;
}
