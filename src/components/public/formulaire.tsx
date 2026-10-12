"use client";

import { useId, type ReactNode } from "react";
import { IconCheck } from "@/components/ui/icons";

/**
 * Éléments de formulaire des pages clientes, communs à tous les salons (les couleurs viennent du thème).
 * Les champs sont reliés à leur libellé, à leur aide et à leur erreur (lecteurs d'écran), et la bordure
 * des champs respecte le contraste minimum de 3:1.
 */

export const classeChamp =
  "h-12 w-full rounded-2xl border border-champ bg-white px-4 text-base text-encre placeholder:text-sourdine transition-shadow focus:border-action focus:ring-4 focus:ring-action/20 focus:outline-none aria-invalid:border-rouge aria-invalid:ring-4 aria-invalid:ring-rouge/15";

export interface ProprietesChamp {
  id: string;
  "aria-describedby"?: string;
  "aria-invalid"?: true;
}

/** Libellé + aide + erreur autour d'un champ ; `children` reçoit les attributs à poser sur le champ. */
export function ChampPublic({
  label,
  aide,
  erreur,
  id,
  children,
}: {
  label: string;
  aide?: string;
  erreur?: string | null;
  /** Identifiant fixe, pour pouvoir placer le curseur dans le champ après une erreur. */
  id?: string;
  children: (champ: ProprietesChamp) => ReactNode;
}) {
  const auto = useId();
  const champId = id ?? auto;
  const aideId = `${champId}-aide`;
  const erreurId = `${champId}-erreur`;
  const decrit = [aide ? aideId : null, erreur ? erreurId : null].filter(Boolean).join(" ") || undefined;
  return (
    <div className="mb-4 flex flex-col gap-1.5">
      <label htmlFor={champId} className="text-sm font-semibold text-encre">
        {label}
      </label>
      {aide && (
        <p id={aideId} className="text-xs text-sourdine">
          {aide}
        </p>
      )}
      {children({ id: champId, "aria-describedby": decrit, "aria-invalid": erreur ? true : undefined })}
      {erreur && (
        <p id={erreurId} role="alert" className="flex items-start gap-1.5 text-sm font-medium text-rouge">
          <span aria-hidden className="mt-px font-bold">
            !
          </span>
          {erreur}
        </p>
      )}
    </div>
  );
}

/** Pastilles de choix (une ou plusieurs valeurs sélectionnées) : la sélection est visible sans la couleur seule. */
export function ChoixPublic<T extends string | number>({
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
            className={`inline-flex min-h-11 items-center gap-1.5 rounded-full border px-4 text-sm transition-colors ${
              on ? "border-marque bg-marque font-medium text-white" : "border-champ bg-white text-encre hover:border-marque"
            }`}
          >
            {on && <IconCheck width={16} height={16} strokeWidth={2.4} className="text-detail" />}
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

type Ton = "erreur" | "succes" | "info" | "indisponible";

const STYLES: Record<Ton, string> = {
  erreur: "bg-rouge-pale text-rouge",
  succes: "bg-vert-pale text-vert",
  info: "bg-sable text-encre",
  indisponible: "bg-accent-pale text-accent-texte",
};

/** Message d'état : erreur (annoncée tout de suite), réussite, information ou indisponibilité (annoncées poliment). */
export function Alerte({ ton, children }: { ton: Ton; children: ReactNode }) {
  return (
    <p role={ton === "erreur" ? "alert" : "status"} className={`flex items-start gap-2 rounded-2xl px-4 py-3 text-sm leading-snug ${STYLES[ton]}`}>
      <span aria-hidden className="mt-px font-bold">
        {ton === "succes" ? "✓" : ton === "erreur" ? "!" : "i"}
      </span>
      <span>{children}</span>
    </p>
  );
}

/** Bloc de chargement aux dimensions du contenu attendu (évite les sauts de page). */
export function Squelette({ className = "h-24" }: { className?: string }) {
  return <div aria-hidden className={`animate-pulse rounded-2xl bg-sable ${className}`} />;
}
