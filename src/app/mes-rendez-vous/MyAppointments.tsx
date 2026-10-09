"use client";

import { useState } from "react";
import { isUpcoming } from "@/lib/booking";
import { compareDateTime } from "@/lib/time";
import { useDemoState } from "@/store/demo-store";
import { useNow } from "@/store/use-now";
import { AppointmentCard, AppointmentSheet } from "@/components/appointments/AppointmentViews";
import { ButtonLink } from "@/components/ui/Button";
import { EmptyState, PageHeader, PageSkeleton } from "@/components/ui/primitives";

export function MyAppointments() {
  const state = useDemoState();
  const now = useNow();
  const [openId, setOpenId] = useState<string | null>(null);
  if (!state) return <PageSkeleton />;

  const mine = state.appointments.filter((a) => state.myAppointmentIds.includes(a.id));
  const upcoming = mine.filter((a) => a.status !== "annule" && a.status !== "termine" && isUpcoming(a, now)).sort(compareDateTime);
  const history = mine.filter((a) => !upcoming.includes(a)).sort((a, b) => compareDateTime(b, a));
  const open = state.appointments.find((a) => a.id === openId) ?? null;

  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader eyebrow="Espace cliente" title="Mes rendez-vous">
        Rendez-vous pris depuis ce navigateur. Touchez un rendez-vous pour voir le détail ou l&apos;annuler.
      </PageHeader>

      {mine.length === 0 ? (
        <EmptyState title="Aucun rendez-vous pour l'instant" action={<ButtonLink href="/reserver">Prendre rendez-vous</ButtonLink>}>
          Vos réservations de démonstration apparaîtront ici.
        </EmptyState>
      ) : (
        <div className="space-y-8">
          <section aria-labelledby="a-venir">
            <h2 id="a-venir" className="mb-3 font-display text-2xl font-semibold text-noir">
              À venir <span className="text-base font-normal text-sourdine">({upcoming.length})</span>
            </h2>
            {upcoming.length === 0 ? (
              <EmptyState title="Aucun rendez-vous à venir" action={<ButtonLink href="/reserver">Réserver</ButtonLink>} />
            ) : (
              <ul className="space-y-3">
                {upcoming.map((a) => (
                  <li key={a.id}>
                    <AppointmentCard appointment={a} now={now} onOpen={() => setOpenId(a.id)} />
                  </li>
                ))}
              </ul>
            )}
          </section>
          {history.length > 0 && (
            <section aria-labelledby="historique">
              <h2 id="historique" className="mb-3 font-display text-2xl font-semibold text-noir">
                Historique
              </h2>
              <ul className="space-y-3">
                {history.map((a) => (
                  <li key={a.id}>
                    <AppointmentCard appointment={a} now={now} onOpen={() => setOpenId(a.id)} />
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>
      )}

      <AppointmentSheet appointment={open} actor="cliente" now={now} onClose={() => setOpenId(null)} />
    </div>
  );
}
