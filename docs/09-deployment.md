# 09 — Mise en ligne

| | |
|---|---|
| Hébergement | Vercel (projet relié à `TontonTino/la-coquette-du-faso`, branche `master`), fonctions à Francfort (`vercel.json`) |
| Base | Neon PostgreSQL, AWS Europe (Francfort) |

## Procédure, à chaque nouvelle version

1. **Migrations d'abord** (si `db/migrations/` a changé), avec l'adresse Neon **sans** `-pooler` :
   ```powershell
   $env:DATABASE_URL = "<adresse Neon sans pooled>"
   npm run db:migrate
   ```
2. **Pousser** sur `master` : `git push origin master`. Vercel déploie automatiquement (environ 1 min).
3. **Vérifier** dans Vercel → Deployments que la ligne du haut porte le **dernier commit** et le statut « Ready ».

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
