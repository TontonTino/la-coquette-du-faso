import type { ReactNode } from "react";

/** Petits éléments d'interface de l'espace salon (mobile d'abord, cibles ≥ 44 px). */

export function Section({ titre, nombre, children }: { titre: string; nombre?: number; children: ReactNode }) {
  return (
    <section className="mt-6">
      <h2 className="mb-2 flex justify-between text-xs font-semibold tracking-[0.08em] text-sourdine uppercase">
        <span>{titre}</span>
        {nombre !== undefined && <span>{nombre}</span>}
      </h2>
      <div className="flex flex-col gap-2">{children}</div>
    </section>
  );
}

export function Carte({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`rounded-xl border border-trait bg-white p-3 ${className}`}>{children}</div>;
}

export function Vide({ children }: { children: ReactNode }) {
  return <p className="rounded-xl border border-dashed border-trait p-3 text-center text-sm text-sourdine">{children}</p>;
}

export function Pastille({ ton, children }: { ton: "or" | "gris" | "rouge"; children: ReactNode }) {
  const tons = { or: "bg-or-pale text-or-fonce", gris: "bg-gris text-encre", rouge: "bg-rouge-pale text-rouge" };
  return <span className={`inline-block rounded-full px-2 py-0.5 text-[11px] font-semibold whitespace-nowrap ${tons[ton]}`}>{children}</span>;
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
            className={`min-h-11 rounded-full border px-4 text-sm ${on ? "border-noir bg-noir text-white" : "border-trait bg-white text-encre"}`}
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
      <span className="text-sm font-medium">{label}</span>
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

export const classeInput = "h-12 w-full rounded-xl border border-trait bg-white px-3 text-base text-encre";

export function ChargementListe() {
  return (
    <div aria-busy="true" aria-label="Chargement" className="flex flex-col gap-2">
      {[0, 1, 2, 3].map((i) => (
        <div key={i} className="h-20 animate-pulse rounded-xl bg-white" />
      ))}
    </div>
  );
}
