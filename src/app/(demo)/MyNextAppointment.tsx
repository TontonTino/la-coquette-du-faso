"use client";

import Link from "next/link";
import { isActive, isUpcoming } from "@/lib/booking";
import { getService, getStylist } from "@/lib/catalog";
import { compareDateTime, formatDateRelative, formatTime, todayIso } from "@/lib/time";
import { useDemoState } from "@/store/demo-store";
import { useNow } from "@/store/use-now";
import { StatusBadge } from "@/components/ui/primitives";

/** Rappel du prochain rendez-vous pris depuis ce navigateur. */
export function MyNextAppointment() {
  const state = useDemoState();
  const now = useNow();
  if (!state) return null;
  const next = state.appointments
    .filter((a) => state.myAppointmentIds.includes(a.id) && isActive(a) && a.status !== "termine" && isUpcoming(a, now))
    .sort(compareDateTime)[0];
  if (!next) return null;
  return (
    <Link
      href="/mes-rendez-vous"
      className="-mt-6 flex items-center gap-4 rounded-2xl border border-or/40 bg-white p-4 shadow-carte transition-colors hover:border-or"
    >
      <span className="text-2xl text-or" aria-hidden>
        ✦
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-xs text-sourdine">Votre prochain rendez-vous</span>
        <span className="block truncate font-medium text-noir">
          {getService(next.serviceId)?.name} · {formatDateRelative(next.date, todayIso(now))} à {formatTime(next.start)}
        </span>
        <span className="block text-sm text-sourdine">avec {getStylist(next.stylistId)?.name}</span>
      </span>
      <StatusBadge status={next.status} />
    </Link>
  );
}
