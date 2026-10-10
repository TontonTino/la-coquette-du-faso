import type { Metadata } from "next";
import { SERVICES, stylistsForService } from "@/lib/catalog";
import { formatDuration, formatFcfa } from "@/lib/time";
import { ButtonLink } from "@/components/ui/Button";
import { Avatar, Card, PageHeader } from "@/components/ui/primitives";

export const metadata: Metadata = { title: "Prestations" };

export default function PrestationsPage() {
  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader eyebrow="Carte des prestations" title="Prestations & tarifs">
        Tarifs de démonstration, en francs CFA. Le prix final peut varier selon la longueur souhaitée.
      </PageHeader>
      <ul className="space-y-4">
        {SERVICES.map((s) => {
          const experts = stylistsForService(s.id);
          return (
            <Card as="li" key={s.id} className="p-5">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h2 className="font-display text-2xl font-semibold text-noir">{s.name}</h2>
                  <p className="mt-1 text-sm text-sourdine">{s.description}</p>
                </div>
                <div className="shrink-0 text-right">
                  <p className="font-display text-2xl font-bold text-noir">{formatFcfa(s.priceFcfa)}</p>
                  <p className="text-xs text-sourdine">{formatDuration(s.durationMin)}</p>
                </div>
              </div>
              <div className="filet-or my-4" />
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <div className="flex -space-x-2">
                    {experts.map((e) => (
                      <Avatar key={e.id} stylist={e} size="sm" />
                    ))}
                  </div>
                  <p className="text-xs text-sourdine">{experts.map((e) => e.name).join(", ")}</p>
                </div>
                <ButtonLink href={`/reserver?prestation=${s.id}`} size="sm">
                  Réserver
                </ButtonLink>
              </div>
            </Card>
          );
        })}
      </ul>
    </div>
  );
}
