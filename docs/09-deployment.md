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
