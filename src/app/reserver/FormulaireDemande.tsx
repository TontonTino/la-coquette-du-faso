"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Champ, Choix, classeInput } from "@/app/salon/ui";
import { Button } from "@/components/ui/Button";
import { JOURS_RESERVABLES, MOMENTS } from "@/lib/salon/regles";
import { addDays, dateChip, weekday } from "@/lib/time";
import type { SalonPublic } from "@/server/salon/service";
import { envoyerDemandeAction } from "./actions";

/** FR-B01 / FR-B02 : formulaire de demande, pensé pour un téléphone et une saisie en une minute. */
export function FormulaireDemande({ salon, aujourdhui, typeInitial }: { salon: SalonPublic; aujourdhui: string; typeInitial: string }) {
  const router = useRouter();
  const [enCours, start] = useTransition();
  const [type, setType] = useState(typeInitial);
  const [jour, setJour] = useState(aujourdhui);
  const [moment, setMoment] = useState<string>("");
  const [coiffeuse, setCoiffeuse] = useState("");
  const [nom, setNom] = useState("");
  const [tel, setTel] = useState("");
  const [remarque, setRemarque] = useState("");
  const [piege, setPiege] = useState("");
  const [erreurs, setErreurs] = useState<{ nom?: string; tel?: string; global?: string }>({});

  const jours = Array.from({ length: 7 }, (_, i) => {
    const j = addDays(aujourdhui, i);
    const c = dateChip(j);
    return { valeur: j, label: i === 0 ? "Aujourd'hui" : i === 1 ? "Demain" : `${c.weekday} ${c.day}` };
  });
  // Coiffeuses qui savent faire ce type et ne sont pas en congé ce jour-là (le serveur revérifie).
  const coiffeusesPossibles = salon.coiffeuses.filter(
    (c) => (!type || c.categorieIds.includes(type)) && !c.joursConge.includes(weekday(jour)),
  );
  const coiffeuseValide = coiffeusesPossibles.some((c) => c.id === coiffeuse) ? coiffeuse : "";

  const envoyer = () => {
    const e: typeof erreurs = {};
    if (nom.trim().length < 2) e.nom = "Indiquez votre nom.";
    if (tel.replace(/\D/g, "").length < 8) e.tel = "Indiquez votre numéro WhatsApp (8 chiffres).";
    setErreurs(e);
    if (e.nom || e.tel) return;
    start(async () => {
      const r = await envoyerDemandeAction({
        clientNom: nom,
        clientTel: tel,
        categorieId: type || null,
        jour,
        moment: moment || null,
        coiffeuseSouhaitee: coiffeuseValide || null,
        remarque,
        piege,
      });
      if (r.ok) router.push(`/demande/${r.valeur.reference}`);
      else setErreurs({ global: r.erreur });
    });
  };

  const dateMax = addDays(aujourdhui, JOURS_RESERVABLES);

  return (
    <div className="mt-6 rounded-2xl border border-trait bg-white p-4">
      <Champ groupe label="1. Quelle coiffure ?">
        <Choix
          libelle="Type de coiffure"
          options={[...salon.categories.map((c) => ({ valeur: c.id, label: c.nom })), { valeur: "", label: "Je ne sais pas encore" }]}
          valeur={type}
          onChange={setType}
        />
      </Champ>

      <Champ groupe label="2. Quel jour ?">
        <Choix libelle="Jour" options={jours} valeur={jour} onChange={setJour} />
        <label className="mt-1 flex items-center gap-2 text-sm text-sourdine">
          Autre date :
          <input
            type="date"
            min={aujourdhui}
            max={dateMax}
            value={jour}
            onChange={(e) => e.target.value && setJour(e.target.value)}
            className="h-11 rounded-full border border-trait bg-white px-3 text-sm text-encre"
          />
        </label>
      </Champ>

      <Champ groupe label="3. À quel moment ?">
        <Choix
          libelle="Moment de la journée"
          options={[...MOMENTS.map((m) => ({ valeur: m.valeur as string, label: `${m.label} · ${m.plage}` })), { valeur: "", label: "Peu importe" }]}
          valeur={moment}
          onChange={setMoment}
        />
      </Champ>

      <Champ groupe label="4. Une coiffeuse en particulier ?" aide="Seules celles qui font ce type de coiffure et travaillent ce jour-là sont proposées.">
        <Choix
          libelle="Coiffeuse souhaitée"
          options={[{ valeur: "", label: "Peu importe" }, ...coiffeusesPossibles.map((c) => ({ valeur: c.id, label: c.nom }))]}
          valeur={coiffeuseValide}
          onChange={setCoiffeuse}
        />
      </Champ>

      <Champ label="5. Votre nom" erreur={erreurs.nom}>
        <input className={classeInput} value={nom} onChange={(e) => (setNom(e.target.value), setErreurs((x) => ({ ...x, nom: undefined })))} autoComplete="name" placeholder="Ex. : Aminata O." />
      </Champ>
      <Champ label="Votre numéro WhatsApp" erreur={erreurs.tel} aide="Le salon vous confirmera l'heure sur ce numéro.">
        <input className={classeInput} value={tel} onChange={(e) => (setTel(e.target.value), setErreurs((x) => ({ ...x, tel: undefined })))} type="tel" inputMode="tel" autoComplete="tel" placeholder="70 12 34 56" />
      </Champ>
      <Champ label="Précisions (facultatif)" aide="Longueur, couleur… Vous pourrez envoyer la photo du modèle sur WhatsApp juste après.">
        <input className={classeInput} value={remarque} onChange={(e) => setRemarque(e.target.value)} maxLength={200} />
      </Champ>

      {/* Piège à robots : invisible pour les personnes, ignoré par les lecteurs d'écran. */}
      <div aria-hidden="true" className="absolute -left-[9999px] h-0 overflow-hidden">
        <label>
          Ne pas remplir
          <input tabIndex={-1} autoComplete="off" value={piege} onChange={(e) => setPiege(e.target.value)} />
        </label>
      </div>

      {erreurs.global && (
        <p role="alert" className="mb-4 rounded-xl bg-rouge-pale px-3 py-2 text-sm text-rouge">
          {erreurs.global}
        </p>
      )}
      <Button variant="or" size="lg" className="w-full" loading={enCours} onClick={envoyer}>
        Envoyer ma demande
      </Button>
      <p className="mt-3 text-center text-xs text-sourdine">
        Ce n&apos;est pas encore une confirmation : le salon vous répond sur WhatsApp avec l&apos;heure exacte.
      </p>
    </div>
  );
}
