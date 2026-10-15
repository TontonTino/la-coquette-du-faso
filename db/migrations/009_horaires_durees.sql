-- Horaires d'ouverture par jour, pause entre deux clientes, durée et prix de chaque service.
-- Migration additive : rien n'est supprimé, les salons existants gardent leur fonctionnement.

-- Un jour sans ligne = salon fermé ce jour-là. Un salon sans aucune ligne = horaires pas encore réglés.
-- Jour : 0 = dimanche … 6 = samedi (même convention que le reste de l'application). Heures en minutes depuis minuit.
CREATE TABLE salon_horaire (
  salon_id  uuid NOT NULL REFERENCES salon (id) ON DELETE CASCADE,
  jour      smallint NOT NULL CHECK (jour BETWEEN 0 AND 6),
  ouvre_min smallint NOT NULL CHECK (ouvre_min BETWEEN 0 AND 1439),
  ferme_min smallint NOT NULL CHECK (ferme_min BETWEEN 1 AND 1440),
  PRIMARY KEY (salon_id, jour),
  CHECK (ferme_min > ouvre_min)
);

-- Temps de repos entre deux clientes d'une même coiffeuse (30 minutes par défaut).
ALTER TABLE salon ADD COLUMN pause_min smallint NOT NULL DEFAULT 30 CHECK (pause_min BETWEEN 0 AND 120 AND pause_min % 5 = 0);

-- Durée et prix d'un service (facultatifs tant que la gérante ne les a pas réglés).
ALTER TABLE categorie ADD COLUMN duree_min smallint CHECK (duree_min IS NULL OR (duree_min BETWEEN 30 AND 720 AND duree_min % 15 = 0));
ALTER TABLE categorie ADD COLUMN prix integer CHECK (prix IS NULL OR prix BETWEEN 0 AND 1000000);

-- La Coquette du Faso garde ses horaires historiques : tous les jours de 6 h 30 à 23 h.
INSERT INTO salon_horaire (salon_id, jour, ouvre_min, ferme_min)
SELECT s.id, j, 390, 1380 FROM salon s CROSS JOIN generate_series(0, 6) AS j WHERE s.slug = 'la-coquette-du-faso';
