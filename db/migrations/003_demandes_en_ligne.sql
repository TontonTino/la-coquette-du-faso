-- MIA — phase B : demandes de rendez-vous envoyées en ligne par les clientes.
-- La cliente envoie une DEMANDE ; la secrétaire la confirme (heure, durée, coiffeuses) ou la refuse.
-- Exigences : FR-B01 à FR-B08 (docs/02-requirements.md).

ALTER TYPE statut_prestation ADD VALUE IF NOT EXISTS 'demandee';
ALTER TYPE statut_prestation ADD VALUE IF NOT EXISTS 'refusee';

-- Identité publique du salon : adresse courte et numéro WhatsApp affiché aux clientes.
ALTER TABLE salon ADD COLUMN slug text UNIQUE CHECK (slug ~ '^[a-z0-9-]{3,60}$');
ALTER TABLE salon ADD COLUMN whatsapp text CHECK (whatsapp ~ '^\+226 \d{2} \d{2} \d{2} \d{2}$');
UPDATE salon SET slug = 'la-coquette-du-faso' WHERE slug IS NULL AND nom = 'La Coquette du Faso';

-- Canal : saisie au salon par la secrétaire, ou demande en ligne.
ALTER TABLE prestation ADD COLUMN canal text NOT NULL DEFAULT 'salon' CHECK (canal IN ('salon', 'en_ligne'));
-- Référence de suivi donnée à la cliente (8 caractères aléatoires, impossible à deviner en pratique).
ALTER TABLE prestation ADD COLUMN reference text UNIQUE CHECK (reference ~ '^[A-Z2-9]{8}$');
-- Souhaits de la cliente : moment de la journée et coiffeuse préférée (facultative).
ALTER TABLE prestation ADD COLUMN souhait_moment text CHECK (souhait_moment IN ('matin', 'apres_midi', 'fin_journee'));
ALTER TABLE prestation ADD COLUMN coiffeuse_souhaitee uuid;
ALTER TABLE prestation
  ADD CONSTRAINT prestation_coiffeuse_souhaitee_fk FOREIGN KEY (salon_id, coiffeuse_souhaitee) REFERENCES coiffeuse (salon_id, id) ON DELETE RESTRICT;
ALTER TABLE prestation ADD COLUMN motif_refus text CHECK (length(motif_refus) <= 200);

-- Une demande n'a pas encore d'heure : la règle « un rendez-vous a une heure » s'applique dès la confirmation.
-- (Comparaison en texte : les nouvelles valeurs de l'énumération ne sont utilisables qu'après la transaction.)
ALTER TABLE prestation DROP CONSTRAINT rdv_a_une_heure;
ALTER TABLE prestation ADD CONSTRAINT rdv_a_une_heure
  CHECK (origine <> 'rendez_vous' OR debut IS NOT NULL OR statut::text IN ('demandee', 'refusee'));
ALTER TABLE prestation ADD CONSTRAINT en_ligne_a_une_reference CHECK (canal <> 'en_ligne' OR reference IS NOT NULL);

CREATE INDEX prestation_salon_statut_idx ON prestation (salon_id, statut);
CREATE INDEX prestation_tel_idx ON prestation (salon_id, client_tel) WHERE client_tel IS NOT NULL;
