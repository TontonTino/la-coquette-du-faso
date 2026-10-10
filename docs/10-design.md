# 10 — Design de l'interface (« Le fil d'or »)

Objectif : un site cliente beau et rassurant, et un outil de travail clair pour la secrétaire et la gérante, sur téléphone.

## Principes

- **Marque noir et or** (logo du salon). Pages clientes sur fond blanc lin pour faire ressortir les photos ; espace salon sur fond « atelier » (gris chaud) avec des cartes blanches.
- **Une seule signature** : la bande tissée inspirée du **Faso Dan Fani** (classe `.bande-faso`). Utilisée uniquement en haut des en-têtes, en pied de page, et sur le suivi d'un rendez-vous confirmé. Ne pas la multiplier.
- **La photo d'abord** côté cliente : l'accueil s'ouvre sur les réalisations du salon ; les modèles défilent du doigt.
- **Une couleur par état** côté salon (trait à gauche des cartes, composant `Carte ton=…`) : or = demande en ligne, noir = en attente (rouge après 30 min), indigo = en cours, rouge = à réattribuer ou en retard.
- Pas de libellés en capitales espacées ; numéros seulement quand il s'agit d'un parcours (étapes du formulaire, « Comment ça marche »).

## Jetons (src/app/globals.css)

| Jeton | Valeur | Rôle |
|---|---|---|
| `noir` | #0A0A0A | Marque, boutons principaux, en-têtes |
| `or` / `or-fonce` | #C8A44D / #7D5F17 | Accent ; or foncé pour le texte doré sur fond clair (contraste AA) |
| `lin` | #FFFDF9 | Fond des pages clientes |
| `sable` | #F3EDE2 | Zones secondaires côté cliente |
| `atelier` | #F2F0EB | Fond de l'espace salon |
| `indigo` | #24315F | Bande tissée, prestations en cours |

Typographie : **Cormorant Garamond** (titres, grands chiffres, chiffres alignés) et **Poppins** (texte et interface). Cibles tactiles ≥ 44 px ; focus visible ; animations réduites si le téléphone le demande.
