# Documentation de MIA

Ce dossier contient la documentation technique et produit de MIA, à côté du code.

## Règle simple

- **Ici (`docs/`)** : ce que l'équipe technique utilise. Les documents évoluent avec le code et Git garde leur historique.
- **Dans des documents partagés** : ce que la gérante, le mentor ou les partenaires doivent lire et commenter (exemple : le guide d'entretien).

## Fichiers

| Fichier | Contenu | Statut |
|---|---|---|
| `00-product-vision.md` | Vision produit, périmètre du MVP, plan sur 4 semaines | Brouillon |
| `01-business-analysis.md` | Analyse métier issue des entretiens | Brouillon |
| `02-requirements.md` | Exigences du MVP (phase A) et règles métier | Brouillon |
| `adr/ADR-001-architecture-et-hebergement.md` | Architecture et hébergement | Accepted |
| `adr/ADR-002-acces-base-de-donnees.md` | Accès à la base : SQL direct et migrations | Accepted |
| `adr/ADR-003-connexion.md` | Connexion et sessions | Accepted |
| `03-traceability.md` | Exigence → code → test → résultat | À jour |
| `09-deployment.md` | Procédure de mise en ligne et pièges connus | À jour |
| `CHANGELOG-exigences.md` | Changements d'exigences | À jour |

Les autres fichiers arriveront au fil des phases (vision produit, exigences, architecture…). On ne crée un fichier que quand on a de quoi le remplir.

## Conventions

- Chaque document indique son **statut** : Brouillon, Validé, Remplacé.
- On distingue toujours **Fait**, **Interprétation** et **Question**.
- Les décisions techniques importantes vont dans `docs/adr/` (une décision par fichier).
