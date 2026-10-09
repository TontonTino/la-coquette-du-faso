import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { STYLISTS, getStylist } from "@/lib/catalog";
import { StylistWorkspace } from "./StylistWorkspace";

export function generateStaticParams() {
  return STYLISTS.map((s) => ({ id: s.id }));
}

export async function generateMetadata({ params }: PageProps<"/espace-coiffeuse/[id]">): Promise<Metadata> {
  const { id } = await params;
  return { title: `Planning · ${getStylist(id)?.name ?? "Coiffeuse"}` };
}

export default async function StylistSpacePage({ params }: PageProps<"/espace-coiffeuse/[id]">) {
  const { id } = await params;
  if (!getStylist(id)) notFound();
  return <StylistWorkspace stylistId={id} />;
}
