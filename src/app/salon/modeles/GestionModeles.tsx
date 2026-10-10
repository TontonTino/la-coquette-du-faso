"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/Button";
import { IconImage } from "@/components/ui/icons";
import { useToast } from "@/components/ui/Toast";
import { reduireImage } from "@/lib/salon/image-client";
import { DUREES_RAPIDES, fourchetteDuree, fourchettePrix } from "@/lib/salon/regles";
import type { Categorie, Modele } from "@/lib/salon/types";
import { formatDuration } from "@/lib/time";
import { ajouterModeleAction, modifierModeleAction } from "../actions";
import { Carte, Champ, classeInput, Section, Vide } from "../ui";

interface Brouillon {
  id: string | null;
  nom: string;
  categorieId: string;
  prixMin: string;
  prixMax: string;
  dureeMin: string;
  dureeMax: string;
  actif: boolean;
  photo: string | null; // nouvelle photo (data URL), sinon on garde l'ancienne
  apercu: string | null;
}

const vide: Brouillon = { id: null, nom: "", categorieId: "", prixMin: "", prixMax: "", dureeMin: "", dureeMax: "", actif: true, photo: null, apercu: null };
const versBrouillon = (m: Modele): Brouillon => ({
  id: m.id,
  nom: m.nom,
  categorieId: m.categorieId ?? "",
  prixMin: m.prixMin?.toString() ?? "",
  prixMax: m.prixMax?.toString() ?? "",
  dureeMin: m.dureeMin?.toString() ?? "",
  dureeMax: m.dureeMax?.toString() ?? "",
  actif: m.actif,
  photo: null,
  apercu: m.photoUrl,
});
const nombre = (v: string) => (v.trim() === "" ? null : Number.parseInt(v.replace(/\D/g, ""), 10));

/** FR-C02, FR-C03 : la gérante gère le catalogue de modèles en photo, depuis son téléphone. */
export function GestionModeles({ modeles, categories }: { modeles: Modele[]; categories: Categorie[] }) {
  const toast = useToast();
  const [enCours, start] = useTransition();
  const [b, setB] = useState<Brouillon | null>(null);
  const [preparation, setPreparation] = useState(false);
  const nomType = new Map(categories.map((c) => [c.id, c.nom]));

  const choisirPhoto = async (f: File | undefined) => {
    if (!f || !b) return;
    setPreparation(true);
    try {
      const url = await reduireImage(f);
      setB({ ...b, photo: url, apercu: url });
    } catch (e) {
      toast("erreur", (e as Error).message || "Photo illisible.");
    } finally {
      setPreparation(false);
    }
  };

  const enregistrer = () => {
    if (!b) return;
    if (b.nom.trim().length < 2) return toast("erreur", "Donnez un nom au modèle.");
    if (!b.id && !b.photo) return toast("erreur", "Ajoutez une photo.");
    const saisie = {
      nom: b.nom,
      categorieId: b.categorieId || null,
      prixMin: nombre(b.prixMin),
      prixMax: nombre(b.prixMax),
      dureeMin: nombre(b.dureeMin),
      dureeMax: nombre(b.dureeMax),
      photo: b.photo,
      actif: b.actif,
    };
    start(async () => {
      const r = b.id ? await modifierModeleAction(b.id, saisie) : await ajouterModeleAction(saisie);
      if (!r.ok) return toast("erreur", r.erreur);
      toast("succes", b.id ? "Modèle enregistré" : `« ${b.nom.trim()} » ajouté au catalogue`);
      setB(null);
    });
  };

  if (b) {
    return (
      <div>
        <button type="button" onClick={() => setB(null)} className="-ml-2 min-h-11 rounded-full px-3 text-sm font-medium text-sourdine hover:bg-noir/5 hover:text-encre">
          ‹ Retour
        </button>
        <h1 className="mt-1 font-display text-[2.2rem] leading-none font-bold">{b.id ? "Modifier le modèle" : "Nouveau modèle"}</h1>
        <Carte className="mt-4">
          <div className="mb-5">
            <label className="group relative block cursor-pointer">
              {b.apercu ? (
                // eslint-disable-next-line @next/next/no-img-element -- photo servie par l'application (ou aperçu local)
                <img src={b.apercu} alt="Aperçu du modèle" className="aspect-[4/5] w-full rounded-[1.25rem] object-cover" />
              ) : (
                <span className="flex aspect-[4/5] w-full flex-col items-center justify-center gap-2 rounded-[1.25rem] border-2 border-dashed border-or/50 bg-or-pale/40 text-or-fonce group-hover:border-or">
                  <IconImage width={40} height={40} strokeWidth={1.3} />
                  <span className="text-sm font-medium">Touchez pour choisir une photo</span>
                </span>
              )}
              <span
                className={`mt-3 flex min-h-12 items-center justify-center rounded-full text-sm font-medium ${b.apercu ? "border border-noir/15 bg-white" : "bg-noir text-white"}`}
              >
                {preparation ? "Préparation de la photo…" : b.apercu ? "Changer la photo" : "Choisir une photo"}
              </span>
              <input type="file" accept="image/*" className="sr-only" onChange={(e) => choisirPhoto(e.target.files?.[0])} />
            </label>
          </div>
          <Champ label="Nom du modèle">
            <input className={classeInput} value={b.nom} onChange={(e) => setB({ ...b, nom: e.target.value })} placeholder="Ex. : Nattes collées et vanilles" maxLength={60} />
          </Champ>
          <Champ groupe label="Type de coiffure" aide="Sert à proposer les coiffeuses qui savent le faire.">
            <div className="flex flex-wrap gap-2">
              {[...categories.map((c) => ({ v: c.id, l: c.nom })), { v: "", l: "Aucun" }].map((o) => (
                <button
                  key={o.v || "aucun"}
                  type="button"
                  aria-pressed={b.categorieId === o.v}
                  onClick={() => setB({ ...b, categorieId: o.v })}
                  className={`min-h-11 rounded-full border px-4 text-sm transition-colors ${b.categorieId === o.v ? "border-noir bg-noir font-medium text-white" : "border-trait bg-white hover:border-or"}`}
                >
                  {o.l}
                </button>
              ))}
            </div>
          </Champ>
          <div className="grid grid-cols-2 gap-2">
            <Champ label="Prix min. (FCFA)">
              <input className={classeInput} inputMode="numeric" value={b.prixMin} onChange={(e) => setB({ ...b, prixMin: e.target.value })} placeholder="5000" />
            </Champ>
            <Champ label="Prix max. (FCFA)">
              <input className={classeInput} inputMode="numeric" value={b.prixMax} onChange={(e) => setB({ ...b, prixMax: e.target.value })} placeholder="15000" />
            </Champ>
            <Champ label="Durée min.">
              <select className={classeInput} value={b.dureeMin} onChange={(e) => setB({ ...b, dureeMin: e.target.value })}>
                <option value="">—</option>
                {DUREES_RAPIDES.map((d) => (
                  <option key={d} value={d}>
                    {formatDuration(d)}
                  </option>
                ))}
              </select>
            </Champ>
            <Champ label="Durée max.">
              <select className={classeInput} value={b.dureeMax} onChange={(e) => setB({ ...b, dureeMax: e.target.value })}>
                <option value="">—</option>
                {[...DUREES_RAPIDES, 720].map((d) => (
                  <option key={d} value={d}>
                    {formatDuration(d)}
                  </option>
                ))}
              </select>
            </Champ>
          </div>
          {b.id && (
            <label className="mb-4 flex min-h-11 items-center gap-2 text-sm">
              <input type="checkbox" className="size-5" checked={b.actif} onChange={(e) => setB({ ...b, actif: e.target.checked })} />
              Proposé aux clientes
            </label>
          )}
          <Button variant="noir" size="lg" className="w-full" loading={enCours} disabled={preparation} onClick={enregistrer}>
            {b.id ? "Enregistrer" : "Ajouter au catalogue"}
          </Button>
        </Carte>
      </div>
    );
  }

  const actifs = modeles.filter((m) => m.actif);
  const retires = modeles.filter((m) => !m.actif);
  const grille = (liste: Modele[]) => (
    <div className="grid grid-cols-2 gap-x-3 gap-y-4">
      {liste.map((m) => (
        <button key={m.id} type="button" onClick={() => setB(versBrouillon(m))} className="group text-left">
          <span className="block overflow-hidden rounded-[1.25rem] shadow-carte">
            {/* eslint-disable-next-line @next/next/no-img-element -- photo servie par l'application */}
            <img src={m.photoUrl} alt="" loading="lazy" className={`aspect-[4/5] w-full object-cover transition-transform duration-500 group-hover:scale-[1.03] ${m.actif ? "" : "opacity-50 grayscale"}`} />
          </span>
          <span className="mt-2 block text-sm leading-snug font-semibold">{m.nom}</span>
          <span className="block text-xs text-sourdine">
            {[m.categorieId ? nomType.get(m.categorieId) : null, fourchettePrix(m.prixMin, m.prixMax), fourchetteDuree(m.dureeMin, m.dureeMax)].filter(Boolean).join(", ") || "Modifier"}
          </span>
        </button>
      ))}
    </div>
  );

  return (
    <div>
      <h1 className="font-display text-[2.2rem] leading-none font-bold">Modèles</h1>
      <p className="mt-2 text-sm text-sourdine">Les photos que les clientes voient sur le site pour choisir leur coiffure.</p>
      <Button variant="noir" size="lg" className="mt-3 w-full" onClick={() => setB({ ...vide })}>
        + Ajouter un modèle
      </Button>
      <p className="mt-2 text-xs text-sourdine">
        Utilisez des photos du salon. Si une cliente est reconnaissable, demandez-lui d&apos;abord son accord.
      </p>
      <Section titre="Proposés aux clientes" nombre={actifs.length} ton="or">
        {actifs.length === 0 ? <Vide>Aucun modèle pour l&apos;instant.</Vide> : grille(actifs)}
      </Section>
      {retires.length > 0 && (
        <Section titre="Retirés du catalogue" nombre={retires.length}>
          {grille(retires)}
        </Section>
      )}
    </div>
  );
}
