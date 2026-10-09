"use client";

import { hasAlternatives, type Alternatives } from "@/lib/booking";
import { formatDateRelative, formatTime } from "@/lib/time";
import type { HourMinute, IsoDate } from "@/lib/types";
import { Avatar } from "@/components/ui/primitives";

export interface AlternativeChoice {
  stylistId: string;
  date: IsoDate;
  start: HourMinute;
}

function Chip({ onClick, children, label }: { onClick: () => void; children: React.ReactNode; label: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className="rounded-full border border-or/50 bg-white px-3 py-1.5 text-sm font-medium text-encre transition-colors hover:border-or hover:bg-or-pale"
    >
      {children}
    </button>
  );
}

/** Propositions lorsqu'une coiffeuse ou un créneau n'est pas disponible. */
export function AlternativesPanel({
  alternatives,
  stylistId,
  stylistName,
  date,
  start,
  today,
  onPick,
}: {
  alternatives: Alternatives;
  stylistId: string;
  stylistName: string;
  date: IsoDate;
  start?: HourMinute;
  today: IsoDate;
  onPick: (choice: AlternativeChoice) => void;
}) {
  const { sameTimeOtherStylists, sameStylistSameDay, otherStylistsSameDay, sameStylistNextDays } = alternatives;
  const dayLabel = formatDateRelative(date, today).toLowerCase();

  if (!hasAlternatives(alternatives)) {
    return <p className="text-sm text-sourdine">Aucune alternative n&apos;a été trouvée dans les trois prochaines semaines pour cette prestation.</p>;
  }

  return (
    <div className="space-y-5">
      {start && sameTimeOtherStylists.length > 0 && (
        <section>
          <h4 className="mb-2 text-sm font-semibold text-noir">Même heure ({formatTime(start)}), avec une autre experte</h4>
          <ul className="space-y-2">
            {sameTimeOtherStylists.map((s) => (
              <li key={s.id}>
                <button
                  type="button"
                  onClick={() => onPick({ stylistId: s.id, date, start })}
                  className="flex w-full items-center gap-3 rounded-xl border border-trait bg-white p-3 text-left transition-colors hover:border-or"
                >
                  <Avatar stylist={s} size="sm" />
                  <span className="flex-1">
                    <span className="block text-sm font-medium text-noir">{s.name}</span>
                    <span className="block text-xs text-sourdine">{s.specialty}</span>
                  </span>
                  <span className="text-sm font-medium text-or-fonce">Choisir</span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      {sameStylistSameDay.length > 0 && (
        <section>
          <h4 className="mb-2 text-sm font-semibold text-noir">
            Autres horaires avec {stylistName} ({dayLabel})
          </h4>
          <div className="flex flex-wrap gap-2">
            {sameStylistSameDay.map((s) => (
              <Chip key={s} label={`${formatTime(s)} avec ${stylistName}`} onClick={() => onPick({ stylistId, date, start: s })}>
                {formatTime(s)}
              </Chip>
            ))}
          </div>
        </section>
      )}

      {sameStylistSameDay.length === 0 && otherStylistsSameDay.length > 0 && (
        <section>
          <h4 className="mb-2 text-sm font-semibold text-noir">Autres expertes disponibles ({dayLabel})</h4>
          <ul className="space-y-3">
            {otherStylistsSameDay.map(({ stylist, starts }) => (
              <li key={stylist.id} className="flex flex-wrap items-center gap-2">
                <span className="mr-1 flex items-center gap-2 text-sm font-medium text-noir">
                  <Avatar stylist={stylist} size="sm" /> {stylist.name}
                </span>
                {starts.map((s) => (
                  <Chip key={s} label={`${formatTime(s)} avec ${stylist.name}`} onClick={() => onPick({ stylistId: stylist.id, date, start: s })}>
                    {formatTime(s)}
                  </Chip>
                ))}
              </li>
            ))}
          </ul>
        </section>
      )}

      {sameStylistNextDays.length > 0 && (
        <section>
          <h4 className="mb-2 text-sm font-semibold text-noir">Prochaines disponibilités de {stylistName}</h4>
          <ul className="space-y-2">
            {sameStylistNextDays.map((d) => (
              <li key={d.date} className="flex flex-wrap items-center gap-2">
                <span className="w-full text-xs font-medium text-sourdine sm:w-44">{formatDateRelative(d.date, today)}</span>
                {d.starts.map((s) => (
                  <Chip
                    key={s}
                    label={`${formatDateRelative(d.date, today)} à ${formatTime(s)} avec ${stylistName}`}
                    onClick={() => onPick({ stylistId, date: d.date, start: s })}
                  >
                    {formatTime(s)}
                  </Chip>
                ))}
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
