"use client";

import { useState, useTransition } from "react";
import { classeInput } from "@/app/salon/ui";
import { PhotoCoiffeuse } from "@/components/public/Equipe";
import { Button } from "@/components/ui/Button";
import { IconCheck, IconStar } from "@/components/ui/icons";
import { noterAction } from "./actions";

interface ACoiffeuse {
  id: string;
  nom: string;
  photoUrl: string | null;
  note: number | null;
}

const MOTS = ["", "Pas satisfaite", "Moyen", "Bien", "Très bien", "Excellent !"];

/** La cliente note chaque coiffeuse de sa prestation, de 1 à 5 étoiles (elle peut corriger sa note). */
export function NoterCoiffeuses({ reference, coiffeuses }: { reference: string; coiffeuses: ACoiffeuse[] }) {
  return (
    <section className="mt-6" aria-labelledby="titre-avis">
      <h2 id="titre-avis" className="font-display text-[1.9rem] leading-tight font-bold">
        Comment était votre coiffure ?
      </h2>
      <p className="mt-1 text-sm text-sourdine">Votre avis aide les autres clientes à choisir. Il prend 10 secondes.</p>
      <div className="mt-4 flex flex-col gap-3">
        {coiffeuses.map((c) => (
          <Carte key={c.id} reference={reference} c={c} />
        ))}
      </div>
    </section>
  );
}

function Carte({ reference, c }: { reference: string; c: ACoiffeuse }) {
  const [enCours, start] = useTransition();
  const [note, setNote] = useState(c.note ?? 0);
  const [commentaire, setCommentaire] = useState("");
  const [envoyee, setEnvoyee] = useState(c.note !== null);
  const [erreur, setErreur] = useState("");

  const envoyer = () =>
    start(async () => {
      const r = await noterAction(reference, c.id, note, commentaire);
      if (r.ok) {
        setEnvoyee(true);
        setErreur("");
      } else setErreur(r.erreur);
    });

  return (
    <div className="rounded-2xl bg-white p-4 shadow-carte">
      <div className="flex items-center gap-3">
        <PhotoCoiffeuse nom={c.nom} photoUrl={c.photoUrl} className="size-14 shrink-0 overflow-hidden rounded-full text-xl" />
        <div className="min-w-0">
          <p className="text-xs text-sourdine">Votre coiffeuse</p>
          <p className="font-display text-xl leading-tight font-bold">{c.nom}</p>
        </div>
      </div>
      <div role="radiogroup" aria-label={`Note pour ${c.nom}`} className="mt-3 flex items-center gap-1">
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            role="radio"
            aria-checked={note === n}
            aria-label={`${n} étoile${n > 1 ? "s" : ""} sur 5`}
            onClick={() => {
              setNote(n);
              setEnvoyee(false);
            }}
            className="flex size-12 items-center justify-center rounded-full transition-transform active:scale-90"
          >
            <IconStar width={34} height={34} strokeWidth={1.4} fill={n <= note ? "currentColor" : "none"} className={n <= note ? "text-or" : "text-trait"} />
          </button>
        ))}
        {note > 0 && <span className="ml-2 text-sm font-medium text-or-fonce">{MOTS[note]}</span>}
      </div>
      {note > 0 && !envoyee && (
        <div className="mt-2">
          <label className="flex flex-col gap-1.5">
            <span className="text-xs text-sourdine">Un mot pour le salon ? (facultatif, vu seulement par la gérante)</span>
            <input className={classeInput} value={commentaire} onChange={(e) => setCommentaire(e.target.value)} maxLength={300} />
          </label>
          {erreur && (
            <p role="alert" className="mt-2 text-sm text-rouge">
              {erreur}
            </p>
          )}
          <Button variant="noir" className="mt-3 w-full" loading={enCours} onClick={envoyer}>
            Envoyer mon avis
          </Button>
        </div>
      )}
      {envoyee && (
        <p role="status" className="mt-2 flex items-center gap-2 text-sm font-medium text-vert">
          <IconCheck width={18} height={18} strokeWidth={2.2} />
          Merci ! Votre avis est enregistré.
        </p>
      )}
    </div>
  );
}
