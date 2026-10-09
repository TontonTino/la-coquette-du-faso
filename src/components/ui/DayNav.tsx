"use client";

import { useId } from "react";
import { addDays, capitalize, formatDateLong } from "@/lib/time";
import type { IsoDate } from "@/lib/types";
import { IconChevronLeft, IconChevronRight } from "./icons";

/** Navigation jour par jour pour les plannings. */
export function DayNav({ date, today, onChange }: { date: IsoDate; today: IsoDate; onChange: (date: IsoDate) => void }) {
  const inputId = useId();
  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="flex items-center rounded-full border border-trait bg-white">
        <button type="button" onClick={() => onChange(addDays(date, -1))} className="flex size-10 items-center justify-center rounded-full hover:bg-gris" aria-label="Jour précédent">
          <IconChevronLeft width={18} height={18} />
        </button>
        <label htmlFor={inputId} className="sr-only">
          Choisir une date
        </label>
        <input
          id={inputId}
          type="date"
          value={date}
          onChange={(e) => e.target.value && onChange(e.target.value)}
          className="w-[138px] bg-transparent px-1 text-sm text-encre focus:outline-none"
        />
        <button type="button" onClick={() => onChange(addDays(date, 1))} className="flex size-10 items-center justify-center rounded-full hover:bg-gris" aria-label="Jour suivant">
          <IconChevronRight width={18} height={18} />
        </button>
      </div>
      {date !== today && (
        <button type="button" onClick={() => onChange(today)} className="rounded-full border border-or/50 bg-or-pale px-3 py-2 text-sm font-medium text-or-fonce">
          Aujourd&apos;hui
        </button>
      )}
      <p className="w-full text-sm font-medium text-noir sm:ml-2 sm:w-auto">{capitalize(formatDateLong(date))}</p>
    </div>
  );
}
