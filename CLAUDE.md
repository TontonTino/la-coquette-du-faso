# Consignes pour les agents (Claude Code)

## Commits : auteur obligatoire

Le projet est déployé par Vercel (plan Hobby), qui **ne déploie automatiquement que les commits dont
l'auteur est le propriétaire du compte**. Un commit signé par un autre auteur (par exemple
« Claude <noreply@anthropic.com> ») est poussé sur GitHub mais **n'est jamais mis en ligne**.

- Auteur de tout commit : `TontonTino <nitiemalionel@gmail.com>` (configuré dans `.git/config` du dépôt local).
- La contribution d'un agent est indiquée par la ligne `Co-Authored-By:` à la fin du message, jamais par l'auteur.
- Avant de pousser : `git log -1 --format='%an <%ae>'` doit afficher l'auteur ci-dessus.

## Base de données

- Toute évolution du schéma passe par un nouveau fichier `db/migrations/NNN_nom.sql` (jamais modifier une migration déjà appliquée).
- Les migrations sont appliquées automatiquement par `npm run vercel-build` avant chaque build Vercel ; une migration doit donc réussir sur une base déjà en service (pas de destruction de données, valeurs par défaut pour les colonnes NOT NULL).
