-- Espace MIA (administration de la plateforme, réservée à l'opérateur) et logo propre à chaque salon.
-- Migration additive : aucune table existante n'est modifiée, sauf trois colonnes facultatives sur « salon ».

-- Sessions de l'opérateur. Le compte lui-même n'est PAS en base : identifiant et mot de passe viennent de
-- variables d'environnement (MIA_ADMIN_IDENTIFIANT, MIA_ADMIN_MOT_DE_PASSE). Seule l'empreinte du jeton est gardée.
CREATE TABLE session_admin (
  jeton_hash text PRIMARY KEY,
  expire_le  timestamptz NOT NULL,
  cree_le    timestamptz NOT NULL DEFAULT now()
);

-- Essais de connexion ratés, pour bloquer les attaques par essais successifs.
CREATE TABLE tentative_admin (
  id      bigserial PRIMARY KEY,
  cree_le timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX tentative_admin_recentes ON tentative_admin (cree_le);

-- Logo du salon, déjà réduit par le navigateur (quelques dizaines de Ko), stocké comme les photos de modèles.
ALTER TABLE salon ADD COLUMN logo      bytea CHECK (logo IS NULL OR octet_length(logo) BETWEEN 200 AND 300000);
ALTER TABLE salon ADD COLUMN logo_type text  CHECK (logo_type IS NULL OR logo_type IN ('image/jpeg', 'image/png', 'image/webp'));
ALTER TABLE salon ADD COLUMN logo_maj  timestamptz;
