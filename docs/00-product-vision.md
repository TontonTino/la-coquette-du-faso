# 00 — Vision produit : MIA × La Coquette du Faso

| | |
|---|---|
| Statut | Brouillon, à valider par l'équipe puis la gérante |
| Date | 10 octobre 2026 |
| S'appuie sur | `01-business-analysis.md` |

---

## 1. En une phrase

**MIA remplace le cahier du salon par un planning partagé, pour que la secrétaire sache à tout moment qui est libre, que les clientes attendent moins, et que la gérante ait ses chiffres chaque soir.**

---

## 2. Le problème

Aujourd'hui, la secrétaire reçoit les demandes par WhatsApp et les note dans un cahier. À ces demandes s'ajoutent les clientes sans rendez-vous. Personne n'a de vue d'ensemble sur les 20 coiffeuses, leurs congés et leurs prestations en cours. Résultat : des clientes qui patientent, et une gérante sans chiffres fiables.

Une forte période de demande commence dans environ un mois.

---

## 3. Pour qui

| Utilisatrice | Ce qu'elle gagne | Phase |
|---|---|---|
| **Secrétaire** (utilisatrice principale) | Un planning clair à la place du cahier | A |
| **Gérante** | Le bilan du soir : chiffre d'affaires, absences, coiffeuse la plus demandée | A |
| **Coiffeuses** | Leur planning du jour sur leur téléphone | A |
| **Clientes** | Demander un rendez-vous en ligne, à partir des photos de modèles | B |

---

## 4. Le MVP en deux temps

```
   PHASE A — L'outil de la secrétaire          PHASE B — Les clientes en ligne
   ────────────────────────────────            ──────────────────────────────
   Planning des 20 coiffeuses + congés   ──►   Page du salon : modèles en photo
   Saisie des rendez-vous WhatsApp             Demande de rendez-vous en ligne
   File des clientes sans rendez-vous          La secrétaire valide la demande
   Planning coiffeuse (lecture)                Confirmation par WhatsApp
   Bilan du soir pour la gérante
```

**Pourquoi A avant B ?** La réservation en ligne a besoin d'un planning fiable pour fonctionner. Une cliente ne peut pas voir des créneaux libres si le planning est encore dans un cahier.

**Pourquoi une « demande » plutôt qu'une réservation instantanée en B ?** Les durées vont de 2 h à 10 h et les prix de 3 000 à 50 000 FCFA selon le modèle. Seul le salon peut estimer la durée exacte et le prix. La secrétaire valide donc chaque demande. C'est aussi plus simple et plus sûr à construire en peu de temps.

---

## 5. Périmètre (MoSCoW)

### Must have — indispensable avant la période forte

- Fiche de chaque coiffeuse : ses spécialités (types de coiffure), ses jours de congé et ses absences imprévues
- Planning du jour et de la semaine, coiffeuse par coiffeuse
- Saisie rapide d'un rendez-vous : cliente, téléphone, modèle, durée estimée, une ou deux coiffeuses
- Contrôle côté serveur : impossible de mettre une coiffeuse sur deux clientes en même temps
- Liste des clientes sans rendez-vous du jour, dans l'ordre d'arrivée
- Suivi de chaque prestation, de l'arrivée à la fin (cycle de vie détaillé dans `02-requirements.md`)
- Connexion sécurisée pour la secrétaire et la gérante
- Données enregistrées sur un serveur et partagées entre les appareils

### Should have — très vite après (phase B)

- Bilan du soir : chiffre d'affaires du jour, absences, coiffeuse la plus demandée
- Planning de chaque coiffeuse sur son téléphone (lecture seule)
- Page publique du salon avec les modèles en photo et une fourchette de prix
- Formulaire de demande de rendez-vous, validé par la secrétaire
- Bouton « Envoyer la confirmation sur WhatsApp » (message pré-rempli, sans coût)

### Could have — si le temps le permet

- Choix d'une coiffeuse précise par la cliente
- Temps d'attente estimé pour les clientes sans rendez-vous
- Historique d'une cliente

### Won't have for now — après le pilote

- Paiement mobile money et acompte
- Envoi automatique de messages WhatsApp ou SMS (coût et démarches à étudier)
- Réservation instantanée sans validation du salon
- Plusieurs salons sur la même plateforme

---

## 6. Plan sur 4 semaines

| Semaine | Dates | Objectif | Résultat attendu |
|---|---|---|---|
| 1 | 12–18 oct. | Exigences, maquettes, architecture, base de données | Écrans validés **avec la secrétaire** |
| 2 | 19–25 oct. | Outil secrétaire : planning, congés, rendez-vous, file d'attente | Version testable au salon |
| 3 | 26 oct.–1er nov. | Bilan du soir, planning coiffeuse, tests | **Début du pilote**, en parallèle du cahier |
| 4 | 2–8 nov. | Phase B : page du salon et demandes en ligne | Lien partagé sur les statuts WhatsApp et Facebook |
| Période forte | à partir du 9 nov. (environ) | Gel des nouveautés | Corrections uniquement |

**Règle pendant la période forte :** on n'ajoute rien, on corrige seulement. Un outil qui tombe en panne en plein pic ferait perdre la confiance du salon.

---

## 7. Comment on saura que ça marche

| Indicateur | Mesure | Objectif à fin novembre |
|---|---|---|
| Adoption | Le cahier est-il encore utilisé ? | Cahier abandonné |
| Couverture | Part des rendez-vous saisis dans MIA | Presque tous |
| Bilan | La gérante consulte-t-elle le bilan du soir ? | Tous les soirs |
| Phase B | Demandes en ligne reçues par semaine | Au moins quelques-unes |

Les valeurs chiffrées seront fixées avec la gérante.

---

## 8. Principaux risques

| Risque | Parade |
|---|---|
| La secrétaire revient au cahier | La consulter dès la semaine 1 ; saisie en moins de 30 secondes ; cahier en parallèle la première semaine |
| Délai trop court | Périmètre strict (Must d'abord) ; ce qui n'est pas prêt passe après le pic |
| Pas d'appareil adapté au salon | À vérifier tout de suite (téléphone, tablette ou ordinateur ?) |
| Panne pendant le pic | Gel des nouveautés, sauvegardes, cahier gardé comme solution de secours |
| Données des clientes exposées | Connexion obligatoire ; seul le personnel voit les numéros |

---

## 9. Décisions encore ouvertes

| Décision | Qui | Quand |
|---|---|---|
| Architecture technique et hébergement (ADR-001) | Équipe | Semaine 1 |
| Appareil utilisé par la secrétaire | Gérante | Avant la semaine 1 |
| Qui paie l'hébergement pendant le pilote | Équipe et gérante | Semaine 1 |
| Photos des modèles pour la page publique | Salon | Avant la semaine 4 |
