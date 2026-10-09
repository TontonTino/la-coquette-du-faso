"use client";

import { useState } from "react";
import { allowedActions, appointmentEnd, type AppointmentAction } from "@/lib/booking";
import { getService, getStylist } from "@/lib/catalog";
import { capitalize, formatDateLong, formatDateRelative, formatDuration, formatFcfa, formatTime, todayIso } from "@/lib/time";
import type { Actor, Appointment } from "@/lib/types";
import { demoActions } from "@/store/demo-store";
import { Button } from "@/components/ui/Button";
import { Avatar, StatusBadge } from "@/components/ui/primitives";
import { ConfirmSheet, Sheet } from "@/components/ui/Sheet";
import { useToast } from "@/components/ui/Toast";

export function AppointmentCard({
  appointment: a,
  now,
  onOpen,
  showDate = true,
  showStylist = true,
  showClient = false,
}: {
  appointment: Appointment;
  now: Date;
  onOpen: () => void;
  showDate?: boolean;
  showStylist?: boolean;
  showClient?: boolean;
}) {
  const service = getService(a.serviceId);
  const stylist = getStylist(a.stylistId);
  const muted = a.status === "annule" || a.status === "termine";
  return (
    <button
      type="button"
      onClick={onOpen}
      className={`flex w-full items-stretch gap-3 rounded-2xl border border-trait bg-white p-3 text-left shadow-carte transition-colors hover:border-or ${muted ? "opacity-70" : ""}`}
    >
      <span className={`flex w-[68px] shrink-0 flex-col items-center justify-center rounded-xl ${muted ? "bg-gris text-sourdine" : "bg-noir text-white"}`}>
        <span className={`font-display text-xl leading-none font-bold ${muted ? "" : "text-or"}`}>{formatTime(a.start)}</span>
        <span className="mt-1 text-[10.5px] opacity-75">{formatDuration(a.durationMin)}</span>
      </span>
      <span className="min-w-0 flex-1 py-0.5">
        <span className="flex flex-wrap items-center gap-2">
          <span className={`font-medium text-noir ${a.status === "annule" ? "line-through" : ""}`}>{service?.name}</span>
          <StatusBadge status={a.status} />
        </span>
        {showDate && <span className="mt-0.5 block text-sm text-sourdine">{formatDateRelative(a.date, todayIso(now))}</span>}
        <span className="mt-0.5 block truncate text-sm text-sourdine">
          {[showClient && a.clientName, showStylist && stylist && `avec ${stylist.name}`].filter(Boolean).join(" · ")}
        </span>
      </span>
      <span className="self-center text-sm font-medium whitespace-nowrap text-or-fonce">{formatFcfa(a.priceFcfa)}</span>
    </button>
  );
}

const ACTION_LABELS: Record<AppointmentAction, { label: string; done: string }> = {
  confirmer: { label: "Confirmer le rendez-vous", done: "Rendez-vous confirmé" },
  annuler: { label: "Annuler le rendez-vous", done: "Rendez-vous annulé" },
  terminer: { label: "Marquer comme terminé", done: "Rendez-vous terminé" },
};

const CANCELLED_BY: Record<Actor, string> = { cliente: "la cliente", coiffeuse: "la coiffeuse", gerante: "la gérante" };

/** Fiche détaillée d'un rendez-vous, avec les actions permises pour le rôle. */
export function AppointmentSheet({ appointment: a, actor, now, onClose }: { appointment: Appointment | null; actor: Actor; now: Date; onClose: () => void }) {
  const toast = useToast();
  const [confirmCancel, setConfirmCancel] = useState(false);
  if (!a) return null;
  const service = getService(a.serviceId)!;
  const stylist = getStylist(a.stylistId)!;
  const actions = allowedActions(a, actor, now);

  const run = (action: AppointmentAction) => {
    const result = demoActions.act(a.id, action, actor);
    if (result.ok) {
      toast("succes", ACTION_LABELS[action].done, `${service.name} · ${formatTime(a.start)} · ${result.value.reference}`);
      onClose();
    } else {
      toast("erreur", "Action impossible", result.message);
    }
  };

  return (
    <>
      <Sheet open={!confirmCancel} onClose={onClose} title="Détail du rendez-vous">
        <div className="flex items-center gap-3">
          <Avatar stylist={stylist} />
          <div className="min-w-0 flex-1">
            <p className="font-display text-xl font-semibold text-noir">{service.name}</p>
            <p className="text-sm text-sourdine">avec {stylist.name}</p>
          </div>
          <StatusBadge status={a.status} />
        </div>
        <dl className="mt-4 divide-y divide-trait rounded-2xl border border-trait px-4">
          <Line label="Date">{capitalize(formatDateLong(a.date))}</Line>
          <Line label="Horaire">
            {formatTime(a.start)} – {formatTime(appointmentEnd(a))} ({formatDuration(a.durationMin)})
          </Line>
          <Line label="Cliente">{a.clientName}</Line>
          {actor !== "cliente" && (
            <Line label="Téléphone">
              <a href={`tel:${a.clientPhone.replace(/\s/g, "")}`} className="text-or-fonce underline-offset-2 hover:underline">
                {a.clientPhone}
              </a>
            </Line>
          )}
          {a.note && <Line label="Remarque">{a.note}</Line>}
          <Line label="Prix">{formatFcfa(a.priceFcfa)}</Line>
          <Line label="Référence">{a.reference}</Line>
          {a.status === "annule" && a.cancelledBy && <Line label="Annulé par">{CANCELLED_BY[a.cancelledBy]}</Line>}
        </dl>
        {actions.length > 0 ? (
          <div className="mt-5 flex flex-col gap-2 sm:flex-row-reverse">
            {actions.includes("confirmer") && <Button onClick={() => run("confirmer")}>{ACTION_LABELS.confirmer.label}</Button>}
            {actions.includes("terminer") && (
              <Button variant="noir" onClick={() => run("terminer")}>
                {ACTION_LABELS.terminer.label}
              </Button>
            )}
            {actions.includes("annuler") && (
              <Button variant="danger" onClick={() => setConfirmCancel(true)}>
                {ACTION_LABELS.annuler.label}
              </Button>
            )}
          </div>
        ) : (
          <p className="mt-4 text-sm text-sourdine">
            {a.status === "annule" ? "Ce rendez-vous est annulé : le créneau est de nouveau libre." : a.status === "termine" ? "Prestation terminée." : "Aucune action disponible."}
          </p>
        )}
      </Sheet>
      <ConfirmSheet
        open={confirmCancel}
        title="Annuler ce rendez-vous ?"
        confirmLabel="Oui, annuler"
        onClose={() => setConfirmCancel(false)}
        onConfirm={() => {
          setConfirmCancel(false);
          run("annuler");
        }}
      >
        {service.name} avec {stylist.name}, {formatDateLong(a.date)} à {formatTime(a.start)}. Le créneau redeviendra disponible pour d&apos;autres clientes.
      </ConfirmSheet>
    </>
  );
}

function Line({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-4 py-2.5">
      <dt className="text-sm text-sourdine">{label}</dt>
      <dd className="text-right text-sm font-medium text-encre">{children}</dd>
    </div>
  );
}
