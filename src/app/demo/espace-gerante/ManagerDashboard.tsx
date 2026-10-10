"use client";

import Link from "next/link";
import { useState } from "react";
import { appointmentsFor, dayStats, isUpcoming, worksOn } from "@/lib/booking";
import { STYLISTS, getService } from "@/lib/catalog";
import { addDays, capitalize, compareDateTime, dateChip, formatDateLong, formatDateRelative, formatFcfa, formatTime, todayIso } from "@/lib/time";
import { useDemoState } from "@/store/demo-store";
import { useNow } from "@/store/use-now";
import { AppointmentCard, AppointmentSheet } from "@/components/appointments/AppointmentViews";
import { Avatar, Card, EmptyState, Notice, PageHeader, PageSkeleton, SectionTitle, Stat, StatusBadge } from "@/components/ui/primitives";

export function ManagerDashboard() {
  const state = useDemoState();
  const now = useNow();
  const [openId, setOpenId] = useState<string | null>(null);
  if (!state) return <PageSkeleton />;

  const today = todayIso(now);
  const stats = dayStats(state, today);
  const toConfirm = state.appointments.filter((a) => a.status === "en_attente" && isUpcoming(a, now)).sort(compareDateTime);
  const week = Array.from({ length: 7 }, (_, i) => addDays(today, i));
  const weekMax = Math.max(1, ...week.map((d) => dayStats(state, d).total));
  const open = state.appointments.find((a) => a.id === openId) ?? null;

  return (
    <div>
      <PageHeader eyebrow="Espace gérante" title="Tableau de bord">
        {capitalize(formatDateLong(today))} · heure de Ouagadougou
      </PageHeader>

      {state.seededOn !== today && (
        <div className="mb-5">
          <Notice title="Planning de démonstration ancien">
            Les rendez-vous fictifs ont été générés le {formatDateLong(state.seededOn)}. Utilisez « Réinitialiser la démo » en bas de page pour obtenir un
            planning à jour.
          </Notice>
        </div>
      )}

      <dl className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Stat label="Rendez-vous aujourd'hui" value={stats.total} />
        <Stat label="À confirmer aujourd'hui" value={stats.pending} highlight={stats.pending > 0} />
        <Stat label="Chiffre d'affaires prévu" value={formatFcfa(stats.revenueFcfa)} />
        <Stat label="Taux d'occupation" value={`${stats.occupancy} %`} hint="des heures d'ouverture" />
      </dl>

      <div className="mt-8 grid grid-cols-1 gap-8 lg:grid-cols-[1.4fr_1fr]">
        <section aria-labelledby="par-coiffeuse" className="min-w-0">
          <SectionTitle
            id="par-coiffeuse"
            eyebrow="Aujourd'hui"
            title="Rendez-vous par coiffeuse"
            action={
              <Link href="/demo/espace-gerante/rendez-vous" className="text-sm font-medium text-or-fonce hover:underline">
                Gérer
              </Link>
            }
          />
          <div className="space-y-3">
            {STYLISTS.map((s) => {
              const list = appointmentsFor(state, { stylistId: s.id, date: today });
              return (
                <Card key={s.id} className="p-4">
                  <div className="mb-3 flex items-center gap-3">
                    <Avatar stylist={s} size="sm" />
                    <div className="flex-1">
                      <p className="font-medium text-noir">{s.name}</p>
                      <p className="text-xs text-sourdine">{worksOn(s, today) ? `${list.length} rendez-vous` : "Repos aujourd'hui"}</p>
                    </div>
                    <Link href={`/demo/espace-coiffeuse/${s.id}`} className="text-xs font-medium text-or-fonce hover:underline">
                      Planning
                    </Link>
                  </div>
                  {list.length > 0 ? (
                    <ul className="divide-y divide-trait">
                      {list.map((a) => (
                        <li key={a.id}>
                          <button type="button" onClick={() => setOpenId(a.id)} className="flex w-full items-center gap-3 py-2 text-left text-sm hover:bg-creme">
                            <span className="w-14 font-medium text-noir">{formatTime(a.start)}</span>
                            <span className="min-w-0 flex-1 truncate">
                              {getService(a.serviceId)?.name} <span className="text-sourdine">· {a.clientName}</span>
                            </span>
                            <StatusBadge status={a.status} />
                          </button>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    worksOn(s, today) && <p className="text-sm text-sourdine">Aucun rendez-vous.</p>
                  )}
                </Card>
              );
            })}
          </div>
        </section>

        <div className="min-w-0 space-y-8">
          <section aria-labelledby="a-confirmer">
            <SectionTitle id="a-confirmer" eyebrow="Demandes" title={`À confirmer (${toConfirm.length})`} />
            {toConfirm.length === 0 ? (
              <EmptyState title="Tout est confirmé">Aucune demande en attente.</EmptyState>
            ) : (
              <ul className="space-y-2">
                {toConfirm.slice(0, 5).map((a) => (
                  <li key={a.id}>
                    <AppointmentCard appointment={a} now={now} onOpen={() => setOpenId(a.id)} showClient />
                  </li>
                ))}
                {toConfirm.length > 5 && <li className="text-center text-sm text-sourdine">et {toConfirm.length - 5} autre(s)…</li>}
              </ul>
            )}
          </section>

          <section aria-labelledby="semaine">
            <SectionTitle id="semaine" eyebrow="7 prochains jours" title="Activité" />
            <Card className="p-4">
              <ul className="flex items-end justify-between gap-1.5" aria-label="Nombre de rendez-vous par jour">
                {week.map((d) => {
                  const st = dayStats(state, d);
                  const chip = dateChip(d);
                  return (
                    <li key={d} className="flex flex-1 flex-col items-center gap-1" title={`${formatDateRelative(d, today)} : ${st.total} rendez-vous, ${formatFcfa(st.revenueFcfa)}`}>
                      <span className="text-xs font-medium text-noir">{st.total}</span>
                      <span className="flex h-24 w-full items-end rounded-lg bg-gris">
                        <span className={`w-full rounded-lg ${d === today ? "bg-or" : "bg-noir"}`} style={{ height: `${(st.total / weekMax) * 100}%` }} />
                      </span>
                      <span className="text-[10.5px] text-sourdine">{chip.weekday}</span>
                      <span className="text-[10.5px] text-sourdine">{chip.day}</span>
                    </li>
                  );
                })}
              </ul>
            </Card>
          </section>
        </div>
      </div>

      <AppointmentSheet appointment={open} actor="gerante" now={now} onClose={() => setOpenId(null)} />
    </div>
  );
}
