"use client";

import { isUpcoming } from "@/lib/booking";
import { STYLISTS, formatWorkDays, getService } from "@/lib/catalog";
import { capitalize, formatFcfa } from "@/lib/time";
import { useDemoState } from "@/store/demo-store";
import { useNow } from "@/store/use-now";
import { ButtonLink } from "@/components/ui/Button";
import { Avatar, Card, PageHeader, PageSkeleton } from "@/components/ui/primitives";

export function TeamOverview() {
  const state = useDemoState();
  const now = useNow();
  if (!state) return <PageSkeleton />;

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader eyebrow="Espace gérante" title="Équipe">
        Les coiffeuses du salon, leurs prestations et leur activité à venir.
      </PageHeader>
      <ul className="space-y-4">
        {STYLISTS.map((s) => {
          const upcoming = state.appointments.filter((a) => a.stylistId === s.id && a.status !== "annule" && a.status !== "termine" && isUpcoming(a, now));
          const pending = upcoming.filter((a) => a.status === "en_attente").length;
          const revenue = upcoming.reduce((sum, a) => sum + a.priceFcfa, 0);
          return (
            <Card as="li" key={s.id} className="p-5">
              <div className="flex items-start gap-4">
                <Avatar stylist={s} size="lg" />
                <div className="min-w-0 flex-1">
                  <h2 className="font-display text-2xl font-semibold text-noir">{s.name}</h2>
                  <p className="text-sm font-medium text-or-fonce">{s.specialty}</p>
                  <p className="mt-1 text-xs text-sourdine">{capitalize(formatWorkDays(s.workDays))}</p>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {s.serviceIds.map((id) => (
                      <span key={id} className="rounded-full bg-gris px-2.5 py-0.5 text-xs text-encre">
                        {getService(id)?.name}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
              <dl className="mt-4 grid grid-cols-3 gap-2 border-t border-trait pt-4 text-center">
                <div className="flex flex-col-reverse">
                  <dt className="text-xs text-sourdine">RDV à venir</dt>
                  <dd className="font-display text-2xl font-bold text-noir">{upcoming.length}</dd>
                </div>
                <div className="flex flex-col-reverse">
                  <dt className="text-xs text-sourdine">À confirmer</dt>
                  <dd className="font-display text-2xl font-bold text-noir">{pending}</dd>
                </div>
                <div className="flex flex-col-reverse">
                  <dt className="text-xs text-sourdine">CA prévu</dt>
                  <dd className="font-display text-lg leading-8 font-bold text-noir">{formatFcfa(revenue)}</dd>
                </div>
              </dl>
              <div className="mt-4 flex justify-end">
                <ButtonLink href={`/demo/espace-coiffeuse/${s.id}`} size="sm" variant="contour">
                  Voir son planning
                </ButtonLink>
              </div>
            </Card>
          );
        })}
      </ul>
    </div>
  );
}
