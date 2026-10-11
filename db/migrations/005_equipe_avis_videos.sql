-- MIA — coordonnées du salon, services ongles, photos des coiffeuses, avis des clientes, vidéos courtes.
-- Demandes du 11/10/2026 (pilote La Coquette du Faso). Sans danger sur une base déjà en service :
-- uniquement des colonnes facultatives (ou avec valeur par défaut) et de nouvelles tables.

/* ---------- Coordonnées du salon (affichées aux clientes) ---------- */
ALTER TABLE salon ADD COLUMN telephone text CHECK (telephone ~ '^\+226 \d{2} \d{2} \d{2} \d{2}$');
ALTER TABLE salon ADD COLUMN email     text CHECK (length(email) <= 120);
ALTER TABLE salon ADD COLUMN adresse   text CHECK (length(adresse) <= 200);
ALTER TABLE salon ADD COLUMN horaires  text CHECK (length(horaires) <= 120);
ALTER TABLE salon ADD COLUMN carte_url text CHECK (carte_url ~ '^https://[^[:space:]]+$' AND length(carte_url) <= 400);

UPDATE salon SET
  telephone = '+226 64 15 00 20',
  email     = 'coquettedufaso64@gmail.com',
  adresse   = '1200 logements, à une minute d''Aube Nouvelle, Ouagadougou',
  horaires  = 'Tous les jours, de 6 h 30 à 23 h',
  carte_url = 'https://www.google.com/maps?q=12.378299568941,-1.5094143738174'
WHERE slug = 'la-coquette-du-faso' AND telephone IS NULL;

/* ---------- Services : coiffure et ongles (manucure, pédicure) ---------- */
ALTER TABLE categorie ADD COLUMN famille text NOT NULL DEFAULT 'coiffure' CHECK (famille IN ('coiffure', 'ongles'));

INSERT INTO categorie (salon_id, nom, famille)
SELECT id, s.nom, 'ongles' FROM salon, (VALUES ('Manucure'), ('Pédicure')) AS s (nom)
WHERE slug = 'la-coquette-du-faso'
ON CONFLICT (salon_id, nom) DO NOTHING;

/* ---------- Photo des coiffeuses (les clientes ne connaissent pas les noms) ---------- */
ALTER TABLE coiffeuse ADD COLUMN photo      bytea CHECK (octet_length(photo) BETWEEN 1000 AND 800000);
ALTER TABLE coiffeuse ADD COLUMN photo_type text  CHECK (photo_type IN ('image/jpeg', 'image/png', 'image/webp'));
ALTER TABLE coiffeuse ADD COLUMN photo_maj  timestamptz;
ALTER TABLE coiffeuse ADD CONSTRAINT coiffeuse_photo_et_type CHECK ((photo IS NULL) = (photo_type IS NULL));

/* ---------- Qui a réellement fait la prestation (pour que seules ces coiffeuses soient notées) ---------- */
-- À la fin d'une prestation, ses affectations passent « inactives » (le créneau est libéré) : on garde
-- donc une trace de celles qui étaient actives à ce moment-là, c'est-à-dire qui ont fait la coiffure.
ALTER TABLE affectation ADD COLUMN a_fait boolean NOT NULL DEFAULT false;
UPDATE affectation a SET a_fait = true FROM prestation p WHERE p.id = a.prestation_id AND p.statut = 'terminee';

/* ---------- Avis : une note de 1 à 5 par coiffeuse et par prestation terminée ---------- */
CREATE TABLE avis (
  prestation_id uuid NOT NULL,
  coiffeuse_id  uuid NOT NULL,
  salon_id      uuid NOT NULL,
  note          smallint NOT NULL CHECK (note BETWEEN 1 AND 5),
  commentaire   text CHECK (length(commentaire) <= 300),  -- visible seulement par la gérante
  cree_le       timestamptz NOT NULL DEFAULT now(),
  maj_le        timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (prestation_id, coiffeuse_id),
  FOREIGN KEY (salon_id, prestation_id) REFERENCES prestation (salon_id, id) ON DELETE CASCADE,
  FOREIGN KEY (salon_id, coiffeuse_id)  REFERENCES coiffeuse (salon_id, id) ON DELETE RESTRICT
);
CREATE INDEX avis_coiffeuse_idx ON avis (coiffeuse_id);

/* ---------- Vidéos courtes : volume, couleur et qualité d'une coiffure ---------- */
CREATE TABLE video (
  id        uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  salon_id  uuid NOT NULL REFERENCES salon (id) ON DELETE RESTRICT,
  modele_id uuid,  -- modèle du catalogue que la vidéo présente (la cliente peut le demander d'un geste)
  titre     text NOT NULL CHECK (length(trim(titre)) BETWEEN 2 AND 60),
  url       text NOT NULL CHECK (url ~ '^https://[^[:space:]]+$' AND length(url) <= 500),
  actif     boolean NOT NULL DEFAULT true,
  cree_le   timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (salon_id, modele_id) REFERENCES modele (salon_id, id) ON DELETE RESTRICT
);
CREATE INDEX video_salon_idx ON video (salon_id, actif, cree_le DESC);
