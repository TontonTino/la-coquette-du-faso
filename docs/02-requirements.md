# 02 — Exigences du MVP (phase A : l'outil de la secrétaire)

| | |
|---|---|
| Statut | Brouillon — à valider avec la secrétaire (maquette) |
| Date | 10 octobre 2026 |
| S'appuie sur | `00-product-vision.md`, `01-business-analysis.md` |

> Priorités : **M** = Must (avant le pic) · **S** = Should (juste après) · **C** = Could.
> Vérification : **T** = test automatisé · **D** = démonstration avec la secrétaire · **R** = revue.

---

## 1. Le vocabulaire (à utiliser partout : documents, code, écrans)

| Terme | Définition |
|---|---|
| **Prestation** | Une cliente coiffée par 1 ou 2 coiffeuses. C'est l'objet central de MIA. |
| **Origine** | Comment la prestation est arrivée : *rendez-vous* (pris à l'avance, souvent par WhatsApp) ou *sans rendez-vous* (cliente arrivée au salon). |
| **Modèle** | Une coiffure présentée en photo, avec une fourchette de prix et de durée. Facultatif en phase A. |
| **Durée estimée** | Durée annoncée par la secrétaire au moment de la saisie (de 30 min à 12 h). |
| **File d'attente** | Les clientes présentes au salon qui attendent qu'une coiffeuse se libère, dans l'ordre d'arrivée. |
| **Type de coiffure** | Famille de coiffures définie par la gérante (ex. : Tresses, Nattes collées, Tissage). Les clientes choisissent sur photo ; le type sert à trouver les coiffeuses compétentes. |
| **Compétence** | Un type de coiffure qu'une coiffeuse sait faire. |
| **Congé** | Jour de repos hebdomadaire habituel d'une coiffeuse. |
| **Absence** | Jour où une coiffeuse ne vient pas, en dehors de ses congés (force majeure). |

**Pourquoi un seul objet « Prestation » ?** Un rendez-vous et une cliente sans rendez-vous finissent de la même façon : une cliente sur une chaise avec une ou deux coiffeuses. Un seul objet avec une *origine* évite de dupliquer les règles, et le bilan du soir les compte ensemble.

### Cycle de vie d'une prestation

```
 Rendez-vous :   PRÉVUE ──(la cliente arrive)──► EN ATTENTE ──► EN COURS ──► TERMINÉE
 Sans rendez-vous :                              EN ATTENTE ──► EN COURS ──► TERMINÉE

 Sorties possibles :  PRÉVUE → ANNULÉE · PRÉVUE → ABSENTE · EN ATTENTE → PARTIE (sans être coiffée)
```

---

## 2. Règles métier

| ID | Règle |
|---|---|
| BR-001 | Une coiffeuse ne peut pas être sur deux prestations dont les horaires se chevauchent. |
| BR-002 | Une prestation a 1 ou 2 coiffeuses (2 au maximum). |
| BR-003 | On ne peut pas affecter une coiffeuse en congé ou absente ce jour-là. |
| BR-004 | La file d'attente est classée par heure d'arrivée. La secrétaire peut faire passer une cliente avant une autre (par exemple quand une cliente avec rendez-vous est en retard). |
| BR-005 | La durée estimée est comprise entre 30 min et 12 h, par pas de 15 min. |
| BR-006 | Une prestation en cours occupe ses coiffeuses de l'heure de début jusqu'à la fin estimée, ou jusqu'à ce qu'elle soit marquée terminée. |
| BR-007 | Le chiffre d'affaires ne compte que les prestations **terminées**, au prix réellement payé. |
| BR-008 | Les règles BR-001 à BR-003 et BR-009 sont vérifiées **sur le serveur** à chaque enregistrement, pas seulement à l'écran. |
| BR-009 | Quand le type de coiffure est précisé, seules les coiffeuses ayant cette compétence peuvent être affectées. Sans type précisé, toute coiffeuse convient. *(Ajoutée le 10/10/2026 après correction de l'analyse.)* |

---

## 3. Exigences fonctionnelles

### Équipe et disponibilités

| ID | Exigence | Critère d'acceptation | Prio. | Vérif. |
|---|---|---|---|---|
| FR-001 | La gérante gère la liste des coiffeuses (ajouter, renommer, désactiver). | Une coiffeuse désactivée n'apparaît plus dans le planning, mais ses anciennes prestations restent dans l'historique. | M | T, D |
| FR-002 | La gérante indique les jours de congé habituels de chaque coiffeuse. | Une coiffeuse en congé le mardi apparaît « en congé » chaque mardi et ne peut pas être affectée (BR-003). | M | T |
| FR-003 | La secrétaire déclare une absence imprévue pour une date donnée. | L'écran affiche la liste des prestations déjà prévues avec cette coiffeuse ce jour-là, pour les réaffecter. | M | T, D |

| FR-015 | La gérante crée les types de coiffure du salon. | Un type en double est refusé. | M | T |
| FR-016 | La gérante indique les types de coiffure que chaque coiffeuse sait faire. | Une coiffeuse sans la compétence n'est ni proposée ni acceptée (BR-009). | M | T, D |

### Planning

| ID | Exigence | Critère d'acceptation | Prio. | Vérif. |
|---|---|---|---|---|
| FR-004 | La secrétaire voit le planning du jour : pour chaque coiffeuse, si elle est libre, occupée (jusqu'à quelle heure) ou absente. | Sur un téléphone de 360 px de large, les 20 coiffeuses sont lisibles sans défilement horizontal. | M | T, D |
| FR-005 | La secrétaire peut changer de jour (jours précédents et suivants). | Les rendez-vous d'une date future s'affichent quand on choisit cette date. | M | T |

### Prestations

| ID | Exigence | Critère d'acceptation | Prio. | Vérif. |
|---|---|---|---|---|
| FR-006 | La secrétaire enregistre un rendez-vous : nom, téléphone (+226), date, heure, durée estimée, type de coiffure (facultatif), 1 ou 2 coiffeuses, modèle facultatif. | Un rendez-vous complet se saisit en **30 secondes ou moins** (chronométré avec la secrétaire). | M | T, D |
| FR-007 | Le système refuse un rendez-vous qui viole BR-001, BR-002 ou BR-003, avec un message clair. | Deux enregistrements simultanés sur la même coiffeuse au même horaire : un seul réussit. | M | T |
| FR-008 | La secrétaire enregistre une cliente sans rendez-vous à son arrivée : nom, téléphone facultatif, modèle ou remarque. | La cliente apparaît en bas de la file d'attente avec son heure d'arrivée. | M | T, D |
| FR-009 | La secrétaire marque l'arrivée d'une cliente qui avait rendez-vous. | La prestation passe de PRÉVUE à EN ATTENTE. | M | T |
| FR-010 | La secrétaire démarre une prestation en choisissant 1 ou 2 coiffeuses libres et compétentes. | Seules les coiffeuses libres pour toute la durée estimée et compétentes pour le type demandé sont proposées ; l'heure de début est l'heure actuelle. | M | T, D |
| FR-011 | La secrétaire termine une prestation en saisissant le prix payé et le moyen de paiement (espèces ou mobile money). | La prestation passe à TERMINÉE et les coiffeuses redeviennent libres. | M | T |
| FR-012 | La secrétaire annule un rendez-vous, le déplace, ou marque la cliente absente. | Un rendez-vous annulé ou déplacé libère l'ancien créneau. | M | T |

### Bilan

| ID | Exigence | Critère d'acceptation | Prio. | Vérif. |
|---|---|---|---|---|
| FR-013 | La gérante consulte le bilan d'une journée : chiffre d'affaires (total, espèces, mobile money), nombre de prestations, absences, coiffeuse ayant fait le plus de prestations. | Sur un jeu de test connu, chaque chiffre du bilan est exact. | S | T |
| FR-014 | Chaque coiffeuse consulte ses prestations du jour sur son téléphone (lecture seule). | Une coiffeuse ne voit que ses propres prestations. | S | T |

---

## 4. Sécurité et données

| ID | Exigence | Critère d'acceptation | Prio. | Vérif. |
|---|---|---|---|---|
| SEC-001 | La secrétaire et la gérante doivent se connecter pour accéder à l'outil. | Sans connexion, toute page de l'outil redirige vers la connexion, et toute requête à l'API est refusée (401). | M | T |
| SEC-002 | Les rôles limitent les actions : seule la gérante gère l'équipe et voit le bilan. | Une secrétaire qui appelle directement l'action « ajouter une coiffeuse » reçoit un refus (403). | M | T |
| SEC-003 | Les numéros de téléphone des clientes ne sont visibles que par le personnel connecté. | Aucun numéro dans les pages publiques ni dans les journaux. | M | T, R |
| SEC-004 | Aucun secret (mot de passe de la base, clés) dans le code ou dans Git. | Revue du dépôt avant chaque mise en ligne. | M | R |
| DATA-001 | Les données sont sauvegardées au moins une fois par jour. | Une restauration a été essayée au moins une fois avant le pilote. | M | D |

## 5. Exigences non fonctionnelles

| ID | Exigence | Critère d'acceptation | Prio. | Vérif. |
|---|---|---|---|---|
| NFR-001 | Conçu d'abord pour téléphone. | Tous les écrans fonctionnent à 360 px de large, avec des boutons d'au moins 44 px. | M | T |
| NFR-002 | Utilisable avec une connexion mobile lente. | Le planning s'affiche en moins de 5 s avec une connexion 3G simulée. | M | T |
| NFR-003 | Français, montants en FCFA, heure de Ouagadougou. | Revue de chaque écran. | M | R |
| NFR-004 | Une erreur ne fait jamais perdre une saisie en cours. | Si l'enregistrement échoue, le formulaire reste rempli et un message s'affiche. | M | T |

---

## 6. Hors périmètre de la phase A

Réservation en ligne par les clientes (phase B), paiement en ligne, envoi automatique de messages, plusieurs salons.

## 7. Questions ouvertes

| Question | Impact |
|---|---|
| Qui encaisse et saisit le prix final : la secrétaire, ou la coiffeuse ? | FR-011 |
| « Coiffeuse la plus demandée » = celle qui a fait le plus de prestations, ou celle que les clientes demandent par son nom ? | FR-013 |
| Après combien de minutes de retard une cliente avec rendez-vous peut-elle être doublée ? | BR-004 |
