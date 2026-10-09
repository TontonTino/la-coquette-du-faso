"use client";

import Link from "next/link";
import { useState } from "react";
import { availableStarts, daySchedule } from "@/lib/booking";
import { SALON, SERVICES, STYLISTS, getService } from "@/lib/catalog";
import { formatDuration, formatTime, todayIso } from "@/lib/time";
import type { IsoDate } from "@/lib/types";
import { useDemoState } from "@/store/demo-store";
import { useNow } from "@/store/use-now";
import { DayNav } from "@/components/ui/DayNav";
import { Avatar, Card, PageHeader, PageSkeleton } from "@/components/ui/primitives";

const HOURS = Array.from({ length: (Number(SALON.closingTime.slice(0, 2)) - Number(SALON.openingTime.slice(0, 2))) }, (_, i) => Number(SALON.openingTime.slice(0, 2)) + i);

export function Availability() {
  const state = useDemoState();
  const now = useNow();
  const today = todayIso(now);
  const [date, setDate] = useState<IsoDate>(today);
  const [serviceId, setServiceId] = useState(SERVICES[0].id);
  if (!state) return <PageSkeleton />;
  const service = getService(serviceId)!;

  return (
    <div>
      <PageHeader eyebrow="Espace gérante" title="Disponibilités">
        Vue d&apos;ensemble de l&apos;occupation de l&apos;équipe et des horaires encore réservables.
      </PageHeader>

      <DayNav date={date} today={today} onChange={setDate} />

      <ul className="mt-4 flex flex-wrap gap-3 text-xs text-sourdine" aria-label="Légende">
        <Legend className="bg-noir" label="Rendez-vous" />
        <Legend className="bg-[repeating-linear-gradient(135deg,#d9d3c4_0,#d9d3c4_3px,#efece4_3px,#efece4_6px)]" label="Bloqué" />
        <Legend className="border border-vert/30 bg-vert-pale" label="Libre" />
        <Legend className="bg-noir/10" label="Passé / repos" />
      </ul>

      <div className="mt-4 space-y-3">
        {STYLISTS.map((s) => {
          const schedule = daySchedule(state, s.id, date, now);
          return (
            <Card key={s.id} className="p-4">
              <div className="mb-3 flex items-center gap-3">
                <Avatar stylist={s} size="sm" />
                <p className="flex-1 font-medium text-noir">{s.name}</p>
                <Link href={`/espace-coiffeuse/${s.id}`} className="text-xs font-medium text-or-fonce hover:underline">
                  Ouvrir le planning
                </Link>
              </div>
              {schedule.working ? (
                <div>
                  <div className="grid grid-cols-[repeat(22,minmax(0,1fr))] gap-px overflow-hidden rounded-md" aria-hidden>
                    {schedule.cells.map((c) => (
                      <span
                        key={c.start}
                        title={formatTime(c.start)}
                        className={`h-7 ${
                          c.kind === "rdv"
                            ? "bg-noir"
                            : c.kind === "bloque"
                              ? "bg-[repeating-linear-gradient(135deg,#d9d3c4_0,#d9d3c4_3px,#efece4_3px,#efece4_6px)]"
                              : c.past
                                ? "bg-noir/10"
                                : "bg-vert-pale"
                        }`}
                      />
                    ))}
                  </div>
                  <div className="mt-1 grid grid-cols-11 text-[10px] text-sourdine" aria-hidden>
                    {HOURS.map((h) => (
                      <span key={h}>{h}h</span>
                    ))}
                  </div>
                  <p className="sr-only">
                    {schedule.cells.filter((c) => c.kind === "libre" && !c.past).length} créneaux de 30 minutes libres sur {schedule.cells.length}.
                  </p>
                </div>
              ) : (
                <p className="rounded-lg bg-gris px-3 py-2 text-sm text-sourdine">Repos ou salon fermé ce jour-là.</p>
              )}
            </Card>
          );
        })}
      </div>

      <section className="mt-8" aria-labelledby="horaires">
        <h2 id="horaires" className="font-display text-2xl font-semibold text-noir">
          Horaires réservables
        </h2>
        <div className="mt-3 flex flex-wrap gap-2" role="group" aria-label="Prestation">
          {SERVICES.map((sv) => (
            <button
              key={sv.id}
              type="button"
              aria-pressed={serviceId === sv.id}
              onClick={() => setServiceId(sv.id)}
              className={`rounded-full border px-3.5 py-1.5 text-sm ${serviceId === sv.id ? "border-noir bg-noir text-white" : "border-trait bg-white hover:border-or"}`}
            >
              {sv.name} · {formatDuration(sv.durationMin)}
            </button>
          ))}
        </div>
        <div className="mt-4 grid gap-3 md:grid-cols-3">
          {STYLISTS.map((s) => {
            const offers = s.serviceIds.includes(service.id);
            const starts = offers ? availableStarts(state, s.id, service.id, date, now) : [];
            return (
              <Card key={s.id} className="p-4">
                <p className="font-medium text-noir">{s.name}</p>
                {!offers ? (
                  <p className="mt-1 text-sm text-sourdine">Ne propose pas cette prestation.</p>
                ) : starts.length === 0 ? (
                  <p className="mt-1 text-sm text-sourdine">Aucun horaire disponible.</p>
                ) : (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {starts.map((t) => (
                      <Link
                        key={t}
                        href={`/reserver?prestation=${service.id}&coiffeuse=${s.id}&date=${date}&heure=${t}`}
                        className="rounded-full bg-vert-pale px-2.5 py-1 text-sm text-vert hover:ring-1 hover:ring-vert/40"
                        title="Réserver ce créneau pour une cliente"
                      >
                        {formatTime(t)}
                      </Link>
                    ))}
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      </section>
    </div>
  );
}

function Legend({ className, label }: { className: string; label: string }) {
  return (
    <li className="flex items-center gap-1.5">
      <span className={`inline-block size-3.5 rounded ${className}`} />
      {label}
    </li>
  );
}
