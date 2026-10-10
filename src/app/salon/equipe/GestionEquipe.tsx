"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import type { Categorie, Coiffeuse } from "@/lib/salon/types";
import { ajouterCategorieAction, ajouterCoiffeuseAction, modifierCoiffeuseAction } from "../actions";
import { Carte, Champ, classeInput, Section, Vide } from "../ui";

const JOURS = [
  { n: 1, l: "Lun" },
  { n: 2, l: "Mar" },
  { n: 3, l: "Mer" },
  { n: 4, l: "Jeu" },
  { n: 5, l: "Ven" },
  { n: 6, l: "Sam" },
  { n: 0, l: "Dim" },
];
const nomsJours = (js: number[]) => (js.length ? JOURS.filter((j) => js.includes(j.n)).map((j) => j.l).join(", ") : "aucun");

function Pastilles<T extends string | number>({
  options,
  valeur,
  onChange,
  libelle,
}: {
  options: { v: T; l: string }[];
  valeur: T[];
  onChange: (v: T[]) => void;
  libelle: string;
}) {
  return (
    <div role="group" aria-label={libelle} className="flex flex-wrap gap-1.5">
      {options.map((o) => {
        const on = valeur.includes(o.v);
        return (
          <button
            key={String(o.v)}
            type="button"
            aria-pressed={on}
            onClick={() => onChange(on ? valeur.filter((x) => x !== o.v) : [...valeur, o.v])}
            className={`min-h-11 min-w-11 rounded-full border px-3 text-sm ${on ? "border-noir bg-noir text-white" : "border-trait bg-white"}`}
          >
            {o.l}
          </button>
        );
      })}
    </div>
  );
}

/**
 * FR-001, FR-002, FR-015, FR-016 : la gérante gère les types de coiffure, les coiffeuses,
 * leurs jours de congé et ce que chacune sait faire.
 */
export function GestionEquipe({ coiffeuses, categories }: { coiffeuses: Coiffeuse[]; categories: Categorie[] }) {
  const toast = useToast();
  const [enCours, start] = useTransition();
  const [nouveauType, setNouveauType] = useState("");
  const [nom, setNom] = useState("");
  const [conges, setConges] = useState<number[]>([]);
  const [competences, setCompetences] = useState<string[]>([]);
  const [edition, setEdition] = useState<Coiffeuse | null>(null);
  const optionsTypes = categories.map((c) => ({ v: c.id, l: c.nom }));
  const nomType = new Map(categories.map((c) => [c.id, c.nom]));

  const ajouterType = () =>
    start(async () => {
      const r = await ajouterCategorieAction(nouveauType);
      if (!r.ok) return toast("erreur", r.erreur);
      toast("succes", `Type « ${nouveauType.trim()} » ajouté`);
      setNouveauType("");
    });

  const ajouter = () =>
    start(async () => {
      const r = await ajouterCoiffeuseAction({ nom, joursConge: conges, categorieIds: competences });
      if (!r.ok) return toast("erreur", r.erreur);
      toast("succes", `${nom.trim()} ajoutée à l'équipe`);
      setNom("");
      setConges([]);
      setCompetences([]);
    });

  const enregistrer = (c: Coiffeuse) =>
    start(async () => {
      const r = await modifierCoiffeuseAction(c.id, { nom: c.nom, joursConge: c.joursConge, actif: c.actif, categorieIds: c.categorieIds });
      if (!r.ok) return toast("erreur", r.erreur);
      toast("succes", "Fiche enregistrée");
      setEdition(null);
    });

  const actives = coiffeuses.filter((c) => c.actif);
  const inactives = coiffeuses.filter((c) => !c.actif);
  const sansCompetence = actives.filter((c) => c.categorieIds.length === 0).length;

  return (
    <div>
      <h1 className="font-display text-3xl font-bold">Équipe</h1>

      <Section titre="Types de coiffure" nombre={categories.length}>
        <Carte>
          {categories.length === 0 ? (
            <p className="mb-3 text-sm text-sourdine">Commencez par créer les types de coiffure du salon (ex. : Tresses, Nattes collées, Tissage).</p>
          ) : (
            <p className="mb-3 text-sm">{categories.map((c) => c.nom).join(" · ")}</p>
          )}
          <div className="flex gap-2">
            <label className="flex-1">
              <span className="sr-only">Nouveau type de coiffure</span>
              <input className={classeInput} value={nouveauType} onChange={(e) => setNouveauType(e.target.value)} placeholder="Nouveau type, ex. : Tissage" />
            </label>
            <Button variant="noir" loading={enCours} disabled={nouveauType.trim().length < 2} onClick={ajouterType}>
              Ajouter
            </Button>
          </div>
        </Carte>
      </Section>

      <Section titre="Ajouter une coiffeuse">
        <Carte>
          <Champ label="Nom">
            <input className={classeInput} value={nom} onChange={(e) => setNom(e.target.value)} placeholder="Ex. : Awa K." />
          </Champ>
          <Champ groupe label="Ce qu'elle sait faire">
            {optionsTypes.length ? (
              <Pastilles libelle="Ce qu'elle sait faire" options={optionsTypes} valeur={competences} onChange={setCompetences} />
            ) : (
              <span className="text-sm text-sourdine">Créez d&apos;abord les types de coiffure.</span>
            )}
          </Champ>
          <Champ groupe label="Jours de congé habituels">
            <Pastilles libelle="Jours de congé habituels" options={JOURS.map((j) => ({ v: j.n, l: j.l }))} valeur={conges} onChange={setConges} />
          </Champ>
          <Button variant="noir" className="w-full" loading={enCours} disabled={nom.trim().length < 2} onClick={ajouter}>
            Ajouter à l&apos;équipe
          </Button>
        </Carte>
      </Section>

      <Section titre="Coiffeuses actives" nombre={actives.length}>
        {sansCompetence > 0 && categories.length > 0 && (
          <p className="rounded-xl bg-or-pale px-3 py-2 text-sm text-or-fonce">
            {sansCompetence} coiffeuse{sansCompetence > 1 ? "s n'ont" : " n'a"} aucune spécialité renseignée : elle
            {sansCompetence > 1 ? "s ne seront proposées" : " ne sera proposée"} que si le type de coiffure n&apos;est pas précisé.
          </p>
        )}
        {actives.length === 0 && <Vide>Aucune coiffeuse pour l&apos;instant.</Vide>}
        {actives.map((c) => (
          <Fiche key={c.id} c={c} edition={edition} setEdition={setEdition} enregistrer={enregistrer} enCours={enCours} optionsTypes={optionsTypes} nomType={nomType} />
        ))}
      </Section>
      {inactives.length > 0 && (
        <Section titre="Ne font plus partie de l'équipe" nombre={inactives.length}>
          {inactives.map((c) => (
            <Fiche key={c.id} c={c} edition={edition} setEdition={setEdition} enregistrer={enregistrer} enCours={enCours} optionsTypes={optionsTypes} nomType={nomType} />
          ))}
        </Section>
      )}
    </div>
  );
}

function Fiche({
  c,
  edition,
  setEdition,
  enregistrer,
  enCours,
  optionsTypes,
  nomType,
}: {
  c: Coiffeuse;
  edition: Coiffeuse | null;
  setEdition: (c: Coiffeuse | null) => void;
  enregistrer: (c: Coiffeuse) => void;
  enCours: boolean;
  optionsTypes: { v: string; l: string }[];
  nomType: Map<string, string>;
}) {
  if (edition?.id === c.id) {
    return (
      <Carte>
        <Champ label="Nom">
          <input className={classeInput} value={edition.nom} onChange={(e) => setEdition({ ...edition, nom: e.target.value })} />
        </Champ>
        <Champ groupe label="Ce qu'elle sait faire">
          <Pastilles
            libelle="Ce qu'elle sait faire"
            options={optionsTypes}
            valeur={edition.categorieIds}
            onChange={(v) => setEdition({ ...edition, categorieIds: v })}
          />
        </Champ>
        <Champ groupe label="Jours de congé habituels">
          <Pastilles
            libelle="Jours de congé habituels"
            options={JOURS.map((j) => ({ v: j.n, l: j.l }))}
            valeur={edition.joursConge}
            onChange={(v) => setEdition({ ...edition, joursConge: v })}
          />
        </Champ>
        <label className="mb-4 flex min-h-11 items-center gap-2 text-sm">
          <input type="checkbox" className="size-5" checked={edition.actif} onChange={(e) => setEdition({ ...edition, actif: e.target.checked })} />
          Fait partie de l&apos;équipe
        </label>
        <div className="flex gap-2">
          <Button variant="noir" className="flex-1" loading={enCours} onClick={() => enregistrer(edition)}>
            Enregistrer
          </Button>
          <Button variant="contour" onClick={() => setEdition(null)}>
            Annuler
          </Button>
        </div>
      </Carte>
    );
  }
  const specialites = c.categorieIds.map((id) => nomType.get(id)).filter(Boolean);
  return (
    <Carte className="flex items-center justify-between gap-2 py-2.5">
      <div className="min-w-0">
        <p className="font-semibold">{c.nom}</p>
        <p className="text-sm text-sourdine">{specialites.length ? specialites.join(", ") : "Aucune spécialité renseignée"}</p>
        <p className="text-xs text-sourdine">Congé : {nomsJours(c.joursConge)}</p>
      </div>
      <button type="button" onClick={() => setEdition({ ...c })} className="min-h-11 shrink-0 px-2 text-sm underline">
        Modifier
      </button>
    </Carte>
  );
}
