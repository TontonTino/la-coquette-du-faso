# ADR-002 — Accès à la base de données

| | |
|---|---|
| Statut | **Accepted** — 10/10/2026 |
| Contexte | ADR-001 (PostgreSQL chez Neon) |

## Problème

Comment le code parle-t-il à PostgreSQL, et comment fait-on évoluer le schéma ?

## Options examinées

| | ORM (Prisma, Drizzle) | **SQL direct avec le pilote `postgres`** |
|---|---|---|
| Contrainte d'exclusion, `tstzrange`, clés composées | Mal ou pas gérées : SQL brut de toute façon | Natif |
| Ce que l'équipe apprend | L'outil | SQL, réutilisable partout |
| Dépendances | Lourdes (générateur, moteur) | Une seule, sans dépendance |
| Sécurité contre l'injection SQL | Oui | Oui (requêtes paramétrées par les gabarits `sql\`...\``) |

## Décision

- Pilote **`postgres`** (porsager), requêtes SQL paramétrées, `prepare: false` pour le pooler de Neon.
- **Migrations** : fichiers `db/migrations/NNN_nom.sql`, appliqués dans l'ordre par `npm run db:migrate`. Chacun n'est appliqué qu'une fois (table `schema_migrations`), dans une transaction.
- Tout accès aux données passe par `src/server/salon/service.ts`, qui filtre **chaque** requête par le salon de l'utilisatrice connectée.

## Conséquences

- Les types TypeScript des lignes sont écrits à la main : les tests d'intégration sur un vrai PostgreSQL (`service.int.test.ts`) vérifient qu'ils correspondent.
- On ne modifie jamais une migration déjà appliquée en production : on en ajoute une nouvelle.

## À revoir si

Le schéma devient assez grand pour que l'écriture manuelle des types coûte plus qu'un ORM.
