"use client";

import { useState } from "react";
import { appointmentEnd, appointmentsFor, availableStarts, daySchedule, type ScheduleCell } from "@/lib/booking";
import { getService, getStylist } from "@/lib/catalog";
import { formatFcfa, formatTime, todayIso } from "@/lib/time";
import type { DemoState, IsoDate } from "@/lib/types";
import { demoActions, useDemoState } from "@/store/demo-store";
import { useNow } from "@/store/use-now";
import { AppointmentCard, AppointmentSheet } from "@/components/appointments/AppointmentViews";
import { DayNav } from "@/components/ui/DayNav";
import { IconLock } from "@/components/ui/icons";
import { Avatar, EmptyState, Notice, PageSkeleton, Stat, StatusBadge } from "@/components/ui/primitives";
import { useToast } from "@/components/ui/Toast";

type Tab = "planning" | "rendez-vous" | "creneaux";

export function StylistWorkspace({ stylistId }: { stylistId: string }) {
  const state = useDemoState();
  if (!state) return <PageSkeleton />;
  return <Workspace state={state} stylistId={stylistId} />;
}

function Workspace({ state, stylistId }: { state: DemoState; stylistId: string }) {
  const now = useNow();
  const today = todayIso(now);
  const toast = useToast();
  const stylist = getStylist(stylistId)!;
  const [date, setDate] = useState<IsoDate>(today);
  const [tab, setTab] = useState<Tab>("planning");
  const [openId, setOpenId] = useState<string | null>(null);

  const schedule = daySchedule(state, stylistId, date, now);
  const dayAppointments = appointmentsFor(state, { stylistId, date, includeCancelled: true });
  const active = dayAppointments.filter((a) => a.status !== "annule");
  const pending = active.filter((a) => a.status === "en_attente").length;
  const freeCells = schedule.cells.filter((c) => c.kind === "libre" && !c.past).length;
  const open = state.appointments.find((a) => a.id === openId) ?? null;

  const toggle = (start: string) => {
    const result = demoActions.toggleBlock(stylistId, date, start);
    if (result.ok) {
      toast(
        "succes",
        result.value === "bloque" ? `Créneau de ${formatTime(start)} bloqué` : `Créneau de ${formatTime(start)} débloqué`,
        result.value === "bloque" ? "Il n'est plus proposé aux clientes." : "Il est de nouveau proposé aux clientes.",
      );
    } else {
      toast("erreur", "Action impossible", result.message);
    }
  };

  return (
    <div className="mx-auto max-w-3xl">
      <header className="mb-5 flex items-center gap-4">
        <Avatar stylist={stylist} size="lg" />
        <div>
          <p className="text-[11px] font-medium tracking-[0.18em] text-or-fonce uppercase">Espace coiffeuse</p>
          <h1 className="font-display text-[32px] leading-tight font-semibold text-noir">Bonjour, {stylist.name.split(" ")[0]}</h1>
          <p className="text-sm text-sourdine">{stylist.specialty}</p>
        </div>
      </header>

      <DayNav date={date} today={today} onChange={setDate} />

      <dl className="mt-4 grid grid-cols-4 gap-2">
        <Stat label="Rendez-vous" value={active.length} />
        <Stat label="À confirmer" value={pending} highlight={pending > 0} />
        <Stat label="Créneaux libres" value={freeCells} hint="de 30 min" />
        <Stat label="Prévu" value={formatFcfa(active.reduce((s, a) => s + a.priceFcfa, 0)).replace(/ FCFA/, "")} hint="FCFA" />
      </dl>

      <div role="tablist" aria-label="Vues du planning" className="mt-5 mb-4 flex gap-1 rounded-full bg-noir/5 p-1">
        {(
          [
            ["planning", "Planning"],
            ["rendez-vous", "Rendez-vous"],
            ["creneaux", "Créneaux libres"],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={tab === id}
            onClick={() => setTab(id)}
            className={`flex-1 rounded-full px-2 py-2 text-sm transition-colors ${tab === id ? "bg-white font-medium text-noir shadow-sm" : "text-sourdine"}`}
          >
            {label}
          </button>
        ))}
      </div>

      {!schedule.working ? (
        <EmptyState title="Jour de repos">
          {stylist.name} ne travaille pas ce jour-là (ou le salon est fermé). Choisissez une autre date.
        </EmptyState>
      ) : tab === "planning" ? (
        <div role="tabpanel">
          <p className="mb-3 text-xs text-sourdine">Touchez un créneau libre pour le bloquer (pause, absence), ou un créneau bloqué pour le libérer.</p>
          <ol key={date} className="space-y-1.5">
            {schedule.cells.map((cell) => (
              <PlanningRow key={cell.start} cell={cell} onOpen={setOpenId} onToggle={toggle} />
            ))}
          </ol>
        </div>
      ) : tab === "rendez-vous" ? (
        <div role="tabpanel">
          {dayAppointments.length === 0 ? (
            <EmptyState title="Aucun rendez-vous ce jour-là">Les réservations des clientes apparaîtront ici.</EmptyState>
          ) : (
            <ul className="space-y-3">
              {dayAppointments.map((a) => (
                <li key={a.id}>
                  <AppointmentCard appointment={a} now={now} onOpen={() => setOpenId(a.id)} showDate={false} showStylist={false} showClient />
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : (
        <div role="tabpanel" className="space-y-4">
          <p className="text-sm text-sourdine">Heures de début encore possibles, compte tenu de la durée de chaque prestation.</p>
          {stylist.serviceIds.map((serviceId) => {
            const service = getService(serviceId)!;
            const starts = availableStarts(state, stylistId, serviceId, date, now);
            return (
              <section key={serviceId} className="rounded-2xl border border-trait bg-white p-4">
                <h3 className="font-medium text-noir">{service.name}</h3>
                {starts.length ? (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {starts.map((s) => (
                      <span key={s} className="rounded-full bg-vert-pale px-2.5 py-1 text-sm text-vert">
                        {formatTime(s)}
                      </span>
                    ))}
                  </div>
                ) : (
                  <p className="mt-1 text-sm text-sourdine">Plus de créneau suffisamment long ce jour-là.</p>
                )}
              </section>
            );
          })}
          {date < today && <Notice>Cette date est passée : aucun créneau n&apos;est réservable.</Notice>}
        </div>
      )}

      <AppointmentSheet appointment={open} actor="coiffeuse" now={now} onClose={() => setOpenId(null)} />
    </div>
  );
}

function PlanningRow({ cell, onOpen, onToggle }: { cell: ScheduleCell; onOpen: (id: string) => void; onToggle: (start: string) => void }) {
  if (cell.kind === "rdv") {
    if (!cell.isFirst) return null;
    const a = cell.appointment;
    const rows = a.durationMin / 30;
    return (
      <li>
        <button
          type="button"
          onClick={() => onOpen(a.id)}
          style={{ minHeight: `${rows * 2.75 - 0.375}rem` }}
          className="flex w-full gap-3 rounded-xl border-l-4 border-or bg-noir p-3 text-left text-white transition-opacity hover:opacity-90"
        >
          <span className="w-14 shrink-0 text-sm text-or">{formatTime(a.start)}</span>
          <span className="min-w-0 flex-1">
            <span className="block font-medium">{getService(a.serviceId)?.name}</span>
            <span className="block text-sm text-white/70">
              {a.clientName} · jusqu&apos;à {formatTime(appointmentEnd(a))}
            </span>
          </span>
          <span className="self-start">
            <StatusBadge status={a.status} />
          </span>
        </button>
      </li>
    );
  }
  const blocked = cell.kind === "bloque";
  return (
    <li>
      <button
        type="button"
        disabled={cell.past}
        onClick={() => onToggle(cell.start)}
        aria-label={`${formatTime(cell.start)} : ${blocked ? "bloqué, toucher pour débloquer" : "libre, toucher pour bloquer"}`}
        className={`flex h-10 w-full items-center gap-3 rounded-xl border px-3 text-left text-sm transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
          blocked
            ? "border-noir/15 bg-[repeating-linear-gradient(135deg,#efece4_0,#efece4_6px,#e4dfd2_6px,#e4dfd2_12px)] text-encre hover:border-noir/40"
            : "border-dashed border-trait bg-white text-sourdine hover:border-or hover:text-encre"
        }`}
      >
        <span className="w-14 shrink-0 text-encre">{formatTime(cell.start)}</span>
        <span className="flex-1">{blocked ? "Bloqué" : cell.past ? "Passé" : "Libre"}</span>
        {!cell.past && (
          <span className="flex items-center gap-1 text-xs font-medium text-or-fonce">
            {blocked ? (
              "Débloquer"
            ) : (
              <>
                <IconLock width={14} height={14} /> Bloquer
              </>
            )}
          </span>
        )}
      </button>
    </li>
  );
}
