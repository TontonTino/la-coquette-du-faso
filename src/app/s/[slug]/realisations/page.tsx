import type { Metadata } from "next";
import { Suspense } from "react";
import { metadonneesSalon } from "../../../_salon/metadonnees";
import { RealisationsSalon } from "../../../_salon/Realisations";
import { Attente } from "../../Attente";
import { exigerSalon } from "../../slug";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  return metadonneesSalon(slug, "Nos réalisations");
}

export default function PageRealisationsSalon({ params }: PageProps<"/s/[slug]/realisations">) {
  return (
    <Suspense fallback={<Attente fond="bg-lin" />}>
      <Contenu params={params} />
    </Suspense>
  );
}

async function Contenu({ params }: { params: PageProps<"/s/[slug]/realisations">["params"] }) {
  const { slug } = await params;
  await exigerSalon(slug);
  return <RealisationsSalon slug={slug} base={`/s/${slug}`} />;
}
