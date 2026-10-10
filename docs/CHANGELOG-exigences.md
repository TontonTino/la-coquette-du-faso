# Changements d'exigences

Aucune exigence validée n'est modifiée sans une ligne ici.

| Date | Changement | Origine | Impact |
|---|---|---|---|
| 10/10/2026 | **Les coiffeuses ont des spécialités** (et non « chacune fait tout »). Ajout de BR-009, FR-015, FR-016 ; FR-006 et FR-010 précisés. | Correction de l'enquêteur après l'entretien | **Données** : tables `categorie`, `competence`, colonne `prestation.categorie_id` (migration 002). **Service** : filtrage et refus des coiffeuses non compétentes. **Écrans** : choix du type de coiffure (secrétaire), types et spécialités (gérante). **Tests** : un test d'intégration et une étape e2e ajoutés. **Coût, planning** : aucun impact notable. |
