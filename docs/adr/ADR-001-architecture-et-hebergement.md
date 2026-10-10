# ADR-001 — Architecture et hébergement du MVP

| | |
|---|---|
| Statut | **Accepted** — 10/10/2026 (hébergement payé par le salon, inclus dans les frais) |
| Date | 10 octobre 2026 |
| Exigences concernées | FR-007, BR-008, SEC-001 à SEC-004, DATA-001, NFR-002 |

## Contexte

- La démo actuelle (Next.js 16, TypeScript, Tailwind) n'a ni serveur de données, ni base, ni connexion. Tout est dans le navigateur.
- Le MVP doit être utilisé au salon **dans 3 semaines**, puis supporter la période forte.
- L'équipe est petite, étudiante, et doit livrer vite.
- Le trafic sera faible : une secrétaire, une gérante, 20 coiffeuses, quelques dizaines de prestations par jour.

## Problème

Où faire tourner l'application et où stocker les données, pour livrer en 3 semaines un outil fiable, sécurisé et peu coûteux ?

## Options examinées

| | A. Monolithe Next.js + base PostgreSQL gérée | B. Frontend + API séparée | C. Petit serveur privé (VPS) |
|---|---|---|---|
| Principe | Le même projet Next.js contient l'interface et le code serveur ; la base est louée chez un hébergeur spécialisé | Next.js pour l'écran, une API à part (Express ou FastAPI) | Tout installé soi-même sur une machine louée |
| Réutilise la démo | Oui, presque tout | En partie | Oui |
| Vitesse de livraison | **La plus rapide** | Plus lente (deux projets, deux déploiements) | Lente (installation, sécurité, sauvegardes à faire soi-même) |
| Exploitation | Faible : l'hébergeur gère serveurs et mises à jour | Moyenne | **Lourde** : mises à jour de sécurité, sauvegardes, surveillance |
| Coût | ~20–25 $/mois en production (détail plus bas) | Similaire ou plus | Faible, mais du temps humain en plus |
| Passage au multi-salons | Possible sans réécriture | Possible | Possible |

## Décision proposée

**Option A : monolithe modulaire Next.js + PostgreSQL géré.**

```
 Téléphone (secrétaire, gérante, coiffeuses)
        │  HTTPS
        ▼
 ┌──────────────────────────────────────────────┐
 │  Application Next.js (Vercel, région Europe)  │
 │   • Écrans (React)                            │
 │   • Actions serveur : règles métier,          │
 │     contrôle des rôles, validation            │
 └───────────────────┬──────────────────────────┘
                     │
                     ▼
 ┌──────────────────────────────────────────────┐
 │  PostgreSQL (Neon, même région)               │
 │   • Contrainte anti-chevauchement (BR-001)    │
 │   • Sauvegardes                               │
 └──────────────────────────────────────────────┘
```

- **Hébergement de l'application : Vercel**, l'hébergeur de référence pour Next.js : le déploiement se fait directement depuis GitHub.
- **Base de données : PostgreSQL chez Neon**, avec un démarrage gratuit, puis un paiement à l'usage.
- **Monolithe « modulaire »** : un seul projet, mais organisé en modules séparés (équipe, prestations, bilan, authentification). Les règles métier restent dans des fichiers indépendants de l'écran, comme `booking.ts` aujourd'hui.

### Comment la base empêche les chevauchements (BR-001, FR-007)

Vérifier « cette coiffeuse est-elle libre ? » dans le code ne suffit pas : deux téléphones peuvent poser la question au même moment, recevoir tous les deux « oui », et enregistrer tous les deux. PostgreSQL sait refuser ce cas lui-même, grâce à une **contrainte d'exclusion** :

```sql
-- Une ligne par couple (prestation, coiffeuse), avec la plage horaire occupée.
CREATE EXTENSION IF NOT EXISTS btree_gist;

ALTER TABLE affectation
  ADD CONSTRAINT pas_de_chevauchement
  EXCLUDE USING gist (coiffeuse_id WITH =, plage WITH &&)
  WHERE (active);
```

Traduction : « deux affectations actives de la même coiffeuse ne peuvent pas avoir des plages horaires qui se recouvrent ». Si deux enregistrements arrivent en même temps, la base en accepte un et refuse l'autre. Ce refus se transforme en message clair pour la secrétaire. C'est la garantie la plus solide, et elle ne coûte que quelques lignes.

**Testé localement (PostgreSQL 16, 10/10/2026) :** un chevauchement est refusé ; deux prestations bout à bout (11:00–13:00 puis 13:00–15:00) sont acceptées ; deux coiffeuses différentes au même horaire sont acceptées ; une affectation annulée libère la plage. Avec deux transactions simultanées sur la même coiffeuse, la seconde attend la première puis est refusée : il ne reste qu'une seule ligne.

## Conséquences

**Ce qu'on gagne :** on garde le code et les tests existants, il n'y a qu'un seul projet à déployer, et l'hébergeur s'occupe de l'exploitation.

**Ce qu'on accepte :**

1. **Un coût mensuel dès que l'outil est utilisé au salon.** Le plan gratuit de Vercel (Hobby) est réservé à un usage personnel et non commercial ; tout usage commercial demande le plan Pro ([règles de Vercel](https://vercel.com/docs/limits/fair-use-guidelines)). Un outil de gestion pour un salon est un usage commercial.
2. **Les sauvegardes du plan gratuit de Neon sont trop limitées** : historique de 6 h, pas de sauvegarde programmée ([tarifs Neon](https://neon.com/pricing)). Pour DATA-001, on ajoutera une copie quotidienne automatique (`pg_dump` programmé), ou on passera au plan payant.
3. **Dépendance à deux fournisseurs.** Elle reste limitée : PostgreSQL est un standard et Next.js peut tourner ailleurs. On pourra migrer sans réécrire.

### Coût estimé (vérifié le 10/10/2026)

| Élément | Développement (semaines 1–2) | Pilote et production (dès la semaine 3) |
|---|---|---|
| Vercel | Poste local, rien à payer | Pro : 20 $/mois, avec 20 $ d'usage inclus ([tarifs](https://vercel.com/pricing)) |
| Neon PostgreSQL | Free : 0 $ | Launch, à l'usage : 0,106 $ par heure de calcul, 0,35 $ par Go-mois ; la base se met en veille quand personne ne l'utilise |
| **Total** | **0 $** | **environ 20 à 25 $/mois**, soit environ 12 000 à 15 000 FCFA selon le taux de change |

Alternative écartée : Supabase. Son plan gratuit met le projet en pause après une semaine d'inactivité et n'inclut aucune sauvegarde automatique ; le plan Pro coûte 25 $/mois ([tarifs Supabase](https://supabase.com/pricing)).

## Ce qui reste à décider (ADR suivants, semaine 1)

- ADR-002 : bibliothèque d'accès à la base (ORM) et migrations.
- ADR-003 : méthode de connexion (secrétaire, gérante, puis coiffeuses).

## Conditions pour revoir cette décision

- Le coût mensuel est refusé par l'équipe ou le salon → option C (VPS), en acceptant plus d'exploitation.
- Plusieurs salons, avec beaucoup plus de trafic → réévaluer l'hébergement et l'isolation des données.
- Besoin d'une application mobile native → réévaluer la séparation du frontend et d'une API (option B).
