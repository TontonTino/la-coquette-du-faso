import type { Metadata } from "next";
import { Suspense } from "react";
import { metadonneesSalon } from "../../_salon/metadonnees";
import { AccueilSalon } from "../../_salon/Accueil";
import { Attente } from "../Attente";
import { exigerSalon } from "../slug";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  return metadonneesSalon(slug, "Réserver un rendez-vous");
}

export default function PageSalon({ params }: PageProps<"/s/[slug]">) {
  return (
    <Suspense fallback={<Attente fond="bg-lin" />}>
      <Contenu params={params} />
    </Suspense>
  );
}

async function Contenu({ params }: { params: PageProps<"/s/[slug]">["params"] }) {
  const { slug } = await params;
  await exigerSalon(slug);
  return <AccueilSalon slug={slug} base={`/s/${slug}`} />;
}
