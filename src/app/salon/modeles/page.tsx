import type { Metadata } from "next";
import { Suspense } from "react";
import { ctxDe, exigerPage } from "@/server/auth";
import { listerEquipe, listerModeles, listerVideos } from "@/server/salon/service";
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
  const [modeles, { categories }, videos] = await Promise.all([listerModeles(ctx), listerEquipe(ctx), listerVideos(ctx)]);
  return <GestionModeles modeles={modeles} categories={categories} videos={videos} stockageVideo={Boolean(process.env.BLOB_READ_WRITE_TOKEN)} />;
}
