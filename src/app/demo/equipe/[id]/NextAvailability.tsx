"use client";

import Link from "next/link";
import { availableStarts } from "@/lib/booking";
import { getService, getStylist } from "@/lib/catalog";
import { addDays, formatDateRelative, formatTime, todayIso } from "@/lib/time";
import { useDemoState } from "@/store/demo-store";
import { useNow } from "@/store/use-now";
import { Card, Skeleton } from "@/components/ui/primitives";

/** Prochains créneaux libres de l'experte, par prestation. */
export function NextAvailability({ stylistId }: { stylistId: string }) {
  const state = useDemoState();
  const now = useNow();
  const stylist = getStylist(stylistId)!;
  if (!state) return <Skeleton className="mt-4 h-32" />;
  const today = todayIso(now);

  const rows = stylist.serviceIds.map((serviceId) => {
    for (let i = 0; i < 30; i++) {
      const date = addDays(today, i);
      const starts = availableStarts(state, stylistId, serviceId, date, now);
      if (starts.length) return { serviceId, date, starts: starts.slice(0, 3) };
    }
    return { serviceId, date: null, starts: [] };
  });

  return (
    <Card className="mt-4 p-5">
      <h2 className="font-display text-xl font-semibold text-noir">Prochaines disponibilités</h2>
      <ul className="mt-3 space-y-3">
        {rows.map((r) => (
          <li key={r.serviceId}>
            <p className="text-sm font-medium text-noir">
              {getService(r.serviceId)?.name}
              {r.date && <span className="font-normal text-sourdine"> · {formatDateRelative(r.date, today)}</span>}
            </p>
            {r.date ? (
              <div className="mt-1.5 flex flex-wrap gap-2">
                {r.starts.map((s) => (
                  <Link
                    key={s}
                    href={`/demo/reserver?prestation=${r.serviceId}&coiffeuse=${stylistId}&date=${r.date}&heure=${s}`}
                    className="rounded-full border border-or/50 px-3 py-1 text-sm font-medium text-encre hover:bg-or-pale"
                  >
                    {formatTime(s)}
                  </Link>
                ))}
              </div>
            ) : (
              <p className="text-sm text-sourdine">Aucun créneau libre dans les 30 prochains jours.</p>
            )}
          </li>
        ))}
      </ul>
    </Card>
  );
}
