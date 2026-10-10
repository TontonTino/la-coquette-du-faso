# Changements d'exigences

Aucune exigence validée n'est modifiée sans une ligne ici.

| Date | Changement | Origine | Impact |
|---|---|---|---|
| 10/10/2026 | **Les coiffeuses ont des spécialités** (et non « chacune fait tout »). Ajout de BR-009, FR-015, FR-016 ; FR-006 et FR-010 précisés. | Correction de l'enquêteur après l'entretien | **Données** : tables `categorie`, `competence`, colonne `prestation.categorie_id` (migration 002). **Service** : filtrage et refus des coiffeuses non compétentes. **Écrans** : choix du type de coiffure (secrétaire), types et spécialités (gérante). **Tests** : un test d'intégration et une étape e2e ajoutés. **Coût, planning** : aucun impact notable. |
| 10/10/2026 | **Phase B avancée** : demandes en ligne (FR-B01 à FR-B08, SEC-B01, SEC-B02). La démo passe de `/` à `/demo`. | Décision de l'équipe : tout présenter au salon en même temps, dans une semaine | **Données** : migration 003 (statuts `demandee` et `refusee`, référence, souhaits, canal, adresse et WhatsApp du salon). **Écrans** : accueil, formulaire et suivi pour les clientes ; demandes à traiter pour la secrétaire. **Tests** : 4 tests d'intégration, 2 unitaires, un e2e de 13 étapes. |
