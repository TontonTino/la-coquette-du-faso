"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition, type ReactNode } from "react";
import { NoteCoiffeuse, PhotoCoiffeuse } from "@/components/public/Equipe";
import { Alerte, ChampPublic, ChoixPublic, classeChamp } from "@/components/public/formulaire";
import { Button } from "@/components/ui/Button";
import { IconCheck, IconInfini, IconSun, IconSunrise, IconSunset } from "@/components/ui/icons";
import { fourchetteDuree, fourchettePrix, JOURS_RESERVABLES, MOMENTS } from "@/lib/salon/regles";
import type { Famille } from "@/lib/salon/types";
import { addDays, capitalize, dateChip, formatDateMedium, weekday } from "@/lib/time";
import type { SalonPublic } from "@/server/salon/service";
import { envoyerDemandeAction } from "./actions";

const ICONES_MOMENT: Record<string, ReactNode> = {
  matin: <IconSunrise />,
  apres_midi: <IconSun />,
  fin_journee: <IconSunset />,
  "": <IconInfini />,
};

const FAMILLES: { valeur: Famille; label: string }[] = [
  { valeur: "coiffure", label: "Coiffure" },
  { valeur: "ongles", label: "Ongles" },
];

/** Titre d'une étape du formulaire : un numéro, car c'est un parcours dans l'ordre. */
function Etape({ n, titre, aide, children }: { n: number; titre: string; aide?: string; children: ReactNode }) {
  return (
    <section className="border-t border-trait py-6 first:border-t-0 first:pt-2">
      <div className="mb-4 flex items-start gap-3">
        <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-marque font-display text-lg font-bold text-detail" aria-hidden>
          {n}
        </span>
        <div className="pt-0.5">
          <h2 className="text-[17px] font-semibold">{titre}</h2>
          {aide && <p className="mt-0.5 text-sm text-sourdine">{aide}</p>}
        </div>
      </div>
      {children}
    </section>
  );
}

/** FR-B01 / FR-B02 : formulaire de demande, pensé pour un téléphone et une saisie en une minute. */
export function FormulaireDemande({
  salon,
  aujourdhui,
  typeInitial,
  modeleInitial,
  coiffeuseInitiale,
}: {
  salon: SalonPublic;
  aujourdhui: string;
  typeInitial: string;
  modeleInitial: string;
  coiffeuseInitiale: string;
}) {
  const router = useRouter();
  const rangee = useRef<HTMLDivElement>(null);
  // Modèle choisi depuis l'accueil : on le fait venir au centre de la rangée de photos.
  useEffect(() => {
    if (!modeleInitial) return;
    const el = rangee.current?.querySelector<HTMLElement>(`[data-modele="${modeleInitial}"]`);
    if (el && rangee.current) rangee.current.scrollLeft = el.offsetLeft - (rangee.current.clientWidth - el.clientWidth) / 2;
  }, [modeleInitial]);
  const [enCours, start] = useTransition();
  const [modele, setModele] = useState(modeleInitial);
  const [typeChoisi, setType] = useState(typeInitial);
  const modeleChoisi = salon.modeles.find((m) => m.id === modele) ?? null;
  // Le type d'un modèle choisi sur photo prime (il sert à proposer les bonnes coiffeuses).
  const type = modeleChoisi ? (modeleChoisi.categorieId ?? "") : typeChoisi;
  // Familles de services proposées (coiffure, ongles) : l'onglet n'apparaît que s'il y en a plusieurs.
  const familleDe = (categorieId: string | null): Famille => salon.categories.find((c) => c.id === categorieId)?.famille ?? "coiffure";
  const famillesPresentes = FAMILLES.filter((f) => salon.categories.some((c) => c.famille === f.valeur));
  const [familleChoisie, setFamille] = useState<Famille>(familleDe(modeleChoisi?.categorieId ?? (typeInitial || null)));
  const famille = type || modeleChoisi ? familleDe(type || null) : familleChoisie;
  const typesVisibles = salon.categories.filter((c) => c.famille === famille);
  const [jour, setJour] = useState(aujourdhui);
  const [moment, setMoment] = useState<string>("");
  const [coiffeuse, setCoiffeuse] = useState(coiffeuseInitiale);
  const [nom, setNom] = useState("");
  const [tel, setTel] = useState("");
  const [remarque, setRemarque] = useState("");
  const [piege, setPiege] = useState("");
  const [erreurs, setErreurs] = useState<{ nom?: string; tel?: string; global?: string }>({});

  const jours = Array.from({ length: 14 }, (_, i) => {
    const j = addDays(aujourdhui, i);
    return { valeur: j, ...dateChip(j), label: i === 0 ? "Aujourd'hui" : i === 1 ? "Demain" : null };
  });
  const jourHorsListe = !jours.some((j) => j.valeur === jour);
  // Coiffeuses qui savent faire ce type et ne sont pas en congé ce jour-là (le serveur revérifie).
  const coiffeusesPossibles = salon.coiffeuses.filter(
    (c) => (!type || c.categorieIds.includes(type)) && !c.joursConge.includes(weekday(jour)),
  );
  const coiffeuseValide = coiffeusesPossibles.some((c) => c.id === coiffeuse) ? coiffeuse : "";
  // Coiffeuse choisie (ex. depuis « Notre équipe ») mais non proposée pour ce service ce jour-là : on le dit, sans rien cacher.
  const coiffeuseEcartee = coiffeuse && !coiffeuseValide ? (salon.coiffeuses.find((c) => c.id === coiffeuse)?.nom ?? null) : null;
  const nomType = salon.categories.find((c) => c.id === type)?.nom ?? null;
  const resume = [
    modeleChoisi?.nom ?? nomType ?? "Coiffure à préciser",
    capitalize(formatDateMedium(jour)),
    MOMENTS.find((m) => m.valeur === moment)?.label ?? null,
  ]
    .filter(Boolean)
    .join(", ");

  const envoyer = () => {
    const e: typeof erreurs = {};
    if (nom.trim().length < 2) e.nom = "Indiquez votre nom.";
    if (tel.replace(/\D/g, "").length < 8) e.tel = "Indiquez votre numéro WhatsApp (8 chiffres).";
    setErreurs(e);
    if (e.nom || e.tel) {
      // Le curseur va dans le premier champ à corriger (clavier et lecteurs d'écran).
      document.getElementById(e.nom ? "champ-nom" : "champ-tel")?.focus();
      return;
    }
    start(async () => {
      const r = await envoyerDemandeAction({
        clientNom: nom,
        clientTel: tel,
        categorieId: type || null,
        modeleId: modeleChoisi?.id ?? null,
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
  const modelesVisibles = type ? salon.modeles.filter((m) => m.categorieId === type) : salon.modeles.filter((m) => familleDe(m.categorieId) === famille);
  let n = 0;

  return (
    <div className="mt-4">
      <Etape
        n={++n}
        titre={famillesPresentes.length > 1 ? "Quel service ?" : "Quelle coiffure ?"}
        aide={salon.modeles.length ? "Choisissez le type, puis un modèle en photo si vous voulez." : undefined}
      >
        {famillesPresentes.length > 1 && (
          <div className="mb-3">
            <ChoixPublic
              libelle="Famille de service"
              options={famillesPresentes.map((f) => ({ valeur: f.valeur, label: f.label }))}
              valeur={famille}
              onChange={(f) => {
                setFamille(f);
                setType("");
                setModele("");
              }}
            />
          </div>
        )}
        <ChoixPublic
          libelle="Type de service"
          options={[...typesVisibles.map((c) => ({ valeur: c.id, label: c.nom })), { valeur: "", label: "Je ne sais pas encore" }]}
          valeur={type}
          onChange={(v) => {
            setType(v);
            // Un modèle d'un autre type n'a plus de sens : on le retire.
            if (modeleChoisi && v && modeleChoisi.categorieId !== v) setModele("");
          }}
        />
        {salon.modeles.length > 0 && (
          <div className="mt-5">
            <p className="mb-2 flex items-baseline justify-between text-sm">
              <span className="font-medium">{type ? `Modèles ${nomType ?? ""}` : "Tous nos modèles"}</span>
              <span className="text-xs text-sourdine">
                {modelesVisibles.length} photo{modelesVisibles.length > 1 ? "s" : ""}
                {modelesVisibles.length > 2 ? ", faites glisser" : ""}
              </span>
            </p>
            {modelesVisibles.length === 0 ? (
              <p className="rounded-2xl bg-sable/70 px-4 py-3 text-sm text-sourdine">
                Pas encore de photo pour ce type. Vous pourrez envoyer la vôtre sur WhatsApp juste après.
              </p>
            ) : (
              <div ref={rangee} role="group" aria-label="Modèles" className="defile-x relative -mx-4 gap-3 px-4 pb-1">
                {modelesVisibles.map((m) => {
                  const on = m.id === modele;
                  return (
                    <button
                      key={m.id}
                      type="button"
                      aria-pressed={on}
                      data-modele={m.id}
                      onClick={() => setModele(on ? "" : m.id)}
                      className="group w-[42%] text-left sm:w-[28%] lg:w-[22%]"
                    >
                      <span
                        className={`relative block overflow-hidden rounded-[1.25rem] bg-sable transition-shadow ${on ? "ring-[3px] ring-action ring-offset-2 ring-offset-lin" : ""}`}
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element -- photo servie par l'application, déjà réduite */}
                        <img src={m.photoUrl} alt={m.nom} loading="lazy" draggable={false} className="aspect-[4/5] w-full object-cover" />
                        {on && (
                          <span className="absolute top-2 right-2 flex size-8 animate-apparition items-center justify-center rounded-full bg-action text-action-texte shadow-md" aria-hidden>
                            <IconCheck width={18} height={18} strokeWidth={2.4} />
                          </span>
                        )}
                      </span>
                      <span className={`mt-2 block text-sm leading-snug font-semibold ${on ? "text-accent-texte" : ""}`}>{m.nom}</span>
                      {fourchettePrix(m.prixMin, m.prixMax) && <span className="block text-xs text-sourdine">{fourchettePrix(m.prixMin, m.prixMax)}</span>}
                      {fourchetteDuree(m.dureeMin, m.dureeMax) && <span className="block text-xs text-sourdine">{fourchetteDuree(m.dureeMin, m.dureeMax)}</span>}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </Etape>

      <Etape n={++n} titre="Quel jour ?">
        <div role="group" aria-label="Jour" className="defile-x -mx-4 gap-2 px-4 pb-1">
          {jours.map((j) => {
            const on = j.valeur === jour;
            const nomJour = j.label ?? `${j.weekday} ${j.day}`;
            return (
              <button
                key={j.valeur}
                type="button"
                aria-pressed={on}
                aria-label={nomJour}
                onClick={() => setJour(j.valeur)}
                className={`flex w-[4.5rem] flex-col items-center rounded-2xl border py-2.5 transition-colors ${
                  on ? "border-marque bg-marque text-white" : "border-champ bg-white text-encre hover:border-marque"
                }`}
              >
                <span className={`text-xs capitalize ${on ? "text-detail" : "text-sourdine"}`}>{j.weekday}</span>
                <span className="font-display text-[1.7rem] leading-tight font-bold">{j.day}</span>
                <span className={`text-[11px] ${on ? "text-white/70" : "text-sourdine"}`}>{j.label ?? j.month}</span>
              </button>
            );
          })}
        </div>
        <label className="mt-3 flex flex-wrap items-center gap-2 text-sm text-sourdine">
          Plus tard ?
          <input
            type="date"
            min={aujourdhui}
            max={dateMax}
            value={jour}
            onChange={(e) => e.target.value && setJour(e.target.value)}
            className={`h-11 rounded-full border bg-white px-3 text-sm text-encre ${jourHorsListe ? "border-marque" : "border-champ"}`}
          />
        </label>
      </Etape>

      <Etape n={++n} titre="À quel moment ?" aide="L'heure exacte vous sera confirmée par le salon.">
        <div role="group" aria-label="Moment de la journée" className="grid grid-cols-2 gap-2">
          {[...MOMENTS.map((m) => ({ valeur: m.valeur as string, label: m.label, plage: m.plage })), { valeur: "", label: "Peu importe", plage: "le plus tôt possible" }].map((m) => {
            const on = m.valeur === moment;
            return (
              <button
                key={m.valeur}
                type="button"
                aria-pressed={on}
                onClick={() => setMoment(m.valeur)}
                className={`flex min-h-[4.75rem] flex-col items-start justify-center gap-0.5 rounded-2xl border px-4 py-3 text-left transition-colors ${
                  on ? "border-marque bg-marque text-white" : "border-champ bg-white hover:border-marque"
                }`}
              >
                <span className={on ? "text-detail" : "text-accent-texte"} aria-hidden>
                  {ICONES_MOMENT[m.valeur]}
                </span>
                <span className="text-sm font-semibold">{m.label}</span>
                <span className={`text-xs ${on ? "text-white/70" : "text-sourdine"}`}>{m.plage}</span>
              </button>
            );
          })}
        </div>
      </Etape>

      <Etape
        n={++n}
        titre={famille === "ongles" ? "Une personne en particulier ?" : "Une coiffeuse en particulier ?"}
        aide="Les mieux notées sont en premier. Seules celles qui font ce service et travaillent ce jour-là sont proposées."
      >
        {coiffeuseEcartee && (
          <div className="mb-3">
            <Alerte ton="indisponible">
              {coiffeuseEcartee} n&apos;est pas proposée pour ce service à cette date. Changez de jour pour la retrouver, ou laissez « Peu importe ».
            </Alerte>
          </div>
        )}
        {coiffeusesPossibles.length === 0 && !coiffeuseEcartee && (
          <div className="mb-3">
            <Alerte ton="indisponible">Aucune coiffeuse n&apos;est proposée pour ce service à cette date. Changez de jour, ou envoyez votre demande : le salon vous répond sur WhatsApp.</Alerte>
          </div>
        )}
        <div role="group" aria-label="Coiffeuse souhaitée" className="defile-x -mx-4 gap-3 px-4 pb-1">
          {[{ id: "", nom: "Peu importe", photoUrl: null, note: null, nbAvis: 0 }, ...coiffeusesPossibles].map((c) => {
            const on = c.id === coiffeuseValide;
            return (
              <button
                key={c.id || "peu-importe"}
                type="button"
                aria-pressed={on}
                data-nom={c.nom}
                onClick={() => setCoiffeuse(c.id)}
                className="group flex w-[5.25rem] flex-col items-center gap-1.5 text-center"
              >
                <span
                  className={`relative block size-[4.5rem] overflow-hidden rounded-full transition-shadow ${on ? "ring-[3px] ring-action ring-offset-2 ring-offset-lin" : "ring-1 ring-champ"}`}
                >
                  {c.id ? (
                    <PhotoCoiffeuse nom={c.nom} photoUrl={c.photoUrl} className="size-full text-[1.6rem]" />
                  ) : (
                    <span className={`flex size-full items-center justify-center ${on ? "bg-marque text-detail" : "bg-accent-pale text-accent-texte"}`} aria-hidden>
                      <IconInfini width={28} height={28} />
                    </span>
                  )}
                  {on && c.id && (
                    <span className="absolute inset-0 flex items-center justify-center bg-marque/55 text-detail" aria-hidden>
                      <IconCheck width={26} height={26} strokeWidth={2.4} />
                    </span>
                  )}
                </span>
                <span className={`text-xs leading-tight font-semibold ${on ? "text-accent-texte" : ""}`}>{c.nom}</span>
                {c.id && <NoteCoiffeuse note={c.note} nbAvis={c.nbAvis} />}
              </button>
            );
          })}
        </div>
      </Etape>

      <Etape n={++n} titre="Vos coordonnées">
        <ChampPublic label="Votre nom" erreur={erreurs.nom} id="champ-nom">
          {(champ) => (
            <input
              {...champ}
              className={classeChamp}
              value={nom}
              onChange={(e) => (setNom(e.target.value), setErreurs((x) => ({ ...x, nom: undefined })))}
              autoComplete="name"
              enterKeyHint="next"
              placeholder="Ex. : Aminata O."
            />
          )}
        </ChampPublic>
        <ChampPublic label="Votre numéro WhatsApp" erreur={erreurs.tel} aide="Le salon vous confirmera l'heure sur ce numéro." id="champ-tel">
          {(champ) => (
            <input
              {...champ}
              className={classeChamp}
              value={tel}
              onChange={(e) => (setTel(e.target.value), setErreurs((x) => ({ ...x, tel: undefined })))}
              type="tel"
              inputMode="tel"
              autoComplete="tel"
              enterKeyHint="next"
              placeholder="70 12 34 56"
            />
          )}
        </ChampPublic>
        <ChampPublic label="Précisions (facultatif)" aide="Longueur, couleur… Vous pourrez envoyer la photo du modèle sur WhatsApp juste après.">
          {(champ) => <input {...champ} className={classeChamp} value={remarque} onChange={(e) => setRemarque(e.target.value)} maxLength={200} enterKeyHint="send" />}
        </ChampPublic>
      </Etape>

      {/* Piège à robots : invisible pour les personnes, ignoré par les lecteurs d'écran. */}
      <div aria-hidden="true" className="absolute -left-[9999px] h-0 overflow-hidden">
        <label>
          Ne pas remplir
          <input tabIndex={-1} autoComplete="off" value={piege} onChange={(e) => setPiege(e.target.value)} />
        </label>
      </div>

      {/* Barre d'envoi toujours visible : la cliente voit ce qu'elle demande et peut envoyer à tout moment. */}
      <div className="sticky bottom-0 z-20 -mx-4 border-t border-trait bg-lin/95 px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] shadow-barre backdrop-blur">
        {erreurs.global && (
          <div className="mb-3">
            <Alerte ton="erreur">{erreurs.global}</Alerte>
          </div>
        )}
        <p className="mb-2 truncate text-center text-xs text-sourdine">{resume}</p>
        <Button variant="action" size="lg" className="w-full" loading={enCours} onClick={envoyer}>
          {enCours ? "Envoi en cours…" : "Envoyer ma demande"}
        </Button>
      </div>
      <p className="mt-4 text-center text-xs text-sourdine">
        Ce n&apos;est pas encore une confirmation : le salon vous répond sur WhatsApp avec l&apos;heure exacte.
      </p>
    </div>
  );
}
