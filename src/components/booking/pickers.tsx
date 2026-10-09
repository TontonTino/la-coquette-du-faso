"use client";

import { useId } from "react";
import { addDays, dateChip, formatTime } from "@/lib/time";
import type { HourMinute, IsoDate } from "@/lib/types";

/** Bandeau de dates défilant + saisie libre d'une date. */
export function DateStrip({
  value,
  onChange,
  from,
  days = 14,
  isUnavailable,
  min,
}: {
  value: IsoDate;
  onChange: (date: IsoDate) => void;
  from: IsoDate;
  days?: number;
  /** Renvoie un libellé court si la date est indisponible (« Fermé », « Repos »…). */
  isUnavailable?: (date: IsoDate) => string | null;
  min?: IsoDate;
}) {
  const inputId = useId();
  const dates = Array.from({ length: days }, (_, i) => addDays(from, i));
  const outside = !dates.includes(value);
  return (
    <div>
      <div className="no-scrollbar -mx-4 flex snap-x gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:px-0" role="listbox" aria-label="Choisir une date">
        {dates.map((date) => {
          const chip = dateChip(date);
          const selected = date === value;
          const off = isUnavailable?.(date) ?? null;
          return (
            <button
              key={date}
              type="button"
              role="option"
              aria-selected={selected}
              onClick={() => onChange(date)}
              className={`flex w-[62px] shrink-0 snap-start flex-col items-center rounded-2xl border py-2.5 transition-colors ${
                selected ? "border-noir bg-noir text-white" : off ? "border-trait bg-gris text-sourdine/70" : "border-trait bg-white text-encre hover:border-or"
              }`}
            >
              <span className={`text-[11px] uppercase ${selected ? "text-or" : ""}`}>{chip.weekday}</span>
              <span className="font-display text-2xl leading-tight font-bold">{chip.day}</span>
              <span className="text-[10.5px]">{off ?? chip.month}</span>
            </button>
          );
        })}
      </div>
      <div className="mt-3 flex items-center gap-3 text-sm">
        <label htmlFor={inputId} className="text-sourdine">
          Autre date :
        </label>
        <input
          id={inputId}
          type="date"
          value={value}
          min={min ?? from}
          onChange={(e) => e.target.value && onChange(e.target.value)}
          className={`rounded-lg border px-3 py-1.5 text-encre ${outside ? "border-noir ring-1 ring-noir" : "border-trait"}`}
        />
      </div>
    </div>
  );
}

export function SlotGrid({ slots, value, onChange }: { slots: HourMinute[]; value: HourMinute | null; onChange: (start: HourMinute) => void }) {
  const groups = [
    { label: "Matin", slots: slots.filter((s) => s < "12:00") },
    { label: "Après-midi", slots: slots.filter((s) => s >= "12:00") },
  ].filter((g) => g.slots.length > 0);
  return (
    <div className="space-y-4">
      {groups.map((g) => (
        <fieldset key={g.label}>
          <legend className="mb-2 text-xs font-medium tracking-wider text-sourdine uppercase">{g.label}</legend>
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
            {g.slots.map((start) => {
              const selected = start === value;
              return (
                <button
                  key={start}
                  type="button"
                  aria-pressed={selected}
                  onClick={() => onChange(start)}
                  className={`rounded-xl border py-2.5 text-sm font-medium transition-colors ${
                    selected ? "border-or bg-or text-noir shadow-or" : "border-trait bg-white text-encre hover:border-or"
                  }`}
                >
                  {formatTime(start)}
                </button>
              );
            })}
          </div>
        </fieldset>
      ))}
    </div>
  );
}
