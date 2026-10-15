"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { Carte, Champ, classeInput } from "@/app/salon/ui";
import { Button } from "@/components/ui/Button";
import { THEME_PAR_DEFAUT } from "@/lib/salon/theme";
import type { SalonDetail } from "@/server/salon/admin-salons";
import { creerSalonAction, modifierSalonAction } from "./actions";
import { ChoixLogo } from "./ChoixLogo";
import { IdentifiantsAffiches } from "./IdentifiantsAffiches";

/** Formulaire de création (sans `salon`) ou de modification (avec `salon`) d'un salon. */
export function FormulaireSalon({ salon }: { salon?: SalonDetail }) {
  const modif = !!salon;
  const [etatCreation, creer, creationEnCours] = useActionState(creerSalonAction, null);
  const [etatModif, modifier, modifEnCours] = useActionState(modifierSalonAction, null);
  const [couleursDefaut, setCouleursDefaut] = useState(!salon || Object.keys(salon.theme).length === 0);

  if (etatCreation?.cree) {
    const c = etatCreation.cree;
    return (
      <div className="flex flex-col gap-4">
        <Carte ton="vert">
          <h2 className="font-display text-2xl font-bold text-encre">Salon créé : {c.nom}</h2>
          <p className="mt-1 text-sm text-sourdine">
            {c.services} service{c.services > 1 ? "s" : ""} ajouté{c.services > 1 ? "s" : ""}. Aucune coiffeuse, aucun modèle, aucune donnée fictive : le salon est propre.
          </p>
        </Carte>
        <IdentifiantsAffiches comptes={c.comptes} titre="Identifiants à remettre à la gérante" />
        <div className="flex flex-wrap gap-3">
          <Link href={`/s/${c.slug}`} className="inline-flex h-11 items-center rounded-full bg-mia-action px-5 text-sm font-medium text-white hover:bg-mia-action-fort">
            Voir la page du salon
          </Link>
          <Link href={`/admin/salons/${c.salonId}`} className="inline-flex h-11 items-center rounded-full border border-noir/15 bg-white px-5 text-sm font-medium hover:border-or">
            Régler ce salon
          </Link>
          <Link href="/admin" className="inline-flex h-11 items-center px-3 text-sm underline underline-offset-4">
            Retour à la liste
          </Link>
        </div>
      </div>
    );
  }

  const etat = modif ? etatModif : etatCreation;
  const enCours = modif ? modifEnCours : creationEnCours;
  const t = { ...THEME_PAR_DEFAUT, ...(salon?.theme ?? {}) };

  return (
    <form action={modif ? modifier : creer} className="flex flex-col">
      {modif && <input type="hidden" name="id" value={salon.id} />}
      <Carte className="mb-4">
        <h2 className="mb-3 text-[15px] font-semibold">Le salon</h2>
        <Champ label="Nom du salon">
          <input name="nom" required minLength={2} maxLength={80} defaultValue={salon?.nom} className={classeInput} />
        </Champ>
        {!modif && (
          <Champ label="Identifiant dans l'adresse" aide="Facultatif : déduit du nom. Sert pour l'adresse /s/identifiant et les identifiants de connexion.">
            <input name="slug" maxLength={60} pattern="[a-z0-9\-]{3,60}" autoCapitalize="none" className={classeInput} />
          </Champ>
        )}
        <ChoixLogo actuel={salon?.aLogo ? `/s/${salon.slug}/logo?v=${salon.logoV}` : null} />
      </Carte>

      <Carte className="mb-4">
        <h2 className="mb-3 text-[15px] font-semibold">Coordonnées</h2>
        <Champ label="Téléphone">
          <input name="telephone" type="tel" inputMode="tel" defaultValue={salon?.telephone ?? ""} placeholder="70 12 34 56" className={classeInput} />
        </Champ>
        <Champ label="WhatsApp" aide="Contact simple pour les clientes.">
          <input name="whatsapp" type="tel" inputMode="tel" defaultValue={salon?.whatsapp ?? ""} placeholder="70 12 34 56" className={classeInput} />
        </Champ>
        <Champ label="E-mail">
          <input name="email" type="email" defaultValue={salon?.email ?? ""} className={classeInput} />
        </Champ>
        <Champ label="Adresse">
          <input name="adresse" maxLength={200} defaultValue={salon?.adresse ?? ""} className={classeInput} />
        </Champ>
        <Champ label="Horaires affichés" aide="Texte libre, par exemple « Lun-Sam, 8 h - 19 h ».">
          <input name="horaires" maxLength={120} defaultValue={salon?.horaires ?? ""} className={classeInput} />
        </Champ>
        <Champ label="Lien de la carte (https://…)">
          <input name="carteUrl" type="url" defaultValue={salon?.carteUrl ?? ""} className={classeInput} />
        </Champ>
      </Carte>

      {!modif && (
        <Carte className="mb-4">
          <h2 className="mb-3 text-[15px] font-semibold">Services</h2>
          <Champ label="Types de services" aide="Séparés par des virgules. Ajoutez « :ongles » pour les ongles. Exemple : Tresses, Tissage, Manucure:ongles">
            <textarea name="services" rows={3} maxLength={1000} className={`${classeInput} h-auto py-3`} />
          </Champ>
        </Carte>
      )}

      <Carte className="mb-4">
        <h2 className="mb-3 text-[15px] font-semibold">Couleurs</h2>
        <label className="mb-3 flex min-h-11 items-center gap-3 text-sm">
          <input type="checkbox" name="couleursDefaut" checked={couleursDefaut} onChange={(e) => setCouleursDefaut(e.target.checked)} className="size-5" />
          Garder les couleurs MIA par défaut
        </label>
        {!couleursDefaut && (
          <div className="grid grid-cols-3 gap-3">
            {(
              [
                ["marque", "Fond sombre", t.marque],
                ["action", "Boutons", t.action],
                ["detail", "Détails", t.detail],
              ] as const
            ).map(([nom, libelle, valeur]) => (
              <label key={nom} className="flex flex-col gap-1.5 text-sm font-semibold">
                {libelle}
                <input name={nom} type="color" defaultValue={valeur} className="h-12 w-full cursor-pointer rounded-2xl border border-trait bg-white p-1" />
              </label>
            ))}
          </div>
        )}
        {!couleursDefaut && <p className="mt-2 text-xs text-sourdine">Le texte doit rester lisible : un choix trop clair ou trop proche sera refusé avec une explication.</p>}
      </Carte>

      <Carte className="mb-4">
        <h2 className="mb-3 text-[15px] font-semibold">Page d&apos;accueil</h2>
        <Champ label="Titre" aide="Le mot entre *étoiles* est mis en valeur. Facultatif.">
          <input name="titre" maxLength={80} defaultValue={salon?.textes.titre ?? ""} className={classeInput} />
        </Champ>
        <Champ label="Petite ligne au-dessus du titre">
          <input name="etiquette" maxLength={60} defaultValue={salon?.textes.etiquette ?? ""} className={classeInput} />
        </Champ>
        <Champ label="Phrase d'accroche">
          <textarea name="accroche" rows={2} maxLength={220} defaultValue={salon?.textes.accroche ?? ""} className={`${classeInput} h-auto py-3`} />
        </Champ>
      </Carte>

      {etat?.erreur && (
        <p role="alert" className="mb-4 rounded-xl bg-rouge-pale px-3 py-2 text-sm whitespace-pre-line text-rouge">
          {etat.erreur}
        </p>
      )}
      {etatModif?.ok && modif && (
        <p role="status" className="mb-4 rounded-xl bg-vert-pale px-3 py-2 text-sm text-vert">
          {etatModif.ok}
        </p>
      )}
      <Button type="submit" variant="mia" size="lg" loading={enCours}>
        {modif ? "Enregistrer" : "Créer le salon"}
      </Button>
    </form>
  );
}
