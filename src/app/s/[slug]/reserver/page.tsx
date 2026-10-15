import type { Metadata } from "next";
import { Suspense } from "react";
import { metadonneesSalon } from "../../../_salon/metadonnees";
import { ReserverSalon } from "../../../_salon/Reserver";
import { Attente } from "../../Attente";
import { exigerSalon } from "../../slug";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  return metadonneesSalon(slug, "Réserver un rendez-vous");
}

export default function PageReserverSalon({ params, searchParams }: PageProps<"/s/[slug]/reserver">) {
  return (
    <Suspense fallback={<Attente fond="bg-lin" />}>
      <Contenu params={params} searchParams={searchParams} />
    </Suspense>
  );
}

async function Contenu({ params, searchParams }: { params: PageProps<"/s/[slug]/reserver">["params"]; searchParams: PageProps<"/s/[slug]/reserver">["searchParams"] }) {
  const { slug } = await params;
  await exigerSalon(slug);
  return <ReserverSalon slug={slug} base={`/s/${slug}`} searchParams={searchParams} />;
}
