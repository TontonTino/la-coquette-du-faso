-- MIA — schéma initial (phase A : outil de la secrétaire)
-- Exigences : docs/02-requirements.md · Décision : docs/adr/ADR-001
--
-- Fuseau : Ouagadougou = UTC+0 sans heure d'été. Les instants sont stockés en
-- timestamptz ; une date calendaire du salon est une colonne `date`.

CREATE EXTENSION IF NOT EXISTS btree_gist;  -- contrainte d'exclusion (BR-001)
CREATE EXTENSION IF NOT EXISTS pgcrypto;    -- gen_random_uuid()

CREATE TYPE role_utilisateur   AS ENUM ('gerante', 'secretaire', 'coiffeuse');
CREATE TYPE origine_prestation AS ENUM ('rendez_vous', 'sans_rendez_vous');
CREATE TYPE statut_prestation  AS ENUM ('prevue', 'en_attente', 'en_cours', 'terminee', 'annulee', 'absente', 'partie');
CREATE TYPE moyen_paiement     AS ENUM ('especes', 'mobile_money');

-- Un salon = un « tenant ». Toutes les données métier lui sont rattachées.
CREATE TABLE salon (
  id      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nom     text NOT NULL CHECK (length(trim(nom)) BETWEEN 2 AND 80),
  cree_le timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE utilisateur (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  salon_id          uuid NOT NULL REFERENCES salon (id) ON DELETE RESTRICT,
  identifiant       text NOT NULL UNIQUE CHECK (identifiant ~ '^[a-z0-9._-]{3,40}$'),
  nom               text NOT NULL CHECK (length(trim(nom)) BETWEEN 2 AND 60),
  role              role_utilisateur NOT NULL,
  mot_de_passe_hash text NOT NULL,
  actif             boolean NOT NULL DEFAULT true,
  cree_le           timestamptz NOT NULL DEFAULT now()
);

-- Seule l'empreinte SHA-256 du jeton est stockée : une fuite de la table
-- ne permet pas de se faire passer pour quelqu'un.
CREATE TABLE session (
  jeton_hash     text PRIMARY KEY,
  utilisateur_id uuid NOT NULL REFERENCES utilisateur (id) ON DELETE CASCADE,
  expire_le      timestamptz NOT NULL,
  cree_le        timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX session_utilisateur_idx ON session (utilisateur_id);

CREATE TABLE coiffeuse (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  salon_id    uuid NOT NULL REFERENCES salon (id) ON DELETE RESTRICT,
  nom         text NOT NULL CHECK (length(trim(nom)) BETWEEN 2 AND 60),
  -- Jours de congé habituels : 0 = dimanche … 6 = samedi (FR-002).
  jours_conge smallint[] NOT NULL DEFAULT '{}' CHECK (jours_conge <@ ARRAY[0,1,2,3,4,5,6]::smallint[]),
  actif       boolean NOT NULL DEFAULT true,
  cree_le     timestamptz NOT NULL DEFAULT now(),
  UNIQUE (salon_id, id)  -- cible des clés étrangères composées (isolation entre salons)
);

-- Absence imprévue d'une coiffeuse un jour donné (FR-003).
CREATE TABLE absence (
  coiffeuse_id uuid NOT NULL REFERENCES coiffeuse (id) ON DELETE CASCADE,
  jour         date NOT NULL,
  cree_le      timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (coiffeuse_id, jour)
);

CREATE TABLE prestation (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  salon_id    uuid NOT NULL REFERENCES salon (id) ON DELETE RESTRICT,
  origine     origine_prestation NOT NULL,
  statut      statut_prestation NOT NULL,
  client_nom  text NOT NULL CHECK (length(trim(client_nom)) BETWEEN 2 AND 60),
  client_tel  text CHECK (client_tel ~ '^\+226 \d{2} \d{2} \d{2} \d{2}$'),
  modele      text CHECK (length(modele) <= 200),
  jour        date NOT NULL,
  debut       timestamptz,                 -- heure prévue (rendez-vous) ou réelle (en cours)
  duree_min   integer NOT NULL CHECK (duree_min BETWEEN 30 AND 720 AND duree_min % 15 = 0),  -- BR-005
  arrivee     timestamptz,                 -- arrivée au salon (file d'attente, BR-004)
  rang        integer,                     -- ordre manuel dans la file, sinon heure d'arrivée
  prix_paye   integer CHECK (prix_paye >= 0),
  paiement    moyen_paiement,
  cree_par    uuid REFERENCES utilisateur (id) ON DELETE SET NULL,
  cree_le     timestamptz NOT NULL DEFAULT now(),
  maj_le      timestamptz NOT NULL DEFAULT now(),
  UNIQUE (salon_id, id),
  CONSTRAINT rdv_a_une_heure      CHECK (origine <> 'rendez_vous' OR debut IS NOT NULL),
  CONSTRAINT en_cours_a_un_debut  CHECK (statut <> 'en_cours' OR debut IS NOT NULL),
  CONSTRAINT attente_a_une_arrivee CHECK (statut <> 'en_attente' OR arrivee IS NOT NULL),
  CONSTRAINT terminee_est_payee   CHECK (statut <> 'terminee' OR (prix_paye IS NOT NULL AND paiement IS NOT NULL))  -- BR-007
);
CREATE INDEX prestation_salon_jour_idx ON prestation (salon_id, jour);

-- Une ligne par coiffeuse affectée à une prestation (1 ou 2, BR-002), avec la
-- plage horaire qu'elle occupe. Les clés composées (salon_id, …) garantissent
-- qu'une prestation d'un salon ne peut pas utiliser une coiffeuse d'un autre.
CREATE TABLE affectation (
  prestation_id uuid NOT NULL,
  coiffeuse_id  uuid NOT NULL,
  salon_id      uuid NOT NULL,
  plage         tstzrange NOT NULL CHECK (NOT isempty(plage) AND lower_inc(plage) AND NOT upper_inc(plage)),
  active        boolean NOT NULL DEFAULT true,
  PRIMARY KEY (prestation_id, coiffeuse_id),
  FOREIGN KEY (salon_id, prestation_id) REFERENCES prestation (salon_id, id) ON DELETE CASCADE,
  FOREIGN KEY (salon_id, coiffeuse_id)  REFERENCES coiffeuse  (salon_id, id) ON DELETE RESTRICT,
  -- BR-001 : deux affectations actives d'une même coiffeuse ne se chevauchent jamais,
  -- même si deux enregistrements arrivent au même instant.
  CONSTRAINT pas_de_chevauchement EXCLUDE USING gist (coiffeuse_id WITH =, plage WITH &&) WHERE (active)
);
CREATE INDEX affectation_coiffeuse_idx ON affectation (coiffeuse_id);
