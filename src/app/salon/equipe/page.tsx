import type { Metadata } from "next";
import { Suspense } from "react";
import { ctxDe, exigerPage } from "@/server/auth";
import { listerEquipe } from "@/server/salon/service";
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
  const { coiffeuses, categories } = await listerEquipe(ctxDe(u));
  return <GestionEquipe coiffeuses={coiffeuses} categories={categories} />;
}
