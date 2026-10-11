"use client";

import { useState, useTransition } from "react";
import { PhotoCoiffeuse } from "@/components/public/Equipe";
import { Button } from "@/components/ui/Button";
import { IconStar } from "@/components/ui/icons";
import { useToast } from "@/components/ui/Toast";
import type { Categorie, Coiffeuse, Famille } from "@/lib/salon/types";
import type { AvisRecent } from "@/server/salon/service";
import { formatDateMedium } from "@/lib/time";
import { ajouterCategorieAction, ajouterCoiffeuseAction, modifierCoiffeuseAction, modifierWhatsappSalonAction } from "../actions";
import { ChoixPhoto } from "../ChoixPhoto";
import { Carte, Champ, Choix, classeInput, Section, Vide } from "../ui";

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
            className={`min-h-11 min-w-11 rounded-full border px-3 text-sm transition-colors ${on ? "border-noir bg-noir font-medium text-white" : "border-trait bg-white hover:border-or"}`}
          >
            {o.l}
          </button>
        );
      })}
    </div>
  );
}

const FAMILLES: { valeur: Famille; label: string }[] = [
  { valeur: "coiffure", label: "Coiffure" },
  { valeur: "ongles", label: "Ongles" },
];

/** « ★ 4,7 · 12 avis » (la gérante voit la moyenne dès le premier avis), ou « Aucun avis ». */
function Note({ c }: { c: Coiffeuse }) {
  if (c.moyenne === null) return <span className="text-xs text-sourdine">Aucun avis pour l&apos;instant</span>;
  return (
    <span className="inline-flex items-center gap-1 text-xs font-medium">
      <IconStar width={13} height={13} fill="currentColor" className="text-or" />
      {(Math.round(c.moyenne * 10) / 10).toFixed(1).replace(".", ",")}
      <span className="font-normal text-sourdine">
        · {c.nbAvis} avis{c.nbAvis < 3 ? " (affichée aux clientes dès 3 avis)" : ""}
      </span>
    </span>
  );
}

/**
 * FR-001, FR-002, FR-015, FR-016 : la gérante gère les types de service, les coiffeuses (avec leur photo),
 * leurs jours de congé et ce que chacune sait faire, et lit les avis des clientes.
 */
export function GestionEquipe({
  coiffeuses,
  categories,
  whatsappSalon,
  avis,
}: {
  coiffeuses: Coiffeuse[];
  categories: Categorie[];
  whatsappSalon: string | null;
  avis: AvisRecent[];
}) {
  const toast = useToast();
  const [enCours, start] = useTransition();
  const [nouveauType, setNouveauType] = useState("");
  const [familleType, setFamilleType] = useState<Famille>("coiffure");
  const [nom, setNom] = useState("");
  const [photo, setPhoto] = useState<string | null>(null);
  // Photo en cours de modification : absente = on garde l'ancienne, texte = nouvelle, null = retirée.
  const [photoEdition, setPhotoEdition] = useState<string | null | undefined>(undefined);
  const [conges, setConges] = useState<number[]>([]);
  const [competences, setCompetences] = useState<string[]>([]);
  const [edition, setEdition] = useState<Coiffeuse | null>(null);
  const [whatsapp, setWhatsapp] = useState(whatsappSalon ?? "");

  const enregistrerWhatsapp = () =>
    start(async () => {
      const r = await modifierWhatsappSalonAction(whatsapp);
      if (!r.ok) return toast("erreur", r.erreur);
      toast("succes", whatsapp.trim() ? "Numéro WhatsApp du salon enregistré" : "Numéro WhatsApp retiré");
    });
  const optionsTypes = categories.map((c) => ({ v: c.id, l: c.nom }));
  const nomType = new Map(categories.map((c) => [c.id, c.nom]));

  const ajouterType = () =>
    start(async () => {
      const r = await ajouterCategorieAction(nouveauType, familleType);
      if (!r.ok) return toast("erreur", r.erreur);
      toast("succes", `Service « ${nouveauType.trim()} » ajouté`);
      setNouveauType("");
    });

  const ajouter = () =>
    start(async () => {
      const r = await ajouterCoiffeuseAction({ nom, joursConge: conges, categorieIds: competences, photo });
      if (!r.ok) return toast("erreur", r.erreur);
      toast("succes", `${nom.trim()} ajoutée à l'équipe`);
      setNom("");
      setPhoto(null);
      setConges([]);
      setCompetences([]);
    });

  const enregistrer = (c: Coiffeuse) =>
    start(async () => {
      const r = await modifierCoiffeuseAction(c.id, {
        nom: c.nom,
        joursConge: c.joursConge,
        actif: c.actif,
        categorieIds: c.categorieIds,
        ...(photoEdition !== undefined ? { photo: photoEdition } : {}),
      });
      if (!r.ok) return toast("erreur", r.erreur);
      toast("succes", "Fiche enregistrée");
      setEdition(null);
      setPhotoEdition(undefined);
    });

  const actives = coiffeuses.filter((c) => c.actif);
  const inactives = coiffeuses.filter((c) => !c.actif);
  const sansCompetence = actives.filter((c) => c.categorieIds.length === 0).length;

  return (
    <div>
      <h1 className="font-display text-[2.2rem] leading-none font-bold">Équipe</h1>

      <Section titre="WhatsApp du salon">
        <Carte>
          <p className="mb-3 text-sm text-sourdine">Affiché aux clientes pour envoyer la photo du modèle ou poser une question.</p>
          <div className="flex gap-2">
            <label className="flex-1">
              <span className="sr-only">Numéro WhatsApp du salon</span>
              <input className={classeInput} value={whatsapp} onChange={(e) => setWhatsapp(e.target.value)} type="tel" inputMode="tel" placeholder="70 12 34 56" />
            </label>
            <Button variant="noir" loading={enCours} onClick={enregistrerWhatsapp}>
              Enregistrer
            </Button>
          </div>
        </Carte>
      </Section>

      <Section titre="Types de service" nombre={categories.length}>
        <Carte>
          {categories.length === 0 ? (
            <p className="mb-3 text-sm text-sourdine">Commencez par créer les services du salon (ex. : Tresses, Nattes collées, Tissage, Manucure).</p>
          ) : (
            <div className="mb-3 flex flex-col gap-2">
              {FAMILLES.map((f) => {
                const liste = categories.filter((c) => c.famille === f.valeur);
                return liste.length ? (
                  <div key={f.valeur}>
                    <p className="mb-1 text-xs font-semibold text-sourdine">{f.label}</p>
                    <ul className="flex flex-wrap gap-1.5">
                      {liste.map((c) => (
                        <li key={c.id} className="rounded-full bg-or-pale px-3 py-1 text-sm text-or-fonce">
                          {c.nom}
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null;
              })}
            </div>
          )}
          <Champ groupe label="Famille du nouveau service">
            <Choix libelle="Famille du nouveau service" options={FAMILLES.map((f) => ({ valeur: f.valeur, label: f.label }))} valeur={familleType} onChange={setFamilleType} />
          </Champ>
          <div className="flex gap-2">
            <label className="flex-1">
              <span className="sr-only">Nouveau type de service</span>
              <input className={classeInput} value={nouveauType} onChange={(e) => setNouveauType(e.target.value)} placeholder="Nouveau service, ex. : Tissage" />
            </label>
            <Button variant="noir" loading={enCours} disabled={nouveauType.trim().length < 2} onClick={ajouterType}>
              Ajouter
            </Button>
          </div>
        </Carte>
      </Section>

      <Section titre="Ajouter une coiffeuse">
        <Carte>
          <div className="mb-4">
            <ChoixPhoto nom={nom} apercu={photo} onChoisie={setPhoto} onRetirer={() => setPhoto(null)} />
          </div>
          <Champ label="Nom">
            <input className={classeInput} value={nom} onChange={(e) => setNom(e.target.value)} placeholder="Ex. : Awa K." />
          </Champ>
          <Champ groupe label="Ce qu'elle sait faire">
            {optionsTypes.length ? (
              <Pastilles libelle="Ce qu'elle sait faire" options={optionsTypes} valeur={competences} onChange={setCompetences} />
            ) : (
              <span className="text-sm text-sourdine">Créez d&apos;abord les types de service.</span>
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
            {sansCompetence > 1 ? "s ne seront proposées" : " ne sera proposée"} que si le type de service n&apos;est pas précisé.
          </p>
        )}
        {actives.length === 0 && <Vide>Aucune coiffeuse pour l&apos;instant.</Vide>}
        {actives.map((c) => (
          <Fiche key={c.id} c={c} edition={edition} setEdition={setEdition} enregistrer={enregistrer} enCours={enCours} optionsTypes={optionsTypes} nomType={nomType} photoEdition={photoEdition} setPhotoEdition={setPhotoEdition} />
        ))}
      </Section>
      <Section titre="Avis récents des clientes" nombre={avis.length}>
        {avis.length === 0 ? (
          <Vide>Les avis apparaîtront ici dès que des clientes noteront leur coiffeuse.</Vide>
        ) : (
          avis.map((a, i) => (
            <Carte key={i} ton={a.note <= 2 ? "rouge" : a.note >= 4 ? "vert" : "neutre"} className="py-2.5">
              <p className="flex items-center justify-between gap-2 text-sm">
                <span className="font-semibold">{a.coiffeuse}</span>
                <span className="inline-flex items-center gap-1 font-medium">
                  <IconStar width={14} height={14} fill="currentColor" className="text-or" />
                  {a.note}/5
                </span>
              </p>
              {a.commentaire && <p className="mt-0.5 text-sm text-sourdine italic">« {a.commentaire} »</p>}
              <p className="mt-0.5 text-xs text-sourdine">{formatDateMedium(a.jour)}</p>
            </Carte>
          ))
        )}
      </Section>
      {inactives.length > 0 && (
        <Section titre="Ne font plus partie de l'équipe" nombre={inactives.length}>
          {inactives.map((c) => (
            <Fiche key={c.id} c={c} edition={edition} setEdition={setEdition} enregistrer={enregistrer} enCours={enCours} optionsTypes={optionsTypes} nomType={nomType} photoEdition={photoEdition} setPhotoEdition={setPhotoEdition} />
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
  photoEdition,
  setPhotoEdition,
}: {
  c: Coiffeuse;
  edition: Coiffeuse | null;
  setEdition: (c: Coiffeuse | null) => void;
  enregistrer: (c: Coiffeuse) => void;
  enCours: boolean;
  optionsTypes: { v: string; l: string }[];
  nomType: Map<string, string>;
  photoEdition: string | null | undefined;
  setPhotoEdition: (p: string | null | undefined) => void;
}) {
  if (edition?.id === c.id) {
    return (
      <Carte>
        <div className="mb-4">
          <ChoixPhoto
            nom={edition.nom}
            apercu={photoEdition === undefined ? c.photoUrl : photoEdition}
            onChoisie={setPhotoEdition}
            onRetirer={() => setPhotoEdition(null)}
          />
        </div>
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
          <Button
            variant="contour"
            onClick={() => {
              setEdition(null);
              setPhotoEdition(undefined);
            }}
          >
            Annuler
          </Button>
        </div>
      </Carte>
    );
  }
  const specialites = c.categorieIds.map((id) => nomType.get(id)).filter(Boolean);
  return (
    <Carte className="flex items-center justify-between gap-3 py-2.5">
      <PhotoCoiffeuse nom={c.nom} photoUrl={c.photoUrl} className="size-12 shrink-0 overflow-hidden rounded-full text-lg" />
      <div className="min-w-0 flex-1">
        <p className="font-semibold">{c.nom}</p>
        <p className="text-sm text-sourdine">{specialites.length ? specialites.join(", ") : "Aucune spécialité renseignée"}</p>
        <p className="text-xs text-sourdine">Congé : {nomsJours(c.joursConge)}</p>
        <Note c={c} />
      </div>
      <button
        type="button"
        onClick={() => {
          setPhotoEdition(undefined);
          setEdition({ ...c });
        }} className="min-h-11 shrink-0 rounded-full border border-trait px-3 text-sm hover:border-or"
      >
        Modifier
      </button>
    </Carte>
  );
}
