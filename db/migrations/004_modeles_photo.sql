-- MIA — catalogue de modèles en photo (les clientes choisissent leur coiffure sur photo).
-- Exigences : FR-C01 à FR-C05 (docs/02-requirements.md).
--
-- La photo est stockée dans la base (bytea), déjà réduite par le téléphone (environ 900 px, ~150 Ko) :
-- pas de service de stockage supplémentaire à créer ni à payer pour quelques dizaines de photos.

CREATE TABLE modele (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  salon_id     uuid NOT NULL REFERENCES salon (id) ON DELETE RESTRICT,
  categorie_id uuid,
  nom          text NOT NULL CHECK (length(trim(nom)) BETWEEN 2 AND 60),
  photo        bytea NOT NULL CHECK (octet_length(photo) BETWEEN 1000 AND 800000),
  photo_type   text NOT NULL CHECK (photo_type IN ('image/jpeg', 'image/png', 'image/webp')),
  prix_min     integer CHECK (prix_min >= 0),
  prix_max     integer CHECK (prix_max >= 0),
  duree_min    integer CHECK (duree_min BETWEEN 30 AND 720),
  duree_max    integer CHECK (duree_max BETWEEN 30 AND 720),
  actif        boolean NOT NULL DEFAULT true,
  ordre        integer NOT NULL DEFAULT 0,
  cree_le      timestamptz NOT NULL DEFAULT now(),
  maj_le       timestamptz NOT NULL DEFAULT now(),
  UNIQUE (salon_id, id),
  FOREIGN KEY (salon_id, categorie_id) REFERENCES categorie (salon_id, id) ON DELETE RESTRICT,
  CHECK (prix_max IS NULL OR prix_min IS NULL OR prix_max >= prix_min),
  CHECK (duree_max IS NULL OR duree_min IS NULL OR duree_max >= duree_min)
);
CREATE INDEX modele_salon_idx ON modele (salon_id, actif, ordre);

-- Modèle choisi par la cliente (demande en ligne) ou noté par la secrétaire.
ALTER TABLE prestation ADD COLUMN modele_id uuid;
ALTER TABLE prestation
  ADD CONSTRAINT prestation_modele_fk FOREIGN KEY (salon_id, modele_id) REFERENCES modele (salon_id, id) ON DELETE RESTRICT;
