import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { addDays, capitalize, formatDateMedium, formatFcfa, isValidIsoDate, todayIso } from "@/lib/time";
import { ctxDe, exigerPage } from "@/server/auth";
import { bilan } from "@/server/salon/service";
import { Carte, ChargementListe, Section, Vide } from "../ui";

export const metadata: Metadata = { title: "Bilan du soir" };

export default function PageBilan({ searchParams }: PageProps<"/salon/bilan">) {
  return (
    <Suspense fallback={<ChargementListe />}>
      <Donnees searchParams={searchParams} />
    </Suspense>
  );
}

async function Donnees({ searchParams }: { searchParams: PageProps<"/salon/bilan">["searchParams"] }) {
  const u = await exigerPage(["gerante"]);
  const demande = (await searchParams).jour;
  const aujourdhui = todayIso();
  const jour = typeof demande === "string" && isValidIsoDate(demande) && demande <= aujourdhui ? demande : aujourdhui;
  const b = await bilan(ctxDe(u), jour);

  return (
    <div>
      <nav aria-label="Changer de jour" className="mb-4 flex items-center justify-between">
        <Link href={`/salon/bilan?jour=${addDays(jour, -1)}`} className="min-h-11 px-2 py-3 text-sm underline">
          ‹ Veille
        </Link>
        <h1 className="text-center font-semibold">{jour === aujourdhui ? "Aujourd'hui" : capitalize(formatDateMedium(jour))}</h1>
        {jour < aujourdhui ? (
          <Link href={`/salon/bilan?jour=${addDays(jour, 1)}`} className="min-h-11 px-2 py-3 text-sm underline">
            Lendemain ›
          </Link>
        ) : (
          <span className="w-20" />
        )}
      </nav>

      <div className="grid grid-cols-2 gap-2">
        <div className="col-span-2 rounded-xl bg-noir p-4 text-white">
          <p className="text-sm text-white/70">Chiffre d&apos;affaires encaissé</p>
          <p className="text-3xl font-bold text-or">{formatFcfa(b.total)}</p>
        </div>
        <Kpi label="Espèces" valeur={formatFcfa(b.especes)} />
        <Kpi label="Mobile money" valeur={formatFcfa(b.mobileMoney)} />
        <Kpi label="Prestations terminées" valeur={String(b.terminees)} />
        <Kpi label="Encore en cours" valeur={String(b.enCours)} />
      </div>

      <Section titre="Coiffeuse la plus demandée">
        <Carte>
          {b.plusDemandees.noms.length ? (
            <>
              <p className="font-semibold">{b.plusDemandees.noms.join(", ")}</p>
              <p className="text-sm text-sourdine">
                {b.plusDemandees.nombre} prestation{b.plusDemandees.nombre > 1 ? "s" : ""} terminée{b.plusDemandees.nombre > 1 ? "s" : ""}
                {b.plusDemandees.noms.length > 1 ? " chacune" : ""}
              </p>
            </>
          ) : (
            <p className="text-sm text-sourdine">Pas encore de prestation terminée.</p>
          )}
        </Carte>
      </Section>

      <Section titre="Absences" nombre={b.absences.length}>
        <Carte>
          <p className="text-sm">
            {b.absences.length ? b.absences.map((a) => `${a.nom} (${a.motif === "conge" ? "congé" : "absente"})`).join(", ") : "Aucune absence"}
          </p>
        </Carte>
      </Section>

      <Section titre="Prestations terminées" nombre={b.liste.length}>
        {b.liste.length === 0 && <Vide>Aucune prestation terminée ce jour-là.</Vide>}
        {b.liste.map((p) => (
          <Carte key={p.id} className="flex items-center justify-between gap-3 py-2.5">
            <div className="min-w-0">
              <p className="font-semibold">{p.client}</p>
              <p className="text-sm text-sourdine">{p.coiffeuses.join(" + ")}</p>
            </div>
            <div className="text-right">
              <p className="font-semibold">{formatFcfa(p.prix)}</p>
              <p className="text-sm text-sourdine">{p.paiement === "especes" ? "Espèces" : "Mobile money"}</p>
            </div>
          </Carte>
        ))}
      </Section>
    </div>
  );
}

function Kpi({ label, valeur }: { label: string; valeur: string }) {
  return (
    <div className="rounded-xl border border-trait bg-white p-3">
      <p className="text-xs text-sourdine">{label}</p>
      <p className="mt-0.5 text-lg font-bold">{valeur}</p>
    </div>
  );
}
