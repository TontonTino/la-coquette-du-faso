-- MIA — compétences des coiffeuses (correction du 10/10/2026 : chaque coiffeuse a ses spécialités).
-- Exigences : FR-015, FR-016, BR-009 (docs/02-requirements.md).

-- Types de coiffure définis par la gérante (les clientes choisissent sur photo : on classe par famille).
CREATE TABLE categorie (
  id       uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  salon_id uuid NOT NULL REFERENCES salon (id) ON DELETE RESTRICT,
  nom      text NOT NULL CHECK (length(trim(nom)) BETWEEN 2 AND 40),
  actif    boolean NOT NULL DEFAULT true,
  cree_le  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (salon_id, nom),
  UNIQUE (salon_id, id)
);

-- Ce que chaque coiffeuse sait faire. Clés composées : coiffeuse et type du même salon.
CREATE TABLE competence (
  coiffeuse_id uuid NOT NULL,
  categorie_id uuid NOT NULL,
  salon_id     uuid NOT NULL,
  PRIMARY KEY (coiffeuse_id, categorie_id),
  FOREIGN KEY (salon_id, coiffeuse_id) REFERENCES coiffeuse (salon_id, id) ON DELETE CASCADE,
  FOREIGN KEY (salon_id, categorie_id) REFERENCES categorie (salon_id, id) ON DELETE CASCADE
);
CREATE INDEX competence_categorie_idx ON competence (categorie_id);

-- Type de coiffure demandé (facultatif : « je ne sais pas encore »).
ALTER TABLE prestation ADD COLUMN categorie_id uuid;
ALTER TABLE prestation
  ADD CONSTRAINT prestation_categorie_fk FOREIGN KEY (salon_id, categorie_id) REFERENCES categorie (salon_id, id) ON DELETE RESTRICT;
