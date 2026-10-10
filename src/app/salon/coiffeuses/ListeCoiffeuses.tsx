"use client";

import { useTransition } from "react";
import { useToast } from "@/components/ui/Toast";
import type { Journee, LigneCoiffeuse } from "@/lib/salon/vue";
import { basculerAbsenceAction } from "../actions";
import { Carte, Section, Vide } from "../ui";

const ETAT: Record<LigneCoiffeuse["etat"], { texte: string; classe: string; avatar: string }> = {
  libre: { texte: "Libre", classe: "text-vert", avatar: "bg-or-pale text-or-fonce" },
  occupee: { texte: "Occupée", classe: "text-encre", avatar: "bg-noir text-or" },
  absente: { texte: "Absente aujourd'hui", classe: "text-sourdine", avatar: "bg-gris text-sourdine" },
  conge: { texte: "Jour de congé", classe: "text-sourdine", avatar: "bg-gris text-sourdine" },
};

const initiales = (nom: string) =>
  nom
    .split(/\s+/)
    .map((m) => m.charAt(0))
    .join("")
    .slice(0, 2)
    .toUpperCase();

export function ListeCoiffeuses({ lignes, compteurs, jour }: { lignes: LigneCoiffeuse[]; compteurs: Journee["compteurs"]; jour: string }) {
  const toast = useToast();
  const [enCours, start] = useTransition();

  const basculer = (l: LigneCoiffeuse) =>
    start(async () => {
      const r = await basculerAbsenceAction(l.id, jour);
      if (!r.ok) return toast("erreur", r.erreur);
      if (!r.valeur.absente) toast("succes", `Absence de ${l.nom} annulée`);
      else if (r.valeur.aReattribuer > 0)
        toast("info", `${l.nom} absente`, `${r.valeur.aReattribuer} rendez-vous à réattribuer : voir l'onglet Salon.`);
      else toast("succes", `${l.nom} marquée absente`);
    });

  return (
    <div>
      <div className="grid grid-cols-3 gap-2 text-center">
        {[
          { n: compteurs.libres, l: "libres", c: "text-vert" },
          { n: compteurs.occupees, l: "occupées", c: "text-encre" },
          { n: compteurs.absentes, l: "absentes", c: "text-sourdine" },
        ].map((x) => (
          <div key={x.l} className="rounded-xl border border-trait bg-white p-2">
            <p className={`text-xl font-bold ${x.c}`}>{x.n}</p>
            <p className="text-xs text-sourdine">{x.l}</p>
          </div>
        ))}
      </div>
      <Section titre={`Les ${compteurs.total} coiffeuses, maintenant`}>
        {lignes.length === 0 && <Vide>Aucune coiffeuse enregistrée. La gérante peut les ajouter dans l&apos;onglet Équipe.</Vide>}
        {lignes.map((l) => {
          const e = ETAT[l.etat];
          return (
            <Carte key={l.id} className="flex items-center gap-3 py-2.5">
              <span className={`flex size-10 shrink-0 items-center justify-center rounded-full text-sm font-semibold ${e.avatar}`} aria-hidden>
                {initiales(l.nom)}
              </span>
              <div className="min-w-0 flex-1">
                <p className="font-semibold">{l.nom}</p>
                <p className={`text-sm font-medium ${e.classe}`}>{l.etat === "occupee" ? `Occupée jusqu'à ${l.jusqua}` : e.texte}</p>
                {(l.avec || l.prochain) && (
                  <p className="text-xs text-sourdine">
                    {l.avec && `Avec ${l.avec}`}
                    {l.avec && l.prochain && " · "}
                    {l.prochain && `Prochain RDV ${l.prochain.heure} (${l.prochain.client})`}
                  </p>
                )}
              </div>
              {l.etat !== "conge" && (
                <button type="button" disabled={enCours} onClick={() => basculer(l)} className="min-h-11 shrink-0 px-1 text-sm text-sourdine underline">
                  {l.etat === "absente" ? "Annuler l'absence" : "Absente ?"}
                </button>
              )}
            </Carte>
          );
        })}
      </Section>
    </div>
  );
}
