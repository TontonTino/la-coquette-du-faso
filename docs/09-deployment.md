# 09 — Mise en ligne

| | |
|---|---|
| Hébergement | Vercel (projet relié à `TontonTino/la-coquette-du-faso`, branche `master`), fonctions à Francfort (`vercel.json`) |
| Base | Neon PostgreSQL, AWS Europe (Francfort) |

## Procédure, à chaque nouvelle version

1. **Pousser** sur `master` : `git push origin master`.
2. Vercel lance `npm run vercel-build`, qui **applique d'abord les migrations** (`db/migrations/`) sur la base de
   `DATABASE_URL`, puis construit le site. Si une migration échoue, le build échoue et **l'ancienne version reste en
   ligne** : le site n'est jamais servi avec une base en retard sur le code.
3. **Vérifier** dans Vercel → Deployments que la ligne du haut porte le **dernier commit** et le statut « Ready ».
   « Error » : ouvrir Build Logs ; une ligne `Échec de la migration` indique le problème.

Appliquer une migration à la main reste possible (`npm run db:migrate` avec l'adresse Neon), mais n'est plus nécessaire.

### Incident du 10/10/2026 (à ne pas reproduire)

Le code du catalogue a été poussé alors que `npm run db:migrate` avait reçu le texte d'exemple au lieu de l'adresse
Neon : la table `modele` n'existait pas et le site affichait « This page couldn't load ». Corrections : migrations
automatiques au build (ci-dessus) et message clair quand l'adresse n'est pas une adresse PostgreSQL.

## Piège connu : commits non déployés

Vercel (plan Hobby) ignore les commits dont l'**auteur** n'est pas le propriétaire du compte.
Symptôme : `git push` réussit, mais aucune nouvelle ligne n'apparaît dans Deployments.

- Prévention : tous les commits sont signés `TontonTino <nitiemalionel@gmail.com>` (voir `CLAUDE.md`).
- Rattrapage : `git commit --allow-empty -m "chore: mise en ligne"` puis `git push origin master`.
- « Redeploy » dans Vercel **ne prend pas** le nouveau code : il recopie un déploiement existant.

## Variables d'environnement (Vercel → Settings → Environment Variables)

| Nom | Valeur |
|---|---|
| `DATABASE_URL` | Adresse Neon **avec** `-pooler` (une modification ne s'applique qu'au déploiement suivant) |
| `SALON_SLUG` | Facultatif, `la-coquette-du-faso` par défaut |
| `BLOB_READ_WRITE_TOKEN` | Facultatif. Créé automatiquement quand on ajoute un **Blob store public** (Vercel → Storage → Create → Blob → Public, puis le relier au projet). Sans lui, la gérante colle un lien https pour ses vidéos au lieu de les envoyer depuis le téléphone. |

## Vidéos courtes, avis et photos de l'équipe

- Vidéos : 15 à 30 s, format vertical, MP4 (H.264) de préférence, 40 Mo maximum par fichier. Le fichier n'est chargé que lorsque la vidéo doit se lancer (économie de données mobiles).
- Plan Hobby de Vercel : 1 Go de stockage Blob et 10 Go de transfert par mois ; au-delà, passer en Pro.
- Photos de l'équipe : stockées dans la base (800 Ko maximum), demander l'accord des coiffeuses.
- Avis : une note de 1 à 5 par coiffeuse réellement intervenue ; la moyenne n'est affichée aux clientes qu'à partir de 3 avis ; les commentaires ne sont vus que par la gérante.
- Heures d'ouverture : colonne `salon.horaires` (texte) et constantes `OUVERTURE_MIN` / `MOMENTS` / `HEURES_SALON` dans `src/lib/salon/regles.ts`.
