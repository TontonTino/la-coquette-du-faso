"use client";

import Link from "next/link";
import { useState } from "react";
import { appointmentsFor, worksOn } from "@/lib/booking";
import { STYLISTS } from "@/lib/catalog";
import { formatFcfa, todayIso } from "@/lib/time";
import type { AppointmentStatus, IsoDate } from "@/lib/types";
import { useDemoState } from "@/store/demo-store";
import { useNow } from "@/store/use-now";
import { AppointmentCard, AppointmentSheet } from "@/components/appointments/AppointmentViews";
import { ButtonLink } from "@/components/ui/Button";
import { DayNav } from "@/components/ui/DayNav";
import { Avatar, PageHeader, PageSkeleton } from "@/components/ui/primitives";

type Filter = "actifs" | AppointmentStatus | "tous";
const FILTERS: { id: Filter; label: string }[] = [
  { id: "actifs", label: "Actifs" },
  { id: "en_attente", label: "En attente" },
  { id: "confirme", label: "Confirmés" },
  { id: "termine", label: "Terminés" },
  { id: "annule", label: "Annulés" },
  { id: "tous", label: "Tous" },
];

export function ManagerAppointments() {
  const state = useDemoState();
  const now = useNow();
  const today = todayIso(now);
  const [date, setDate] = useState<IsoDate>(today);
  const [filter, setFilter] = useState<Filter>("actifs");
  const [openId, setOpenId] = useState<string | null>(null);
  if (!state) return <PageSkeleton />;

  const all = appointmentsFor(state, { date, includeCancelled: true });
  const visible = all.filter((a) => (filter === "tous" ? true : filter === "actifs" ? a.status !== "annule" : a.status === filter));
  const open = state.appointments.find((a) => a.id === openId) ?? null;

  return (
    <div>
      <PageHeader eyebrow="Espace gérante" title="Rendez-vous par coiffeuse">
        Consultez, confirmez ou annulez les rendez-vous de chaque experte.
      </PageHeader>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <DayNav date={date} today={today} onChange={setDate} />
        <ButtonLink href="/demo/reserver" size="sm" variant="noir">
          + Nouveau rendez-vous
        </ButtonLink>
      </div>

      <div className="no-scrollbar -mx-4 mt-4 flex gap-2 overflow-x-auto px-4 sm:mx-0 sm:px-0" role="group" aria-label="Filtrer par statut">
        {FILTERS.map((f) => {
          const count = all.filter((a) => (f.id === "tous" ? true : f.id === "actifs" ? a.status !== "annule" : a.status === f.id)).length;
          return (
            <button
              key={f.id}
              type="button"
              aria-pressed={filter === f.id}
              onClick={() => setFilter(f.id)}
              className={`shrink-0 rounded-full border px-3.5 py-1.5 text-sm transition-colors ${
                filter === f.id ? "border-noir bg-noir text-white" : "border-trait bg-white text-encre hover:border-or"
              }`}
            >
              {f.label} <span className={filter === f.id ? "text-or" : "text-sourdine"}>{count}</span>
            </button>
          );
        })}
      </div>

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-3">
        {STYLISTS.map((s) => {
          const list = visible.filter((a) => a.stylistId === s.id);
          const revenue = list.filter((a) => a.status !== "annule").reduce((sum, a) => sum + a.priceFcfa, 0);
          return (
            <section key={s.id} aria-label={`Rendez-vous de ${s.name}`}>
              <div className="mb-3 flex items-center gap-3">
                <Avatar stylist={s} size="sm" />
                <div className="flex-1">
                  <h2 className="font-display text-xl font-semibold text-noir">{s.name}</h2>
                  <p className="text-xs text-sourdine">
                    {list.length} rendez-vous · {formatFcfa(revenue)}
                  </p>
                </div>
                <Link href={`/demo/espace-coiffeuse/${s.id}`} className="text-xs font-medium text-or-fonce hover:underline">
                  Planning
                </Link>
              </div>
              {!worksOn(s, date) ? (
                <p className="rounded-2xl border border-dashed border-trait bg-white px-4 py-6 text-center text-sm text-sourdine">Repos ou salon fermé</p>
              ) : list.length === 0 ? (
                <p className="rounded-2xl border border-dashed border-trait bg-white px-4 py-6 text-center text-sm text-sourdine">Aucun rendez-vous</p>
              ) : (
                <ul className="space-y-2">
                  {list.map((a) => (
                    <li key={a.id}>
                      <AppointmentCard appointment={a} now={now} onOpen={() => setOpenId(a.id)} showDate={false} showStylist={false} showClient />
                    </li>
                  ))}
                </ul>
              )}
            </section>
          );
        })}
      </div>

      <AppointmentSheet appointment={open} actor="gerante" now={now} onClose={() => setOpenId(null)} />
    </div>
  );
}
