"use client";

import Link from "next/link";
import { appointmentsFor, worksOn } from "@/lib/booking";
import { STYLISTS } from "@/lib/catalog";
import { todayIso } from "@/lib/time";
import { useDemoState } from "@/store/demo-store";
import { useNow } from "@/store/use-now";
import { Avatar, Card, Notice, PageHeader, Skeleton } from "@/components/ui/primitives";

export function StylistPicker() {
  const state = useDemoState();
  const now = useNow();
  const today = todayIso(now);

  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader eyebrow="Espace coiffeuse" title="Qui êtes-vous ?">
        Choisissez votre profil pour accéder à votre planning.
      </PageHeader>
      <div className="mb-5">
        <Notice title="Accès de démonstration">
          Aucune connexion n&apos;est demandée dans cette démo. Une version réelle protégerait chaque espace par un identifiant personnel.
        </Notice>
      </div>
      <ul className="space-y-3">
        {STYLISTS.map((s) => {
          const todays = state ? appointmentsFor(state, { stylistId: s.id, date: today }) : null;
          return (
            <li key={s.id}>
              <Link href={`/espace-coiffeuse/${s.id}`} className="group block">
                <Card className="flex items-center gap-4 p-4 transition-colors group-hover:border-or">
                  <Avatar stylist={s} />
                  <div className="min-w-0 flex-1">
                    <p className="font-display text-xl font-semibold text-noir">{s.name}</p>
                    <p className="text-sm text-sourdine">{s.specialty}</p>
                  </div>
                  <div className="text-right text-sm">
                    {todays === null ? (
                      <Skeleton className="h-5 w-24" />
                    ) : worksOn(s, today) ? (
                      <>
                        <p className="font-display text-2xl leading-none font-bold text-noir">{todays.length}</p>
                        <p className="text-xs text-sourdine">RDV aujourd&apos;hui</p>
                      </>
                    ) : (
                      <p className="text-xs text-sourdine">Repos aujourd&apos;hui</p>
                    )}
                  </div>
                </Card>
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
