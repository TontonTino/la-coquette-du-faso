# 03 — Matrice de traçabilité (phase A)

Exigence → code → test → résultat. Résultats obtenus le **10/10/2026** sur PostgreSQL 16 local et Chromium (téléphone 390 px).

| Exigence | Code | Test | Résultat |
|---|---|---|---|
| FR-001, FR-002 Équipe, congés | `service.ts` ajouterCoiffeuse, modifierCoiffeuse · `equipe/` | int. « réserve le bilan et l'équipe… » · e2e « Écran Équipe » | ✅ |
| FR-003 Absence imprévue | `basculerAbsence` · `coiffeuses/` · `vue.ts` aReattribuer | int. « refuse une coiffeuse en congé ou absente… » · unit. « signale un rendez-vous… » · e2e « Absence imprévue » | ✅ |
| FR-004 Planning du jour | `vue.ts` construireJournee · `coiffeuses/` | unit. « donne l'état de chaque coiffeuse » · e2e (pas de défilement horizontal à 390 px) | ✅ |
| FR-005 Changer de jour | Rendez-vous à une autre date (`FormRendezVous`) · bilan par jour | — | ⚠️ Pas de vue planning par date : à faire |
| FR-006 Créer un rendez-vous | `creerRendezVous` · `FormRendezVous` | int. « enregistre un rendez-vous… » · e2e « Rendez-vous Tresses » | ✅ |
| FR-007 / BR-001 Pas de chevauchement | Contrainte `pas_de_chevauchement` (migration 001) | int. « deux enregistrements simultanés » (5 en parallèle → 1 seul) · e2e « La coiffeuse prise n'est plus proposée » | ✅ |
| FR-008 Sans rendez-vous | `ajouterSansRendezVous` | int. « parcours sans rendez-vous » · e2e | ✅ |
| FR-009 Arrivée | `marquerArrivee` | unit. transitions | ✅ (pas encore de test e2e dédié) |
| FR-010 Démarrer | `demarrer` | int. parcours · e2e | ✅ |
| FR-011 Terminer, encaisser | `terminer` | int. parcours (coiffeuses libérées immédiatement) · e2e | ✅ |
| FR-012 Annuler, déplacer, absente | `annuler`, `modifierRendezVous`, `marquerAbsente` | int. « annulation… », « réattribue… » · e2e « Réattribution » | ✅ |
| FR-013 Bilan du soir | `vue.ts` construireBilan · `bilan/` | unit. bilan · int. parcours · e2e « Bilan du soir » | ✅ |
| FR-014 Planning coiffeuse | — | — | ⏳ Phase suivante (comptes coiffeuses) |
| FR-015, FR-016 / BR-009 Compétences | migration 002 · `verifierCoiffeuses`, `coiffeusesLibres` | int. « ne propose et n'accepte que les coiffeuses compétentes » · e2e « Tresses » | ✅ |
| BR-002 2 coiffeuses max | `verifierChoixCoiffeuses` | unit. | ✅ |
| BR-003 Congé / absence | `verifierCoiffeuses` | int. | ✅ |
| BR-005 Durées | `verifierDuree` + contrainte SQL | unit. | ✅ |
| SEC-001 Connexion obligatoire | `auth.ts`, `proxy.ts` | e2e « Sans session… », « Mauvais mot de passe » | ✅ |
| SEC-002 Rôles et isolation des salons | `autoriser`, filtres `salon_id`, clés composées | int. « isole les salons » · e2e « La secrétaire ne peut pas ouvrir le bilan » | ✅ |
| SEC-004 Pas de secret dans le code | `.env*` ignorés par Git, mots de passe en variables | revue | ✅ revue faite |
| DATA-001 Sauvegardes | — | — | ⏳ À configurer avec l'hébergement |
| NFR-001 Mobile 360–390 px | Écrans `src/app/salon` | e2e (390 px) | ✅ à 390 px ; 360 px non testé |
| NFR-002 3G lente | — | — | ⏳ Non mesuré |
| NFR-004 Pas de perte de saisie | Formulaires : l'erreur s'affiche, la saisie reste | — | ⚠️ Non testé automatiquement |
