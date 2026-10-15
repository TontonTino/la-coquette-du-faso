import type { Metadata } from "next";
import { Suspense } from "react";
import { metadonneesSalon } from "../../../_salon/metadonnees";
import { VideosSalon } from "../../../_salon/Videos";
import { Attente } from "../../Attente";
import { exigerSalon } from "../../slug";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  return metadonneesSalon(slug, "Vidéos");
}

export default function PageVideosSalon({ params }: PageProps<"/s/[slug]/videos">) {
  return (
    <Suspense fallback={<Attente fond="bg-noir" />}>
      <Contenu params={params} />
    </Suspense>
  );
}

async function Contenu({ params }: { params: PageProps<"/s/[slug]/videos">["params"] }) {
  const { slug } = await params;
  await exigerSalon(slug);
  return <VideosSalon slug={slug} base={`/s/${slug}`} />;
}
