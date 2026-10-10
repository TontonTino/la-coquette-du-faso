"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { Button } from "@/components/ui/Button";
import { IconWhatsApp } from "@/components/ui/icons";
import { useToast } from "@/components/ui/Toast";
import { DUREES_RAPIDES } from "@/lib/salon/regles";
import type { Categorie, Paiement, Resultat } from "@/lib/salon/types";
import type { CartePrestation, Journee } from "@/lib/salon/vue";
import { libelleMoment } from "@/lib/salon/regles";
import { lienWhatsApp, messageConfirmation, messageRefus } from "@/lib/salon/whatsapp";
import type { Demande } from "@/server/salon/service";
import { addDays, capitalize, formatDateMedium, formatDuration, formatFcfa } from "@/lib/time";
import {
  absenteAction,
  ajouterSansRendezVousAction,
  annulerAction,
  arriveeAction,
  coiffeusesLibresAction,
  confirmerDemandeAction,
  creerRendezVousAction,
  refuserDemandeAction,
  demarrerAction,
  modifierRendezVousAction,
  terminerAction,
} from "./actions";
import { Carte, Champ, Choix, classeInput, Pastille, Section, Vide } from "./ui";

type Ecran =
  | { type: "liste" }
  | { type: "rdv"; carte?: CartePrestation }
  | { type: "sans" }
  | { type: "demarrer"; carte: CartePrestation }
  | { type: "terminer"; carte: CartePrestation }
  | { type: "confirmer"; demande: Demande }
  | { type: "refuser"; demande: Demande }
  | { type: "prevenir"; titre: string; texte: string; lien: string | null };

const DUREES = DUREES_RAPIDES.map((d) => ({ valeur: d, label: formatDuration(d) }));
const qui = (c: CartePrestation) => (c.coiffeuses.length ? c.coiffeuses.join(" + ") : "Coiffeuse à attribuer");
const decrire = (c: CartePrestation) => [c.categorie, c.modele].filter(Boolean).join(" · ") || "Modèle à préciser";
/** "" = type de coiffure pas encore précisé (toutes les coiffeuses conviennent). */
const optionsCategories = (categories: Categorie[]) => [
  ...categories.map((c) => ({ valeur: c.id, label: c.nom })),
  { valeur: "", label: "Pas encore précisé" },
];

/** Écran principal de la secrétaire : file d'attente, prestations en cours, rendez-vous à venir. */
export function EcranSalon({
  journee,
  aujourdhui,
  demandes,
  salonNom,
}: {
  journee: Journee;
  aujourdhui: string;
  demandes: Demande[];
  salonNom: string;
}) {
  const [ecran, setEcran] = useState<Ecran>({ type: "liste" });
  const router = useRouter();
  const retour = () => setEcran({ type: "liste" });

  // Mise à jour automatique (temps d'attente, saisies faites sur un autre téléphone).
  useEffect(() => {
    if (ecran.type !== "liste") return;
    const t = window.setInterval(() => router.refresh(), 60_000);
    return () => window.clearInterval(t);
  }, [ecran.type, router]);

  const cats = journee.categories;
  if (ecran.type === "rdv") return <FormRendezVous aujourdhui={aujourdhui} carte={ecran.carte} categories={cats} onFini={retour} />;
  if (ecran.type === "sans") return <FormSansRendezVous categories={cats} onFini={retour} />;
  if (ecran.type === "demarrer") return <FormDemarrer carte={ecran.carte} aujourdhui={aujourdhui} onFini={retour} />;
  if (ecran.type === "terminer") return <FormTerminer carte={ecran.carte} onFini={retour} />;
  if (ecran.type === "confirmer")
    return <FormConfirmerDemande demande={ecran.demande} aujourdhui={aujourdhui} salonNom={salonNom} onFini={retour} ouvrir={setEcran} />;
  if (ecran.type === "refuser") return <FormRefuserDemande demande={ecran.demande} salonNom={salonNom} onFini={retour} ouvrir={setEcran} />;
  if (ecran.type === "prevenir") return <Prevenir titre={ecran.titre} texte={ecran.texte} lien={ecran.lien} onFini={retour} />;
  return <Liste journee={journee} demandes={demandes} ouvrir={setEcran} />;
}

/* ------------------------------------------------------------------ */

function useAction() {
  const toast = useToast();
  const [enCours, start] = useTransition();
  const lancer = (fn: () => Promise<Resultat<unknown>>, succes: string, apres?: () => void) =>
    start(async () => {
      const r = await fn();
      if (r.ok) {
        toast("succes", succes);
        apres?.();
      } else toast("erreur", r.erreur);
    });
  return { enCours, lancer };
}

function Compteur({ n, label, couleur }: { n: number; label: string; couleur: string }) {
  return (
    <div className="flex-1 px-3 py-2.5 text-center">
      <p className={`font-display text-[2rem] leading-none font-bold ${couleur}`}>{n}</p>
      <p className="mt-1 text-[11px] text-white/60">{label}</p>
    </div>
  );
}

/** Avancement d'une prestation en cours (0 à 1), d'après l'heure de début et la durée prévue. */
function avancement(heureDebut: string | null, dureeMin: number): number {
  if (!heureDebut) return 0;
  const [h, m] = heureDebut.split(":").map(Number);
  const d = new Date();
  const ecoule = d.getUTCHours() * 60 + d.getUTCMinutes() - (h * 60 + m); // Ouagadougou = UTC
  return Math.min(1, Math.max(0, ecoule / Math.max(dureeMin, 1)));
}

const lienTel = (tel: string) => lienWhatsApp(tel);

function Liste({ journee, demandes, ouvrir }: { journee: Journee; demandes: Demande[]; ouvrir: (e: Ecran) => void }) {
  const { enCours, lancer } = useAction();
  const { attente, enCours: cours, aVenir, compteurs } = journee;
  const lienAction = "min-h-11 rounded-full px-3 text-sm text-sourdine hover:bg-noir/5 hover:text-encre";
  return (
    <div>
      <div role="group" className="texture-noire flex divide-x divide-white/10 overflow-hidden rounded-2xl text-white" aria-label="Coiffeuses aujourd'hui">
        <Compteur n={compteurs.libres} label={`libre${compteurs.libres > 1 ? "s" : ""}`} couleur="text-or" />
        <Compteur n={compteurs.occupees} label={`occupée${compteurs.occupees > 1 ? "s" : ""}`} couleur="text-white" />
        <Compteur n={compteurs.absentes} label={`absente${compteurs.absentes > 1 ? "s" : ""}`} couleur="text-white/50" />
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2">
        <Button variant="noir" size="lg" className="px-2 text-[15px]" onClick={() => ouvrir({ type: "rdv" })}>
          + Rendez-vous
        </Button>
        <Button variant="or" size="lg" className="px-2 text-[15px]" onClick={() => ouvrir({ type: "sans" })}>
          + Sans rendez-vous
        </Button>
      </div>

      {demandes.length > 0 && (
        <Section titre="Demandes en ligne à traiter" nombre={demandes.length} ton="or">
          {demandes.map((d) => (
            <Carte key={d.id} ton="or" className="bg-gradient-to-br from-or-pale/60 to-white">
              <div className="flex items-start gap-3">
                {d.modele && (
                  // eslint-disable-next-line @next/next/no-img-element -- photo servie par l'application
                  <img src={d.modele.photoUrl} alt={d.modele.nom} className="h-24 w-[4.5rem] shrink-0 rounded-lg object-cover shadow-sm" />
                )}
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-2">
                    <p className="font-semibold">{d.clientNom}</p>
                    <Pastille ton="or">En ligne</Pastille>
                  </div>
                  <p className="text-sm font-medium">
                    {capitalize(formatDateMedium(d.jour))}, {libelleMoment(d.moment).toLowerCase()}
                  </p>
                  <p className="text-sm text-sourdine">
                    {d.modele ? `${d.modele.nom}, ` : ""}
                    {d.categorie ?? "type à préciser"}
                    {d.coiffeuseSouhaitee ? `. Souhaite ${d.coiffeuseSouhaitee.nom}` : ""}
                  </p>
                  {d.remarque && <p className="mt-1 text-sm text-sourdine italic">« {d.remarque} »</p>}
                  {lienTel(d.clientTel) && (
                    <a className="mt-1 inline-flex min-h-9 items-center gap-1.5 text-sm font-medium text-vert" href={lienTel(d.clientTel)!}>
                      <IconWhatsApp width={16} height={16} />
                      {d.clientTel}
                    </a>
                  )}
                </div>
              </div>
              <div className="mt-2 flex items-center justify-end gap-2">
                <button type="button" className={lienAction} onClick={() => ouvrir({ type: "refuser", demande: d })}>
                  Refuser
                </button>
                <Button variant="noir" onClick={() => ouvrir({ type: "confirmer", demande: d })}>
                  Confirmer
                </Button>
              </div>
            </Carte>
          ))}
        </Section>
      )}

      <Section titre="En attente au salon" nombre={attente.length} ton="noir">
        {attente.length === 0 && <Vide>Personne n&apos;attend.</Vide>}
        {attente.map((c) => {
          const longue = (c.attenteMin ?? 0) >= 30;
          return (
            <Carte key={c.id} ton={longue ? "rouge" : "noir"}>
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-semibold">{c.clientNom}</p>
                  <p className="text-sm text-sourdine">{decrire(c)}</p>
                </div>
                {c.origine === "rendez_vous" ? <Pastille ton="or">RDV {c.heureDebut}</Pastille> : <Pastille ton="gris">Sans RDV</Pastille>}
              </div>
              <div className="mt-3 flex items-center justify-between gap-2">
                <p className={`text-sm ${longue ? "font-medium text-rouge" : "text-sourdine"}`}>
                  Arrivée {c.heureArrivee}, attend depuis {c.attenteMin} min
                </p>
                <Button variant="noir" onClick={() => ouvrir({ type: "demarrer", carte: c })}>
                  Démarrer
                </Button>
              </div>
              <div className="flex justify-end">
                <button
                  type="button"
                  className={lienAction}
                  disabled={enCours}
                  onClick={() => {
                    if (window.confirm(`${c.clientNom} est partie sans être coiffée ?`)) lancer(() => annulerAction(c.id), `${c.clientNom} retirée de la file`);
                  }}
                >
                  Elle est partie
                </button>
              </div>
            </Carte>
          );
        })}
      </Section>

      <Section titre="En cours" nombre={cours.length} ton="indigo">
        {cours.length === 0 && <Vide>Aucune prestation en cours.</Vide>}
        {cours.map((c) => (
          <Carte key={c.id} ton="indigo">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="font-semibold">{c.clientNom}</p>
                <p className="text-sm text-sourdine">{qui(c)}</p>
              </div>
              <Button variant="contour" onClick={() => ouvrir({ type: "terminer", carte: c })}>
                Terminer
              </Button>
            </div>
            <div className="mt-3 flex items-center gap-3 text-xs text-sourdine">
              <span>{c.heureDebut}</span>
              <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-indigo-pale">
                <div className="h-full rounded-full bg-indigo" style={{ width: `${Math.round(avancement(c.heureDebut, c.dureeMin) * 100)}%` }} suppressHydrationWarning />
              </div>
              <span>fin {c.heureFin}</span>
            </div>
          </Carte>
        ))}
      </Section>

      <Section titre="Rendez-vous à venir" nombre={aVenir.length}>
        {aVenir.length === 0 && <Vide>Plus de rendez-vous aujourd&apos;hui.</Vide>}
        {aVenir.map((c) => (
          <Carte key={c.id} ton={c.aReattribuer.length > 0 || c.enRetard ? "rouge" : "neutre"}>
            <div className="flex items-start gap-3">
              <p className="w-16 shrink-0 font-display text-[1.6rem] leading-none font-bold">{c.heureDebut}</p>
              <div className="min-w-0 flex-1">
                <p className="flex flex-wrap items-center gap-x-2 font-semibold">
                  <span>{c.clientNom}</span>
                  {c.enRetard && <Pastille ton="rouge">En retard</Pastille>}
                </p>
                <p className="text-sm text-sourdine">
                  {formatDuration(c.dureeMin)}, {qui(c)}
                </p>
                {(c.categorie || c.modele) && <p className="text-sm text-sourdine">{decrire(c)}</p>}
                {c.aReattribuer.length > 0 && (
                  <p className="mt-1 text-sm font-medium text-rouge">{c.aReattribuer.join(" + ")} absente : à réattribuer</p>
                )}
                {c.clientTel && lienTel(c.clientTel) && (
                  <a className="mt-1 inline-flex min-h-9 items-center gap-1.5 text-sm font-medium text-vert" href={lienTel(c.clientTel)!}>
                    <IconWhatsApp width={16} height={16} />
                    {c.clientTel}
                  </a>
                )}
              </div>
            </div>
            <div className="mt-2 flex flex-wrap items-center justify-between gap-1 border-t border-trait/70 pt-2">
              <div className="-ml-3 flex">
                <button type="button" className={lienAction} onClick={() => ouvrir({ type: "rdv", carte: c })}>
                  Modifier
                </button>
                <button
                  type="button"
                  className={lienAction}
                  disabled={enCours}
                  onClick={() => {
                    if (window.confirm(`Marquer ${c.clientNom} absente (elle n'est pas venue) ?`))
                      lancer(() => absenteAction(c.id), `${c.clientNom} marquée absente`);
                  }}
                >
                  Absente
                </button>
                <button
                  type="button"
                  className={lienAction}
                  disabled={enCours}
                  onClick={() => {
                    if (window.confirm(`Annuler le rendez-vous de ${c.clientNom} ?`)) lancer(() => annulerAction(c.id), "Rendez-vous annulé : créneau libéré");
                  }}
                >
                  Annuler
                </button>
              </div>
              <Button variant="contour" className="ml-auto" disabled={enCours} onClick={() => lancer(() => arriveeAction(c.id), `${c.clientNom} ajoutée à la file d'attente`)}>
                Elle est arrivée
              </Button>
            </div>
          </Carte>
        ))}
      </Section>
    </div>
  );
}

/* ------------------------------------------------------------------ */

function EnTete({ titre, sousTitre, onRetour }: { titre: string; sousTitre?: string; onRetour: () => void }) {
  return (
    <div className="mb-5">
      <button type="button" onClick={onRetour} className="-ml-2 min-h-11 rounded-full px-3 text-sm font-medium text-sourdine hover:bg-noir/5 hover:text-encre">
        ‹ Retour
      </button>
      <h1 className="mt-1 font-display text-[2.2rem] leading-none font-bold">{titre}</h1>
      {sousTitre && <p className="mt-2 text-sm text-sourdine">{sousTitre}</p>}
    </div>
  );
}

/** Coiffeuses libres sur toute la plage : demandées au serveur à chaque changement. */
function useCoiffeusesLibres(q: { jour: string; heure: string | null; dureeMin: number; ignorer: string | null; categorieId: string | null }) {
  const [libres, setLibres] = useState<{ id: string; nom: string }[] | null>(null);
  const { jour, heure, dureeMin, ignorer, categorieId } = q;
  useEffect(() => {
    let actif = true;
    const t = window.setTimeout(async () => {
      const r = await coiffeusesLibresAction({ jour, heure, dureeMin, ignorer, categorieId });
      if (actif) setLibres(r.ok ? r.valeur : []);
    }, 150);
    return () => {
      actif = false;
      window.clearTimeout(t);
    };
  }, [jour, heure, dureeMin, ignorer, categorieId]);
  return libres;
}

function garderLibres(choisies: string[], libres: { id: string }[] | null): string[] {
  return libres ? choisies.filter((id) => libres.some((l) => l.id === id)) : choisies;
}

function basculer(liste: string[], id: string, toast: ReturnType<typeof useToast>): string[] {
  if (liste.includes(id)) return liste.filter((x) => x !== id);
  if (liste.length >= 2) {
    toast("info", "Deux coiffeuses au maximum par cliente.");
    return liste;
  }
  return [...liste, id];
}

function ChoixCoiffeuses({
  libres,
  choisies,
  setChoisies,
  premiereDispo,
}: {
  libres: { id: string; nom: string }[] | null;
  choisies: string[];
  setChoisies: (v: string[]) => void;
  premiereDispo: boolean;
}) {
  const toast = useToast();
  if (libres === null) return <p className="text-sm text-sourdine">Recherche des coiffeuses libres…</p>;
  const options = libres;
  return (
    <div className="flex flex-wrap gap-2">
      {premiereDispo && (
        <button
          type="button"
          aria-pressed={choisies.length === 0}
          onClick={() => setChoisies([])}
          className={`min-h-11 rounded-full border px-4 text-sm transition-colors ${choisies.length === 0 ? "border-noir bg-noir font-medium text-white" : "border-trait bg-white hover:border-or"}`}
        >
          Première disponible
        </button>
      )}
      {options.map((c) => {
        const on = choisies.includes(c.id);
        return (
          <button
            key={c.id}
            type="button"
            aria-pressed={on}
            onClick={() => setChoisies(basculer(choisies, c.id, toast))}
            className={`min-h-11 rounded-full border px-4 text-sm transition-colors ${on ? "border-noir bg-noir font-medium text-white" : "border-trait bg-white hover:border-or"}`}
          >
            {c.nom}
          </button>
        );
      })}
      {options.length === 0 && (
        <p className="text-sm font-medium text-rouge">Aucune coiffeuse compétente et libre sur toute cette durée.</p>
      )}
    </div>
  );
}

const HEURES = Array.from({ length: (21 - 7) * 4 }, (_, i) => {
  const m = 7 * 60 + i * 15;
  return `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
});

function prochaineHeure(): string {
  const d = new Date();
  const m = Math.ceil((d.getUTCHours() * 60 + d.getUTCMinutes() + 15) / 15) * 15;
  const h = Math.min(Math.max(m, 7 * 60), 20 * 60 + 45);
  return `${String(Math.floor(h / 60)).padStart(2, "0")}:${String(h % 60).padStart(2, "0")}`;
}

function FormRendezVous({
  aujourdhui,
  carte,
  categories,
  onFini,
}: {
  aujourdhui: string;
  carte?: CartePrestation;
  categories: Categorie[];
  onFini: () => void;
}) {
  const { enCours, lancer } = useAction();
  const [nom, setNom] = useState(carte?.clientNom ?? "");
  const [tel, setTel] = useState(carte?.clientTel ?? "");
  const [jour, setJour] = useState(carte?.jour ?? aujourdhui);
  const [heure, setHeure] = useState(carte?.heureDebut ?? prochaineHeure());
  const [duree, setDuree] = useState(carte?.dureeMin ?? 180);
  const [choisies, setChoisies] = useState<string[]>(carte?.coiffeuseIds ?? []);
  const [modele, setModele] = useState(carte?.modele ?? "");
  const [categorie, setCategorie] = useState(carte?.categorieId ?? "");
  const [erreurs, setErreurs] = useState<{ nom?: string; tel?: string }>({});
  const libres = useCoiffeusesLibres({ jour, heure, dureeMin: duree, ignorer: carte?.id ?? null, categorieId: categorie || null });

  // Une coiffeuse choisie qui n'est plus libre (heure ou durée changée) est ignorée.
  const valides = garderLibres(choisies, libres);

  const envoyer = () => {
    const e: typeof erreurs = {};
    if (nom.trim().length < 2) e.nom = "Indiquez le nom (2 lettres minimum).";
    if (tel.replace(/\D/g, "").length < 8) e.tel = "8 chiffres attendus, par exemple 70 12 34 56.";
    setErreurs(e);
    if (e.nom || e.tel) return;
    const saisie = { clientNom: nom, clientTel: tel, jour, heure, dureeMin: duree, coiffeuseIds: valides, modele, categorieId: categorie || null };
    lancer(
      () => (carte ? modifierRendezVousAction(carte.id, saisie) : creerRendezVousAction(saisie)),
      carte ? "Rendez-vous modifié" : `Rendez-vous enregistré : ${nom.trim()}, ${jour === aujourdhui ? "" : "le " + jour.split("-").reverse().join("/") + " "}à ${heure}`,
      onFini,
    );
  };

  return (
    <div>
      <EnTete titre={carte ? "Modifier le rendez-vous" : "Nouveau rendez-vous"} onRetour={onFini} />
      <Champ label="Nom de la cliente" erreur={erreurs.nom}>
        <input className={classeInput} value={nom} onChange={(e) => setNom(e.target.value)} autoComplete="off" placeholder="Ex. : Awa T." />
      </Champ>
      <Champ label="Téléphone (WhatsApp)" erreur={erreurs.tel}>
        <input className={classeInput} value={tel} onChange={(e) => setTel(e.target.value)} type="tel" inputMode="tel" placeholder="70 12 34 56" />
      </Champ>
      <Champ groupe label="Jour">
        <div className="flex flex-wrap items-center gap-2">
          <Choix
            libelle="Jour"
            options={[
              { valeur: aujourdhui, label: "Aujourd'hui" },
              { valeur: addDays(aujourdhui, 1), label: "Demain" },
            ]}
            valeur={jour}
            onChange={setJour}
          />
          <input
            aria-label="Autre date"
            type="date"
            min={aujourdhui}
            value={jour}
            onChange={(e) => e.target.value && setJour(e.target.value)}
            className="h-11 rounded-full border border-trait bg-white px-3 text-sm"
          />
        </div>
      </Champ>
      <Champ label="Heure">
        <select className={classeInput} value={heure} onChange={(e) => setHeure(e.target.value)}>
          {HEURES.map((h) => (
            <option key={h} value={h}>
              {h}
            </option>
          ))}
        </select>
      </Champ>
      <Champ groupe label="Durée estimée">
        <Choix libelle="Durée estimée" options={DUREES} valeur={duree} onChange={setDuree} />
      </Champ>
      <Champ groupe label="Type de coiffure">
        <Choix libelle="Type de coiffure" options={optionsCategories(categories)} valeur={categorie} onChange={setCategorie} />
      </Champ>
      <Champ groupe label="Coiffeuse(s)" aide="Seules les coiffeuses qui savent faire ce type de coiffure et qui sont libres sur tout le créneau sont proposées. 2 au maximum.">
        <ChoixCoiffeuses libres={libres} choisies={valides} setChoisies={setChoisies} premiereDispo />
      </Champ>
      <Champ label="Modèle ou remarque (facultatif)">
        <input className={classeInput} value={modele} onChange={(e) => setModele(e.target.value)} placeholder="Ex. : photo envoyée sur WhatsApp" />
      </Champ>
      <Button variant="noir" size="lg" className="w-full" loading={enCours} onClick={envoyer}>
        {carte ? "Enregistrer les changements" : "Enregistrer le rendez-vous"}
      </Button>
    </div>
  );
}

function FormSansRendezVous({ categories, onFini }: { categories: Categorie[]; onFini: () => void }) {
  const { enCours, lancer } = useAction();
  const [categorie, setCategorie] = useState("");
  const [nom, setNom] = useState("");
  const [tel, setTel] = useState("");
  const [modele, setModele] = useState("");
  const [erreur, setErreur] = useState<string | null>(null);
  return (
    <div>
      <EnTete titre="Cliente sans rendez-vous" sousTitre="Elle passe en bas de la file d'attente." onRetour={onFini} />
      <Champ label="Nom de la cliente" erreur={erreur}>
        <input className={classeInput} value={nom} onChange={(e) => setNom(e.target.value)} autoComplete="off" placeholder="Ex. : Mariam S." />
      </Champ>
      <Champ label="Téléphone (facultatif)">
        <input className={classeInput} value={tel} onChange={(e) => setTel(e.target.value)} type="tel" inputMode="tel" placeholder="70 12 34 56" />
      </Champ>
      <Champ groupe label="Type de coiffure">
        <Choix libelle="Type de coiffure" options={optionsCategories(categories)} valeur={categorie} onChange={setCategorie} />
      </Champ>
      <Champ label="Modèle ou remarque">
        <input className={classeInput} value={modele} onChange={(e) => setModele(e.target.value)} placeholder="Ex. : comme sur la photo, longueur épaules" />
      </Champ>
      <Button
        variant="or"
        size="lg"
        className="w-full"
        loading={enCours}
        onClick={() => {
          if (nom.trim().length < 2) return setErreur("Indiquez le nom (2 lettres minimum).");
          setErreur(null);
          lancer(() => ajouterSansRendezVousAction({ clientNom: nom, clientTel: tel, modele, categorieId: categorie || null }), `${nom.trim()} ajoutée à la file d'attente`, onFini);
        }}
      >
        Ajouter à la file d&apos;attente
      </Button>
    </div>
  );
}

function FormDemarrer({ carte, aujourdhui, onFini }: { carte: CartePrestation; aujourdhui: string; onFini: () => void }) {
  const { enCours, lancer } = useAction();
  const toast = useToast();
  const [duree, setDuree] = useState(carte.dureeMin);
  const [choisies, setChoisies] = useState<string[]>(carte.coiffeuseIds);
  const libres = useCoiffeusesLibres({ jour: aujourdhui, heure: null, dureeMin: duree, ignorer: carte.id, categorieId: carte.categorieId });
  const perdues = libres ? carte.coiffeuses.filter((_, i) => !libres.some((l) => l.id === carte.coiffeuseIds[i])) : [];

  const valides = garderLibres(choisies, libres);

  return (
    <div>
      <EnTete
        titre="Démarrer"
        sousTitre={`${carte.clientNom} · ${carte.origine === "rendez_vous" ? "rendez-vous" : "sans rendez-vous"} · ${decrire(carte)}`}
        onRetour={onFini}
      />
      {perdues.length > 0 && (
        <p className="mb-4 rounded-xl bg-rouge-pale px-3 py-2 text-sm text-rouge">
          {perdues.join(" + ")} n&apos;est pas libre sur toute cette durée : choisissez une autre coiffeuse ou réduisez la durée.
        </p>
      )}
      <Champ groupe label="Durée estimée">
        <Choix libelle="Durée estimée" options={DUREES} valeur={duree} onChange={setDuree} />
      </Champ>
      <Champ
        groupe
        label="Coiffeuse(s) libres maintenant"
        aide={carte.categorie ? `Compétentes en ${carte.categorie}. 1 ou 2 coiffeuses.` : "1 ou 2 coiffeuses."}
      >
        <ChoixCoiffeuses libres={libres} choisies={valides} setChoisies={setChoisies} premiereDispo={false} />
      </Champ>
      <Button
        variant="noir"
        size="lg"
        className="w-full"
        loading={enCours}
        onClick={() => {
          if (valides.length === 0) return toast("erreur", "Choisissez au moins une coiffeuse.");
          lancer(() => demarrerAction(carte.id, { dureeMin: duree, coiffeuseIds: valides }), `Prestation de ${carte.clientNom} démarrée`, onFini);
        }}
      >
        Démarrer la prestation
      </Button>
    </div>
  );
}

function FormTerminer({ carte, onFini }: { carte: CartePrestation; onFini: () => void }) {
  const { enCours, lancer } = useAction();
  const [prix, setPrix] = useState("");
  const [paiement, setPaiement] = useState<Paiement>("mobile_money");
  const [erreur, setErreur] = useState<string | null>(null);
  const montant = Number.parseInt(prix.replace(/\D/g, ""), 10);
  return (
    <div>
      <EnTete titre="Terminer" sousTitre={`${carte.clientNom} · ${qui(carte)} · depuis ${carte.heureDebut}`} onRetour={onFini} />
      <Champ label="Prix payé (FCFA)" erreur={erreur}>
        <input className={classeInput} value={prix} onChange={(e) => setPrix(e.target.value)} inputMode="numeric" placeholder="Ex. : 15000" />
      </Champ>
      <Champ groupe label="Moyen de paiement">
        <Choix
          libelle="Moyen de paiement"
          options={[
            { valeur: "mobile_money" as Paiement, label: "Mobile money" },
            { valeur: "especes" as Paiement, label: "Espèces" },
          ]}
          valeur={paiement}
          onChange={setPaiement}
        />
      </Champ>
      <Button
        variant="noir"
        size="lg"
        className="w-full"
        loading={enCours}
        onClick={() => {
          if (!Number.isFinite(montant) || montant <= 0) return setErreur("Indiquez le prix payé, en FCFA.");
          setErreur(null);
          lancer(() => terminerAction(carte.id, { prix: montant, paiement }), `${carte.clientNom} : ${formatFcfa(montant)} encaissés`, onFini);
        }}
      >
        Valider et libérer les coiffeuses
      </Button>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Demandes en ligne                                                   */
/* ------------------------------------------------------------------ */

const HEURE_PAR_MOMENT: Record<string, string> = { matin: "09:00", apres_midi: "13:00", fin_journee: "16:00" };
const lienSuivi = (reference: string) => `${window.location.origin}/demande/${reference}`;

function FormConfirmerDemande({
  demande,
  aujourdhui,
  salonNom,
  onFini,
  ouvrir,
}: {
  demande: Demande;
  aujourdhui: string;
  salonNom: string;
  onFini: () => void;
  ouvrir: (e: Ecran) => void;
}) {
  const toast = useToast();
  const [enCours, start] = useTransition();
  const [jour, setJour] = useState(demande.jour < aujourdhui ? aujourdhui : demande.jour);
  const [heure, setHeure] = useState((demande.moment && HEURE_PAR_MOMENT[demande.moment]) || "09:00");
  const [duree, setDuree] = useState(demande.dureeMin);
  const [choisies, setChoisies] = useState<string[]>(demande.coiffeuseSouhaitee ? [demande.coiffeuseSouhaitee.id] : []);
  const libres = useCoiffeusesLibres({ jour, heure, dureeMin: duree, ignorer: demande.id, categorieId: demande.categorieId });
  const valides = garderLibres(choisies, libres);
  const souhaiteePrise = demande.coiffeuseSouhaitee && libres && !libres.some((l) => l.id === demande.coiffeuseSouhaitee!.id);

  const confirmer = () => {
    if (valides.length === 0) return toast("erreur", "Choisissez au moins une coiffeuse.");
    start(async () => {
      const r = await confirmerDemandeAction(demande.id, { jour, heure, dureeMin: duree, coiffeuseIds: valides });
      if (!r.ok) return toast("erreur", r.erreur);
      toast("succes", `Rendez-vous de ${demande.clientNom} confirmé`);
      const texte = messageConfirmation({ clientNom: r.valeur.clientNom, salonNom, jour, heure, coiffeuses: r.valeur.coiffeuses, lienSuivi: lienSuivi(r.valeur.reference) });
      ouvrir({ type: "prevenir", titre: "Prévenir la cliente", texte, lien: lienWhatsApp(r.valeur.clientTel, texte) });
    });
  };

  return (
    <div>
      <EnTete
        titre="Confirmer la demande"
        sousTitre={`${demande.clientNom} · ${demande.categorie ?? "type à préciser"} · ${libelleMoment(demande.moment)}`}
        onRetour={onFini}
      />
      {demande.modele && (
        <div className="mb-4 flex items-center gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element -- photo servie par l'application */}
          <img src={demande.modele.photoUrl} alt="" className="h-24 w-[4.5rem] rounded-lg object-cover shadow-sm" />
          <p className="text-sm">
            Modèle choisi : <span className="font-semibold">{demande.modele.nom}</span>
          </p>
        </div>
      )}
      {demande.remarque && <p className="mb-4 rounded-xl bg-gris px-3 py-2 text-sm">« {demande.remarque} »</p>}
      {souhaiteePrise && (
        <p className="mb-4 rounded-xl bg-rouge-pale px-3 py-2 text-sm text-rouge">
          {demande.coiffeuseSouhaitee!.nom} (souhaitée par la cliente) n&apos;est pas libre sur ce créneau : changez l&apos;heure ou choisissez une autre coiffeuse.
        </p>
      )}
      <Champ label="Jour">
        <input type="date" min={aujourdhui} value={jour} onChange={(e) => e.target.value && setJour(e.target.value)} className={classeInput} />
      </Champ>
      <Champ label="Heure exacte">
        <select className={classeInput} value={heure} onChange={(e) => setHeure(e.target.value)}>
          {HEURES.map((h) => (
            <option key={h} value={h}>
              {h}
            </option>
          ))}
        </select>
      </Champ>
      <Champ groupe label="Durée estimée">
        <Choix libelle="Durée estimée" options={DUREES} valeur={duree} onChange={setDuree} />
      </Champ>
      <Champ groupe label="Coiffeuse(s)" aide="Compétentes pour ce type de coiffure et libres sur tout le créneau.">
        <ChoixCoiffeuses libres={libres} choisies={valides} setChoisies={setChoisies} premiereDispo={false} />
      </Champ>
      <Button variant="noir" size="lg" className="w-full" loading={enCours} onClick={confirmer}>
        Confirmer le rendez-vous
      </Button>
    </div>
  );
}

const MOTIFS = ["Complet ce jour-là", "Aucune coiffeuse disponible pour ce modèle", "Modèle non réalisé au salon"];

function FormRefuserDemande({
  demande,
  salonNom,
  onFini,
  ouvrir,
}: {
  demande: Demande;
  salonNom: string;
  onFini: () => void;
  ouvrir: (e: Ecran) => void;
}) {
  const toast = useToast();
  const [enCours, start] = useTransition();
  const [motif, setMotif] = useState(MOTIFS[0]);
  return (
    <div>
      <EnTete titre="Refuser la demande" sousTitre={`${demande.clientNom} · ${capitalize(formatDateMedium(demande.jour))}`} onRetour={onFini} />
      <Champ groupe label="Motif (visible par la cliente)">
        <Choix libelle="Motif" options={MOTIFS.map((m) => ({ valeur: m, label: m }))} valeur={motif} onChange={setMotif} />
      </Champ>
      <Champ label="Ou écrivez le motif">
        <input className={classeInput} value={motif} onChange={(e) => setMotif(e.target.value)} maxLength={200} />
      </Champ>
      <Button
        variant="danger"
        size="lg"
        className="w-full"
        loading={enCours}
        onClick={() =>
          start(async () => {
            const r = await refuserDemandeAction(demande.id, motif);
            if (!r.ok) return toast("erreur", r.erreur);
            toast("succes", "Demande refusée");
            const texte = messageRefus({ clientNom: r.valeur.clientNom, salonNom, motif: motif.trim(), lienReserver: `${window.location.origin}/reserver` });
            ouvrir({ type: "prevenir", titre: "Prévenir la cliente", texte, lien: lienWhatsApp(r.valeur.clientTel, texte) });
          })
        }
      >
        Refuser la demande
      </Button>
    </div>
  );
}

/** Après une confirmation ou un refus : un geste pour envoyer le message WhatsApp pré-rempli. */
function Prevenir({ titre, texte, lien, onFini }: { titre: string; texte: string; lien: string | null; onFini: () => void }) {
  return (
    <div>
      <EnTete titre={titre} sousTitre="Le message est prêt : il part de votre WhatsApp quand vous appuyez sur Envoyer." onRetour={onFini} />
      {/* Aperçu en bulle, comme la cliente le verra dans WhatsApp. */}
      <div className="mb-5 rounded-2xl bg-[#efe7dc] p-3">
        <pre className="ml-auto max-w-[92%] rounded-2xl rounded-tr-sm bg-[#d9fdd3] px-3.5 py-2.5 font-sans text-sm leading-relaxed whitespace-pre-wrap text-encre shadow-sm [overflow-wrap:anywhere]">
          {texte}
        </pre>
      </div>
      {lien && (
        <a
          href={lien}
          target="_blank"
          rel="noopener noreferrer"
          className="mb-3 flex min-h-13 items-center justify-center gap-2 rounded-full bg-[#1f7a4d] px-6 font-medium text-white shadow-[0_10px_30px_-12px_rgb(31_122_77/0.6)] hover:bg-[#196842]"
        >
          <IconWhatsApp width={20} height={20} />
          Envoyer sur WhatsApp
        </a>
      )}
      <Button variant="contour" size="lg" className="w-full" onClick={onFini}>
        Retour au salon
      </Button>
    </div>
  );
}
