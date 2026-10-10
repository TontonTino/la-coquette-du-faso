# 01 — Analyse métier : La Coquette du Faso

| | |
|---|---|
| Statut | Brouillon, à valider par l'équipe |
| Source | Entretien avec la gérante, 10 octobre 2026 |
| Phase | 1 — Découverte métier |

> Légende : **[Fait]** = dit par la gérante · **[Interprétation]** = notre lecture, à confirmer · **[Question]** = encore inconnu.

---

## 1. Le constat principal

Le salon ne fonctionne pas comme un agenda strict. Il fonctionne comme une **file d'attente**, alimentée par deux sources :

- des rendez-vous demandés **par WhatsApp** et notés **dans un cahier** par une secrétaire ;
- des clientes qui arrivent **sans rendez-vous**.

Quand deux clientes arrivent en même temps, la première arrivée passe et l'autre patiente. **[Fait]**

**[Interprétation]** Le problème n'est donc pas surtout la « double réservation d'une coiffeuse ». C'est l'absence de vue d'ensemble : qui est libre, qui attend, et combien de temps ça va prendre.

---

## 2. Les faits recueillis

| Sujet | Ce que dit la gérante |
|---|---|
| Prise de rendez-vous | Par WhatsApp |
| Qui note | Une secrétaire, dans un cahier (rarement sur téléphone) |
| Prestations | Pas de noms fixes : les clientes choisissent sur photo |
| Durées | De 2 h à 10 h |
| Prix | De 3 000 à 50 000 FCFA |
| Équipe | Environ 20 coiffeuses, **chacune a ses spécialités** (corrigé le 10/10 : « chacune fait tout » était une erreur de transcription) |
| Travail simultané | 1 cliente à la fois par coiffeuse ; 2 coiffeuses peuvent travailler sur 1 cliente |
| Arrivées simultanées | Régulières ; la première arrivée passe |
| Annulation | Rendez-vous reconduit librement |
| Retard | Une autre cliente passe avant |
| Acompte | Aucun |
| Smartphones des coiffeuses | Oui, et elles acceptent de consulter leur planning |
| Congés | 1 à 2 jours par semaine, plus des congés imprévus (force majeure) |
| Volume | 10 à 60 prestations par jour, pas toujours sur rendez-vous |
| Pics | Week-ends et jours de fête |
| Bilan souhaité chaque soir | Chiffre d'affaires, absences, coiffeuse la plus demandée |
| Paiement | Très souvent par mobile money ; intérêt pour le paiement en ligne |
| Communication | Rappels par WhatsApp ; tendances suivies via statuts WhatsApp et Facebook |

---

## 3. Hypothèses : vérifiées ou non

| Hypothèse de départ | Résultat | Conséquence |
|---|---|---|
| Les clientes réservent par téléphone ou WhatsApp | ✅ Confirmée (WhatsApp) | MIA doit s'appuyer sur WhatsApp, pas le remplacer |
| Il y a des doubles réservations | ⚠️ Nuancée | Le vrai problème : arrivées simultanées et attente |
| Les durées sont stables | ❌ Infirmée (2 h à 10 h) | Une durée fixe par prestation ne marche pas |
| Les prix sont fixes | ❌ Infirmée (3 000 à 50 000 FCFA) | Afficher des fourchettes, pas un prix unique |
| La gérante est l'utilisatrice principale | ❌ Infirmée | C'est **la secrétaire** qui tient le cahier |
| Les clientes veulent une coiffeuse précise | ❓ Non vérifiée | À demander aux clientes |
| Chaque coiffeuse fait toutes les coiffures | ❌ Infirmée (correction du 10/10) | Il faut gérer les **compétences** de chaque coiffeuse (BR-009) |
| Les coiffeuses peuvent utiliser un outil | ✅ Confirmée | Un espace coiffeuse est envisageable |

---

## 4. Ce que ça change pour la démo

| Dans la démo | Dans la réalité | À faire |
|---|---|---|
| 3 prestations nommées, durée et prix fixes | Choix sur photo, durée 2–10 h, prix 3 000–50 000 FCFA | Catalogue de **modèles photo** avec fourchettes de durée et de prix |
| 1 coiffeuse par rendez-vous | 1 ou 2 coiffeuses par cliente | Un rendez-vous peut avoir **plusieurs coiffeuses** |
| 3 rôles : cliente, coiffeuse, gérante | La secrétaire est au centre | Ajouter le rôle **secrétaire** |
| Uniquement sur rendez-vous | Beaucoup de clientes sans rendez-vous | Gérer aussi les **arrivées sans rendez-vous** |
| Jours de travail fixes | Congés hebdomadaires et imprévus | Gestion des **congés et absences** |
| — | Chaque coiffeuse a ses spécialités | Types de coiffure + compétences par coiffeuse |
| Pas de bilan | Bilan du soir souhaité | Bilan quotidien simple |

**Ce qui reste valable :** organiser les règles dans un fichier séparé de l'interface (`booking.ts`), le fuseau horaire de Ouagadougou, le format FCFA et le format des numéros +226.

---

## 5. Problème prioritaire (proposition à valider)

> **[Interprétation]** La secrétaire gère à la main, dans un cahier, les demandes WhatsApp et les clientes sans rendez-vous. Elle n'a pas de vue d'ensemble sur qui est libre. Résultat : des clientes qui patientent sans savoir combien de temps, et aucun chiffre fiable pour la gérante.

**Réponse de la gérante (question 8) :** pas de réponse exacte. Selon l'enquêteur, son problème principal est **l'organisation** : elle veut d'abord être mieux organisée et mieux satisfaire les clientes. **[Interprétation de l'enquêteur]**

**Contrainte exprimée :** une forte période de demande arrive dans environ un mois. Les clientes doivent avoir le temps de s'habituer à l'outil avant ce pic. **[Fait]**

**Décision de l'équipe (10/10/2026) :** commencer par l'outil de la secrétaire (A), puis ouvrir très vite la réservation en ligne par les clientes (B). Voir `00-product-vision.md`.

---

## 6. Questions pour la prochaine visite

1. Quelle est la date exacte du début de la période forte ?
2. La secrétaire a-t-elle un smartphone ou un ordinateur au salon ?
3. Qui décide quelle coiffeuse prend quelle cliente ?
4. Quand une cliente envoie une photo, comment fixez-vous le prix et la durée ?
5. Sur une journée, quelle part de clientes vient avec rendez-vous et quelle part sans ?
6. Comment calculez-vous le chiffre d'affaires aujourd'hui ?
7. Une cliente peut-elle demander une coiffeuse précise ? Est-ce que ça vous convient ?

Si possible, parler aussi **à la secrétaire** et à **deux ou trois clientes**.
