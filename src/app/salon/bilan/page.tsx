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
        <Link href={`/salon/bilan?jour=${addDays(jour, -1)}`} className="flex min-h-11 items-center rounded-full bg-white px-4 text-sm shadow-sm">
          ‹ Veille
        </Link>
        <h1 className="text-center font-display text-2xl font-bold">{jour === aujourdhui ? "Aujourd'hui" : capitalize(formatDateMedium(jour))}</h1>
        {jour < aujourdhui ? (
          <Link href={`/salon/bilan?jour=${addDays(jour, 1)}`} className="flex min-h-11 items-center rounded-full bg-white px-4 text-sm shadow-sm">
            Lendemain ›
          </Link>
        ) : (
          <span className="w-24" />
        )}
      </nav>

      <div className="grid grid-cols-2 gap-2">
        <div className="texture-noire col-span-2 overflow-hidden rounded-2xl p-5 text-white">
          <p className="text-sm text-white/65">Chiffre d&apos;affaires encaissé</p>
          <p className="mt-1 font-display text-[2.8rem] leading-none font-bold text-or">{formatFcfa(b.total)}</p>
          {b.total > 0 && (
            <div className="mt-4">
              <div className="flex h-2 overflow-hidden rounded-full bg-white/10" aria-hidden>
                <div className="bg-or" style={{ width: `${Math.round((b.mobileMoney / b.total) * 100)}%` }} />
                <div className="bg-white/60" style={{ width: `${Math.round((b.especes / b.total) * 100)}%` }} />
              </div>
              <div className="mt-2 flex justify-between text-xs text-white/65">
                <span>
                  <span className="mr-1.5 inline-block size-2 rounded-full bg-or" aria-hidden />
                  Mobile money {Math.round((b.mobileMoney / b.total) * 100)} %
                </span>
                <span>
                  <span className="mr-1.5 inline-block size-2 rounded-full bg-white/60" aria-hidden />
                  Espèces {Math.round((b.especes / b.total) * 100)} %
                </span>
              </div>
            </div>
          )}
        </div>
        <Kpi label="Espèces" valeur={formatFcfa(b.especes)} />
        <Kpi label="Mobile money" valeur={formatFcfa(b.mobileMoney)} />
        <Kpi label="Prestations terminées" valeur={String(b.terminees)} />
        <Kpi label="Encore en cours" valeur={String(b.enCours)} />
      </div>

      <Section titre="Coiffeuse la plus demandée" ton="or">
        <Carte ton="or">
          {b.plusDemandees.noms.length ? (
            <>
              <p className="font-display text-2xl font-bold">{b.plusDemandees.noms.join(", ")}</p>
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

      <Section titre="Absences" nombre={b.absences.length} ton="rouge">
        <Carte>
          <p className="text-sm">
            {b.absences.length ? b.absences.map((a) => `${a.nom} (${a.motif === "conge" ? "congé" : "absente"})`).join(", ") : "Aucune absence"}
          </p>
        </Carte>
      </Section>

      <Section titre="Prestations terminées" nombre={b.liste.length} ton="vert">
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
    <div className="rounded-2xl bg-white p-3.5 shadow-carte">
      <p className="text-xs text-sourdine">{label}</p>
      <p className="mt-1 font-display text-[1.6rem] leading-none font-bold">{valeur}</p>
    </div>
  );
}
