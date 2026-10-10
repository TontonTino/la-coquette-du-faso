# La Coquette du Faso — MIA

Ce dépôt contient deux parties :

1. **L'espace salon (`/salon`)** — l'outil réel de la secrétaire et de la gérante : file d'attente, rendez-vous, coiffeuses et leurs spécialités, bilan du soir. Données dans PostgreSQL, connexion obligatoire. Voir « Espace salon » ci-dessous et `docs/`.
2. **La démo de réservation (`/`)** — prototype sur données fictives (localStorage), conservé comme référence pour la phase B (réservation en ligne par les clientes).

## Espace salon

### Mise en place (PowerShell)

Prérequis : Node.js 24, une base PostgreSQL 16 (locale, ou Neon).

```powershell
npm install
Copy-Item .env.example .env.local   # puis renseigner DATABASE_URL
$env:DATABASE_URL = "postgres://..."              # la même valeur que dans .env.local
npm run db:migrate                                 # crée les tables (rejouable sans risque)
$env:MOT_DE_PASSE_GERANTE = "au-moins-10-caracteres"
$env:MOT_DE_PASSE_SECRETAIRE = "au-moins-10-caracteres"
npm run db:seed                                    # salon + comptes « gerante » et « secretaire »
# npm run db:seed -- --demo                        # en développement : + 6 types de coiffure et 20 coiffeuses fictives
npm run dev                                        # http://localhost:3000/salon
```

Ensuite, la gérante se connecte, crée les **types de coiffure** et les **coiffeuses** (onglet Équipe), avec leurs spécialités et jours de congé.

### Tests de l'espace salon

```powershell
npm test                                           # unitaires (les tests d'intégration sont ignorés sans base de test)
$env:DATABASE_URL_TEST = "postgres://.../mia_test" # base EFFACÉE à chaque lancement
npm test                                           # + tests d'intégration sur PostgreSQL (concurrence, isolation des salons…)
# parcours complet dans un navigateur, sur une base initialisée avec --demo et l'application lancée sur le port 3200 :
$env:BASE_URL = "http://localhost:3200"; $env:MDP_SECRETAIRE = "..."; $env:MDP_GERANTE = "..."
npm run test:e2e:salon
```

### Organisation

| Dossier | Contenu |
| --- | --- |
| `db/migrations/` | Schéma SQL (contrainte anti-chevauchement, clés composées par salon) |
| `src/lib/salon/` | Règles métier pures et construction des vues (testées sans base) |
| `src/server/` | Accès base, connexion, service métier (seule porte vers les données) |
| `src/app/salon/` | Écrans et actions serveur de l'espace salon |
| `docs/` | Vision, analyse, exigences, ADR, traçabilité |

---

# Démo de réservation (prototype)

Application web de démonstration (mobile et ordinateur) pour le salon de beauté **La Coquette du Faso**, à Ouagadougou. Elle comporte trois espaces : **Cliente**, **Coiffeuse** et **Gérante**.

> Toutes les données (coiffeuses, clientes, horaires, rendez-vous) sont **fictives**. Elles sont enregistrées dans le `localStorage` du navigateur : elles ne sont **pas partagées entre appareils**.

## Lancer le projet

Prérequis : Node.js 20.9 ou plus récent (testé avec Node 24).

```bash
npm install
npm run dev          # développement : http://localhost:3000
# ou, en conditions réelles :
npm run build
npm start            # production : http://localhost:3000
```

Pour la présenter sur un téléphone du même réseau Wi-Fi : `npm start -- -H 0.0.0.0`, puis ouvrez `http://<adresse-IP-du-PC>:3000` sur le téléphone.

## Vérifications

```bash
npm run typecheck    # TypeScript
npm run lint         # ESLint
npm test             # tests unitaires et d'intégration (Vitest + Testing Library)
npm run test:e2e     # parcours complet dans un vrai navigateur (voir ci-dessous)
```

`test:e2e` pilote Microsoft Edge installé sur le poste (`BROWSER=chrome` pour Chrome) sur une application déjà lancée :
`npm run build && npm start -- -p 3100`, puis `npm run test:e2e` dans un autre terminal (variable `BASE_URL` pour une autre adresse).
Les captures d'écran sont enregistrées dans `e2e/captures/`.

## Scénario de démonstration

Sur l'accueil, **« Lancer le scénario »** ouvre la réservation pré-remplie :
Tresses Fulani · Aïcha K. · mercredi 23 décembre 2026 · 15 h 30 · 2 h 30 · 15 000 FCFA.

1. Réserver le créneau (espace Cliente) puis le retrouver dans « Mes rendez-vous ».
2. Relancer le scénario : le créneau étant pris, l'application propose Salimata B. à la même heure, d'autres horaires et les prochains jours libres.
3. Espace Coiffeuse → Aïcha K. → date du 23/12/2026 : confirmer le rendez-vous, bloquer/débloquer un créneau.
4. Espace Gérante : tableau de bord, rendez-vous par coiffeuse, disponibilités, tarifs, équipe.

« Réinitialiser la démo » (pied de page) régénère les données fictives autour de la date du jour.

## Organisation du code

| Dossier | Contenu |
| --- | --- |
| `src/lib/catalog.ts` | Prestations, coiffeuses, horaires de démo, scénario |
| `src/lib/booking.ts` | Règles métier pures : disponibilités, anti-double réservation, alternatives, statuts, blocages |
| `src/lib/time.ts` | Fuseau Africa/Ouagadougou, formats français (dates, heures, FCFA) |
| `src/lib/seed.ts` | Jeu de données fictives |
| `src/store/` | Store localStorage (synchronisé entre onglets) et horloge |
| `src/components/` | Interface : boutons, fiches, assistant de réservation, planning… |
| `src/app/` | Pages : `/`, `/prestations`, `/equipe`, `/reserver`, `/mes-rendez-vous`, `/espace-coiffeuse`, `/espace-gerante/*` |

Le logo (`public/brand/logo.png`) provient du dossier `COQUETTE FILM` ; le remplacer par le fichier officiel suffit à mettre à jour toute l'application.

## Règles de réservation (démo)

- Salon ouvert du lundi au samedi, de 8 h à 19 h ; créneaux toutes les 30 minutes.
- Une prestation doit se terminer avant la fermeture ; les créneaux passés (heure de Ouagadougou) ne sont pas proposés.
- Un créneau est refusé s'il chevauche un rendez-vous actif ou un créneau bloqué de la même coiffeuse. La vérification est refaite au moment de la confirmation.
- Une nouvelle réservation est « En attente » jusqu'à confirmation par la coiffeuse ou la gérante. Une annulation libère le créneau.

## Limites connues

- Pas de base de données : chaque navigateur a ses propres données ; une réservation faite sur un téléphone n'apparaît pas sur un autre appareil.
- Pas d'authentification : les espaces Coiffeuse et Gérante sont librement accessibles.
- Pas de paiement, de SMS ni de WhatsApp : les confirmations sont uniquement affichées à l'écran.
- Catalogue (prestations, tarifs, horaires, jours de travail) non modifiable depuis l'interface.
- Les rendez-vous fixes du scénario sont datés du 23/12/2026 : après cette date, le scénario n'est plus réservable.
