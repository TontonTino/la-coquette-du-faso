import type { ReactNode } from "react";

/** Petits éléments d'interface de l'espace salon (mobile d'abord, cibles ≥ 44 px). */

/** Couleur de l'état d'une carte : un trait à gauche, repérable d'un coup d'œil. */
export type Ton = "or" | "indigo" | "noir" | "vert" | "rouge" | "neutre";
const TRAITS: Record<Ton, string> = {
  or: "before:bg-or",
  indigo: "before:bg-indigo",
  noir: "before:bg-noir",
  vert: "before:bg-vert",
  rouge: "before:bg-rouge",
  neutre: "before:bg-trait",
};
const POINTS: Record<Ton, string> = { or: "bg-or", indigo: "bg-indigo", noir: "bg-noir", vert: "bg-vert", rouge: "bg-rouge", neutre: "bg-trait" };

export function Section({ titre, nombre, ton = "neutre", children }: { titre: string; nombre?: number; ton?: Ton; children: ReactNode }) {
  return (
    <section className="mt-7">
      <h2 className="mb-3 flex items-center gap-2 text-[15px] font-semibold text-encre">
        <span className={`size-2 rounded-full ${POINTS[ton]}`} aria-hidden />
        <span>{titre}</span>
        {nombre !== undefined && (
          <span className="ml-auto min-w-7 rounded-full bg-white px-2 py-0.5 text-center text-xs font-semibold text-sourdine shadow-sm">{nombre}</span>
        )}
      </h2>
      <div className="flex flex-col gap-2.5">{children}</div>
    </section>
  );
}

export function Carte({ children, className = "", ton }: { children: ReactNode; className?: string; ton?: Ton }) {
  const trait = ton ? `relative overflow-hidden pl-4 before:absolute before:inset-y-0 before:left-0 before:w-1 ${TRAITS[ton]}` : "";
  return <div className={`rounded-xl bg-white p-3.5 shadow-carte ${trait} ${className}`}>{children}</div>;
}

export function Vide({ children }: { children: ReactNode }) {
  return <p className="rounded-xl border border-dashed border-noir/15 px-3 py-4 text-center text-sm text-sourdine">{children}</p>;
}

export function Pastille({ ton, children }: { ton: "or" | "gris" | "rouge" | "indigo" | "vert"; children: ReactNode }) {
  const tons = { or: "bg-or-pale text-or-fonce", gris: "bg-atelier text-encre", rouge: "bg-rouge-pale text-rouge", indigo: "bg-indigo-pale text-indigo", vert: "bg-[#dff3e8] text-[#196842]" };
  return <span className={`inline-block rounded-full px-2.5 py-0.5 text-[11px] font-semibold whitespace-nowrap ${tons[ton]}`}>{children}</span>;
}

/** Initiales d'une personne, pour un repère visuel rapide (purement décoratif). */
export function Initiales({ nom, className = "" }: { nom: string; className?: string }) {
  const ini = nom
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((m) => m[0]?.toUpperCase())
    .join("");
  return (
    <span aria-hidden className={`flex size-10 shrink-0 items-center justify-center rounded-full bg-noir font-display text-lg font-bold text-or ${className}`}>
      {ini}
    </span>
  );
}

export function Choix<T extends string | number>({
  options,
  valeur,
  onChange,
  libelle,
}: {
  options: { valeur: T; label: string }[];
  valeur: T | T[];
  onChange: (v: T) => void;
  libelle: string;
}) {
  const choisis = Array.isArray(valeur) ? valeur : [valeur];
  return (
    <div role="group" aria-label={libelle} className="flex flex-wrap gap-2">
      {options.map((o) => {
        const on = choisis.includes(o.valeur);
        return (
          <button
            key={String(o.valeur)}
            type="button"
            aria-pressed={on}
            onClick={() => onChange(o.valeur)}
            className={`min-h-11 rounded-full border px-4 text-sm transition-colors ${
              on ? "border-noir bg-noir font-medium text-white" : "border-trait bg-white text-encre hover:border-or"
            }`}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

/**
 * Champ de formulaire. Un champ de saisie est enveloppé dans un vrai <label> (lu par les lecteurs d'écran) ;
 * un groupe de boutons (`groupe`) reçoit un role="group" nommé, car un <label> autour de boutons les déclencherait.
 */
export function Champ({
  label,
  erreur,
  aide,
  groupe = false,
  children,
}: {
  label: string;
  erreur?: string | null;
  aide?: string;
  groupe?: boolean;
  children: ReactNode;
}) {
  const contenu = (
    <>
      <span className="text-sm font-semibold text-encre">{label}</span>
      {aide && <span className="text-xs text-sourdine">{aide}</span>}
      {children}
      {erreur && (
        <span role="alert" className="text-xs font-medium text-rouge">
          {erreur}
        </span>
      )}
    </>
  );
  return groupe ? (
    <div role="group" aria-label={label} className="mb-4 flex flex-col gap-1.5">
      {contenu}
    </div>
  ) : (
    <label className="mb-4 flex flex-col gap-1.5">{contenu}</label>
  );
}

export const classeInput =
  "h-12 w-full rounded-2xl border border-trait bg-white px-4 text-base text-encre placeholder:text-sourdine/60 transition-shadow focus:border-or focus:ring-4 focus:ring-or/15 focus:outline-none";

export function ChargementListe() {
  return (
    <div aria-busy="true" aria-label="Chargement" className="flex flex-col gap-2">
      {[0, 1, 2, 3].map((i) => (
        <div key={i} className="h-20 animate-pulse rounded-xl bg-white/70" />
      ))}
    </div>
  );
}
