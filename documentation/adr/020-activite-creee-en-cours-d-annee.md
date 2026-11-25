# ADR-020: Une activité créée en cours d'année

- **Date :** 2026-11-25
- **Statut :** Accepté (2026-11-25)

## Contexte

Le point 1 de la phase 15 de la feuille de route demande de tenir compte d'une activité démarrée en cours d'année. Jusqu'ici, la date de création (`dateDeCreation`, « AAAA-MM ») ne servait qu'à la micro-entreprise (plafonds, ACRE), à la CFE du comparateur, à l'exonération de zone et à la réserve légale. Partout ailleurs, l'année de création était calculée comme une année pleine :

- un indépendant au réel avait le plafond de la sécurité sociale (PASS) entier et des cotisations minimales sur douze mois ;
- un président de SASU et les salariés avaient un plafond annuel entier ;
- une société avait la tranche d'impôt sur les sociétés à 15 % entière ;
- une micro-entreprise avait les seuils de franchise de TVA entiers.

La recherche est dans `documentation/recherche/creation-en-cours-d-annee.md` : les règles et leurs sources, les points incertains, les cas calculés à la main.

## Décisions du propriétaire (2026-11-24, corrigées le 2026-11-25)

1. **Périmètre :** tout en une fois. Il couvre les indépendants au réel, le président et les salariés, l'impôt sur les sociétés et la franchise de TVA de la micro-entreprise.
2. **Montants saisis avant le mois de création :** comptés, avec un avertissement dans les résultats et les mois marqués dans la grille.
3. **Premier exercice de plus de 12 mois :** écarté. L'exercice reste l'année civile, et les limites du modèle le disent.
4. **Date de fin d'activité :** plus tard, avec la même mécanique.
5. **Points incertains :**
   - On suit le texte (article R613-17 du code de la sécurité sociale) : le minimum d'invalidité-décès et les bornes de l'abattement de 26 % sont réduits au prorata du PASS. C'est une hypothèse, et elle est écrite comme telle.
   - Le minimum des indemnités journalières et la formation professionnelle restent entiers : l'Urssaf les exclut du prorata (lu le 2026-11-25).
   - L'unité du prorata est le mois.
6. **Maquettes** validées le 2026-11-25.

## Décision

### L'année de création d'une activité

`anneeDeCreation(dateDeCreation, annee)` (`annee-de-creation.ts`) donne, pour une activité et une année :

- `null` si l'année est entière : pas de date, création une année antérieure, ou création en janvier ;
- sinon le mois de création, les **mois d'activité** (de 1 à 11 : du mois de création à décembre) et les **jours d'activité** (le premier jour du mois de création compté).

Le simulateur ne connaît que le mois de création : l'activité commence le 1er.

### Les règles de l'année de création

`reglesDeLAnneeDeCreation(regles, anneeDeCreation)` rend les règles de l'année ramenées à la période d'activité. Le calcul de l'activité les reçoit à la place des règles de l'année, et rien d'autre ne change dans les calculs :

| Bloc | Au prorata | Reste entier |
|---|---|---|
| Indépendants (`TNS`) | PASS × mois / 12 : tranches, barèmes progressifs, bornes de l'abattement ; minimum d'invalidité-décès × mois / 12 | minimum des indemnités journalières ; formation professionnelle (sur le PASS entier, `formationProfessionnelle.plafondEntier`) ; minimum de retraite de base, sauf moins de 90 jours d'activité (alors aucun) |
| Libéraux réglementés (`liberauxReglementes.commun`) | barèmes en part du PASS, par le PASS des indépendants | minimum des indemnités journalières ; minimum de retraite de base, sauf moins de 90 jours |
| Régime général (`regimeGeneral`) | plafond × mois / 12 (un PMSS par mois de mandat ou d'emploi) ; SMIC annuel de la réduction générale × mois / 12 | taux |
| Impôt sur les sociétés (`IS`) | limite du taux réduit × mois / 12 | taux |

- **Seuil des 90 jours** (articles D633-2 et D642-4) : il est dans les règles de chaque année (`cotisationsMinimales.joursDAffiliationMinimumRetraiteDeBase`).
- **Président de SASU :** la période d'emploi est celle du mandat. Elle est approchée par le mois de création de la société. Avec plusieurs mandats, la part du plafond (ADR 018) s'applique au plafond déjà réduit.
- **Salariés :** même approximation, depuis le mois de création de l'activité qui les emploie.
- **Micro-entreprise :** les seuils de franchise de TVA suivent le prorata des plafonds du régime, en jours sur 365 (BOFiP, BOI-TVA-DECLA-40-10-10, § 285 à 295). C'est le même prorata, déjà calculé pour les plafonds ; il s'applique aussi aux micro-entreprises réunies d'un même titulaire.

### Les années et les mois avant la création

- **Une année entière avant la création, sans aucun montant saisi :** l'activité ne produit rien (ni cotisations minimales ni impôt), avec une note.
- **Des montants saisis avant le mois de création, l'année de création ou avant :**
  - ils sont comptés comme avant ;
  - un avertissement les signale, avec les mois concernés ;
  - la grille marque ces mois.

### Ce que les résultats disent

Chaque activité dont l'année est réduite porte une note « Année de création ». La note donne :
- les mois d'activité ;
- les plafonds et limites réduits ;
- l'écart de cotisations avec une année pleine (le prorata peut les **augmenter** : le même revenu, gagné en moins de mois, pèse plus lourd face au plafond) ;
- l'absence de minimum de retraite de base sous 90 jours ;
- pour une société, la limite du premier exercice calendaire.

Les exports et les outils pour les IA reprennent ces notes.

## Conséquences

- **Positives :**
  - L'année de création est calculée selon les textes pour tous les statuts, sans nouvelle saisie : la date existe déjà.
  - Les calculs eux-mêmes ne changent pas : ils reçoivent des règles réduites. Le comparateur, l'optimiseur et les années suivantes en profitent sans code propre.
  - La décision du 2026-11-20 sur le plafond partagé entre mandats (ADR 018) se combine avec le prorata, sans cas particulier.
- **Négatives ou compromis :**
  - Le mois est l'unité : une création le 20 du mois compte le mois entier.
  - Le premier exercice d'une société n'excède jamais l'année civile. Une société qui clôt son premier exercice fin N+1 paie en réalité son premier impôt en N+1, sur une limite de taux réduit de plus de 12 mois.
  - Le mandat du président et l'emploi des salariés sont supposés commencer le mois de création.
  - Les minimums propres aux caisses de libéraux (forfaits de la CIPAV et de la CARPIMKO) restent entiers : aucune source ne dit s'ils sont réduits.
  - La date de cessation n'est pas encore prise en compte.
  - Les bases provisionnelles des deux premières années (19 % du PASS) ne sont pas modélisées : le simulateur calcule les cotisations définitives.
