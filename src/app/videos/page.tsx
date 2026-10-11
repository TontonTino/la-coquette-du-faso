import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { FilVideos } from "@/components/public/FilVideos";
import { SALON_PUBLIC } from "@/server/salon/public-config";
import { salonPublic } from "@/server/salon/service";

export const metadata: Metadata = { title: "Vidéos" };

export default function PageVideos() {
  return (
    <main className="min-h-dvh bg-noir">
      <Suspense fallback={<div className="h-dvh" />}>
        <Contenu />
      </Suspense>
    </main>
  );
}

async function Contenu() {
  await connection(); // données à jour à chaque visite
  const salon = await salonPublic(SALON_PUBLIC);
  if (!salon || salon.videos.length === 0) {
    return (
      <div className="flex h-dvh flex-col items-center justify-center gap-5 px-6 text-center text-white">
        <p className="font-display text-3xl font-bold">Pas encore de vidéo</p>
        <p className="max-w-xs text-sm text-white/70">Le salon n&apos;a pas encore publié de vidéo. Revenez bientôt !</p>
        <Link href="/" className="rounded-full border border-or/60 px-5 py-3 text-sm font-medium text-or">
          Retour à l&apos;accueil
        </Link>
      </div>
    );
  }
  return <FilVideos videos={salon.videos.slice(0, 30)} modeles={salon.modeles} />;
}
