"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import { JOURS_SEMAINE, type HoraireSaisi } from "@/lib/salon/creneaux";
import type { Reglages, ServiceReglage } from "@/server/salon/service";
import { enregistrerHorairesAction, enregistrerServiceAction } from "../actions";
import { Carte, classeInput, Section, Vide } from "../ui";

const ORDRE_JOURS = [1, 2, 3, 4, 5, 6, 0];
const PAUSES = [0, 15, 30, 45, 60];
const DUREES = Array.from({ length: 23 }, (_, i) => 30 + i * 15).concat([360, 420, 480, 540, 600, 660, 720]);
const libelleDuree = (m: number) => (m < 60 ? `${m} min` : `${Math.floor(m / 60)} h${m % 60 ? ` ${String(m % 60).padStart(2, "0")}` : ""}`);

export function ReglagesSalon({ reglages }: { reglages: Reglages }) {
  return (
    <div>
      <h1 className="font-display text-2xl font-bold">Réglages</h1>
      <p className="mt-1 text-sm text-sourdine">Horaires, pause et services : c&apos;est ce qui permet de proposer des créneaux libres aux clientes.</p>
      <Horaires reglages={reglages} />
      <Services services={reglages.services} />
    </div>
  );
}

function Horaires({ reglages }: { reglages: Reglages }) {
  const toast = useToast();
  const [enCours, start] = useTransition();
  const [jours, setJours] = useState<HoraireSaisi[]>(reglages.horaires);
  const [pause, setPause] = useState(reglages.pauseMin);
  const maj = (jour: number, p: Partial<HoraireSaisi>) => setJours((js) => js.map((j) => (j.jour === jour ? { ...j, ...p } : j)));
  const enregistrer = () =>
    start(async () => {
      const r = await enregistrerHorairesAction(jours, pause);
      toast(r.ok ? "succes" : "erreur", r.ok ? "Horaires enregistrés" : r.erreur);
    });

  return (
    <Section titre="Horaires d'ouverture">
      {!reglages.horairesConfigures && (
        <p role="status" className="rounded-xl bg-or-pale px-3 py-2 text-sm text-or-fonce">
          Les horaires ne sont pas encore enregistrés : les clientes ne peuvent pas encore voir de créneaux. Vérifiez les heures puis enregistrez.
        </p>
      )}
      <Carte>
        <ul className="flex flex-col gap-3">
          {ORDRE_JOURS.map((n) => {
            const j = jours.find((x) => x.jour === n)!;
            return (
              <li key={n} className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
                <label className="flex min-h-11 w-32 items-center gap-2.5 text-sm font-semibold">
                  <input type="checkbox" checked={j.ouvert} onChange={(e) => maj(n, { ouvert: e.target.checked })} className="size-5" />
                  {JOURS_SEMAINE[n]}
                </label>
                {j.ouvert ? (
                  <div className="flex items-center gap-2 text-sm">
                    <input type="time" step={900} aria-label={`${JOURS_SEMAINE[n]} : ouverture`} value={j.ouvre} onChange={(e) => maj(n, { ouvre: e.target.value })} className={`${classeInput} h-11 w-28 px-2 text-center`} />
                    <span aria-hidden>à</span>
                    <input type="time" step={900} aria-label={`${JOURS_SEMAINE[n]} : fermeture`} value={j.ferme} onChange={(e) => maj(n, { ferme: e.target.value })} className={`${classeInput} h-11 w-28 px-2 text-center`} />
                  </div>
                ) : (
                  <span className="text-sm text-sourdine">Fermé</span>
                )}
              </li>
            );
          })}
        </ul>
        <label className="mt-5 flex flex-col gap-1.5">
          <span className="text-sm font-semibold">Pause entre deux clientes d&apos;une même coiffeuse</span>
          <select value={pause} onChange={(e) => setPause(Number(e.target.value))} className={classeInput}>
            {PAUSES.map((p) => (
              <option key={p} value={p}>
                {p === 0 ? "Aucune pause" : `${p} minutes`}
              </option>
            ))}
          </select>
        </label>
        <div className="mt-4">
          <Button variant="noir" size="lg" loading={enCours} onClick={enregistrer}>
            Enregistrer les horaires
          </Button>
        </div>
      </Carte>
    </Section>
  );
}

function Services({ services }: { services: ServiceReglage[] }) {
  return (
    <Section titre="Durée et prix des services" nombre={services.length}>
      {services.length === 0 ? <Vide>Aucun service. Ajoutez-en depuis l&apos;onglet Équipe.</Vide> : services.map((s) => <LigneService key={s.id} service={s} />)}
    </Section>
  );
}

function LigneService({ service }: { service: ServiceReglage }) {
  const toast = useToast();
  const [enCours, start] = useTransition();
  const [duree, setDuree] = useState<number | null>(service.dureeMin);
  const [prix, setPrix] = useState(service.prix === null ? "" : String(service.prix));
  const enregistrer = () =>
    start(async () => {
      const r = await enregistrerServiceAction(service.id, duree, prix.trim() === "" ? null : Number(prix.replace(/\s/g, "")));
      toast(r.ok ? "succes" : "erreur", r.ok ? `« ${service.nom} » enregistré` : r.erreur);
    });
  return (
    <Carte ton={service.dureeMin === null ? "or" : undefined}>
      <p className="font-semibold">{service.nom}</p>
      {service.dureeMin === null && <p className="text-xs text-or-fonce">Durée non réglée : ce service ne peut pas encore être réservé en ligne.</p>}
      <div className="mt-2 grid grid-cols-2 gap-3">
        <label className="flex flex-col gap-1 text-xs font-semibold">
          Durée
          <select value={duree ?? ""} onChange={(e) => setDuree(e.target.value === "" ? null : Number(e.target.value))} className={`${classeInput} h-11 text-sm font-normal`}>
            <option value="">Non réglée</option>
            {[...new Set(DUREES)].sort((a, b) => a - b).map((d) => (
              <option key={d} value={d}>
                {libelleDuree(d)}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-xs font-semibold">
          Prix (FCFA)
          <input inputMode="numeric" value={prix} onChange={(e) => setPrix(e.target.value)} placeholder="Facultatif" className={`${classeInput} h-11 text-sm font-normal`} />
        </label>
      </div>
      <div className="mt-3">
        <Button variant="contour" size="sm" loading={enCours} onClick={enregistrer}>
          Enregistrer
        </Button>
      </div>
    </Carte>
  );
}
