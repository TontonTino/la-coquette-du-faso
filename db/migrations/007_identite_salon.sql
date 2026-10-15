-- Identité propre à chaque salon : couleurs et textes de la page d'accueil (facultatifs).
-- Migration additive : un salon sans valeur garde le thème et les textes par défaut.
ALTER TABLE salon ADD COLUMN theme   jsonb CHECK (theme   IS NULL OR (jsonb_typeof(theme)   = 'object' AND length(theme::text)   <= 2000));
ALTER TABLE salon ADD COLUMN vitrine jsonb CHECK (vitrine IS NULL OR (jsonb_typeof(vitrine) = 'object' AND length(vitrine::text) <= 4000));
