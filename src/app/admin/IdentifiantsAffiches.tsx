"use client";

import { useState } from "react";
import { Carte } from "@/app/salon/ui";

/** Identifiants d'un salon, montrés UNE seule fois : le mot de passe n'est conservé nulle part en clair. */
export function IdentifiantsAffiches({ comptes, titre }: { comptes: { role: string; identifiant: string; motDePasse: string }[]; titre: string }) {
  const [copie, setCopie] = useState(false);
  const texte = comptes.map((c) => `${c.role === "gerante" ? "Gérante" : "Secrétaire"} — identifiant : ${c.identifiant} — mot de passe : ${c.motDePasse}`).join("\n");
  return (
    <Carte ton="or">
      <h3 className="text-[15px] font-semibold">{titre}</h3>
      <p className="mt-1 text-xs text-sourdine">Notez-les maintenant : ces mots de passe ne seront plus jamais affichés. Vous pourrez en générer de nouveaux depuis la fiche du salon.</p>
      <dl className="mt-3 flex flex-col gap-3 text-sm">
        {comptes.map((c) => (
          <div key={c.identifiant}>
            <dt className="font-semibold">{c.role === "gerante" ? "Gérante" : "Secrétaire"}</dt>
            <dd>
              Identifiant : <code className="rounded bg-atelier px-1.5 py-0.5 select-all">{c.identifiant}</code>
            </dd>
            <dd>
              Mot de passe : <code className="rounded bg-atelier px-1.5 py-0.5 select-all">{c.motDePasse}</code>
            </dd>
          </div>
        ))}
      </dl>
      <button
        type="button"
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(texte);
            setCopie(true);
          } catch {
            setCopie(false);
          }
        }}
        className="mt-3 min-h-11 rounded-full border border-noir/15 bg-white px-4 text-sm font-medium hover:border-or"
      >
        {copie ? "Copié" : "Copier les identifiants"}
      </button>
    </Carte>
  );
}
