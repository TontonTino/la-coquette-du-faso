import type { Metadata } from "next";
import Link from "next/link";
import { STYLISTS, formatWorkDays, getService } from "@/lib/catalog";
import { Avatar, Card, PageHeader } from "@/components/ui/primitives";

export const metadata: Metadata = { title: "Notre équipe" };

export default function EquipePage() {
  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader eyebrow="Notre équipe" title="Nos expertes">
        Choisissez l&apos;experte qui réalisera votre coiffure. Profils de démonstration.
      </PageHeader>
      <ul className="space-y-4">
        {STYLISTS.map((s) => (
          <li key={s.id}>
            <Link href={`/equipe/${s.id}`} className="group block">
              <Card className="flex items-center gap-4 p-5 transition-colors group-hover:border-or">
                <Avatar stylist={s} size="lg" />
                <div className="min-w-0 flex-1">
                  <h2 className="font-display text-2xl font-semibold text-noir">{s.name}</h2>
                  <p className="text-sm font-medium text-or-fonce">{s.specialty}</p>
                  <p className="mt-1 text-xs text-sourdine">
                    {s.serviceIds.map((id) => getService(id)?.name).join(" · ")} — {formatWorkDays(s.workDays)}
                  </p>
                </div>
                <span className="text-or-fonce" aria-hidden>
                  →
                </span>
              </Card>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
