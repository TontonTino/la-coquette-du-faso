import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { FilVideos } from "@/components/public/FilVideos";
import { salonPublic } from "@/server/salon/service";

export function VideosSalon({ slug, base }: { slug: string; base: string }) {
  return (
    <main className="min-h-dvh bg-noir">
      <Suspense fallback={<div className="h-dvh" />}>
        <Contenu slug={slug} base={base} />
      </Suspense>
    </main>
  );
}

async function Contenu({ slug, base }: { slug: string; base: string }) {
  await connection(); // données à jour à chaque visite
  const salon = await salonPublic(slug);
  if (!salon || salon.videos.length === 0) {
    return (
      <div className="flex h-dvh flex-col items-center justify-center gap-5 px-6 text-center text-white">
        <p className="font-display text-3xl font-bold">Pas encore de vidéo</p>
        <p className="max-w-xs text-sm text-white/70">Le salon n&apos;a pas encore publié de vidéo. Revenez bientôt !</p>
        <Link href={base || "/"} className="rounded-full border border-or/60 px-5 py-3 text-sm font-medium text-or">
          Retour à l&apos;accueil
        </Link>
      </div>
    );
  }
  return <FilVideos videos={salon.videos.slice(0, 30)} modeles={salon.modeles} base={base} />;
}
