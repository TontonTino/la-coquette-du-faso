-- MIA — acompte en ligne (PayDunya : Orange Money, Moov Money).
-- Sans danger sur une base déjà en service : une NOUVELLE table, aucune colonne ajoutée aux tables existantes.
-- La fonction reste éteinte tant que les variables d'environnement PAYDUNYA_* et ACOMPTE_FCFA ne sont pas posées.

CREATE TABLE acompte (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  salon_id      uuid NOT NULL,
  prestation_id uuid NOT NULL,
  montant       integer NOT NULL CHECK (montant BETWEEN 100 AND 1000000),   -- FCFA
  -- en_attente : facture créée, pas encore payée ; paye : confirmé par PayDunya ;
  -- echoue / annule : abandonné ; doublon : payé une 2e fois (à rembourser à la main).
  statut        text NOT NULL DEFAULT 'en_attente' CHECK (statut IN ('en_attente', 'paye', 'echoue', 'annule', 'doublon')),
  fournisseur   text NOT NULL DEFAULT 'paydunya',
  -- Un paiement fait en mode « test » ne contient aucun vrai argent : on garde la distinction.
  mode          text NOT NULL CHECK (mode IN ('test', 'production')),
  jeton         text NOT NULL CHECK (length(jeton) BETWEEN 5 AND 200),      -- jeton de la facture chez le fournisseur
  cree_le       timestamptz NOT NULL DEFAULT now(),
  paye_le       timestamptz,
  FOREIGN KEY (salon_id, prestation_id) REFERENCES prestation (salon_id, id) ON DELETE RESTRICT,
  UNIQUE (fournisseur, jeton),
  CONSTRAINT paye_a_une_date CHECK (statut NOT IN ('paye', 'doublon') OR paye_le IS NOT NULL)
);
-- Une prestation n'a jamais deux acomptes payés (le 2e est marqué « doublon »).
CREATE UNIQUE INDEX acompte_un_seul_paye ON acompte (prestation_id) WHERE statut = 'paye';
CREATE INDEX acompte_prestation_idx ON acompte (prestation_id, cree_le);
