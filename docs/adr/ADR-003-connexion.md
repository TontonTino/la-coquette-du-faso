# ADR-003 — Connexion et sessions

| | |
|---|---|
| Statut | **Accepted** — 10/10/2026 |
| Exigences | SEC-001, SEC-002, SEC-004 |

## Problème

La secrétaire et la gérante doivent se connecter (SEC-001), avec des droits différents (SEC-002). Deux comptes au départ, des comptes coiffeuses plus tard.

## Options examinées

| | Bibliothèque complète (Auth.js…) | Cookie chiffré (iron-session) | **Sessions en base, code minimal** |
|---|---|---|---|
| Déconnexion à distance (téléphone perdu) | Selon configuration | Impossible avant expiration | **Oui** : on supprime la session |
| Dépendances | Nombreuses | Une | Aucune (crypto de Node) |
| Code à maintenir | Configuration importante | Faible | ~100 lignes, testées |

## Décision

- Identifiant + mot de passe, haché avec **scrypt** (sel aléatoire, comparaison à temps constant).
- À la connexion : jeton aléatoire de 32 octets dans un cookie **httpOnly, SameSite=Lax, Secure en production**, valable 30 jours. La base ne garde que son **empreinte SHA-256**.
- **Chaque page et chaque action serveur** relit la session et vérifie le rôle (`exigerPage`, `exigerAction`). Le fichier `proxy.ts` ne fait qu'une redirection de confort.
- Les comptes sont créés par `npm run db:seed`, avec les mots de passe passés en variables d'environnement, jamais écrits dans le code.

## Conséquences et limites connues

- Pas encore de limitation du nombre d'essais de connexion par adresse IP : seulement un délai de 400 ms après chaque échec. **À ajouter avant d'ouvrir une page publique** (phase B).
- Pas encore d'écran « changer mon mot de passe » : la gérante passe par l'équipe technique.
