import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { STYLISTS, formatWorkDays, getService, getStylist } from "@/lib/catalog";
import { capitalize, formatDuration, formatFcfa } from "@/lib/time";
import { ButtonLink } from "@/components/ui/Button";
import { Avatar, Card } from "@/components/ui/primitives";
import { NextAvailability } from "./NextAvailability";

export function generateStaticParams() {
  return STYLISTS.map((s) => ({ id: s.id }));
}

export async function generateMetadata({ params }: PageProps<"/demo/equipe/[id]">): Promise<Metadata> {
  const { id } = await params;
  return { title: getStylist(id)?.name ?? "Experte" };
}

export default async function StylistPage({ params }: PageProps<"/demo/equipe/[id]">) {
  const { id } = await params;
  const stylist = getStylist(id);
  if (!stylist) notFound();

  return (
    <div className="mx-auto max-w-3xl">
      <Link href="/demo/equipe" className="text-sm text-sourdine hover:text-noir">
        ← Toute l&apos;équipe
      </Link>
      <section className="texture-noire mt-3 flex flex-col items-center rounded-3xl px-6 py-8 text-center text-white">
        <Avatar stylist={stylist} size="lg" />
        <h1 className="mt-4 font-display text-4xl font-semibold">{stylist.name}</h1>
        <p className="mt-1 text-sm tracking-wide text-or">{stylist.specialty}</p>
        <p className="mt-4 max-w-md text-sm leading-relaxed text-white/75">{stylist.bio}</p>
        <p className="mt-3 text-xs text-white/50">Présente {formatWorkDays(stylist.workDays)} · profil de démonstration</p>
      </section>

      <NextAvailability stylistId={stylist.id} />

      <h2 className="mt-8 mb-3 font-display text-2xl font-semibold text-noir">Ses prestations</h2>
      <ul className="space-y-3">
        {stylist.serviceIds.map((serviceId) => {
          const service = getService(serviceId)!;
          return (
            <Card as="li" key={service.id} className="flex items-center gap-4 p-4">
              <div className="min-w-0 flex-1">
                <p className="font-display text-xl font-semibold text-noir">{service.name}</p>
                <p className="text-sm text-sourdine">
                  {capitalize(formatDuration(service.durationMin))} · {formatFcfa(service.priceFcfa)}
                </p>
              </div>
              <ButtonLink href={`/demo/reserver?prestation=${service.id}&coiffeuse=${stylist.id}`} size="sm">
                Réserver
              </ButtonLink>
            </Card>
          );
        })}
      </ul>
    </div>
  );
}
