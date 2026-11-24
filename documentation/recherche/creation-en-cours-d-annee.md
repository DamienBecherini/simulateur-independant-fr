# Recherche : une activité créée en cours d'année

Préparation du point 1 de la phase 15 de la feuille de route (« Prorata temporis : activité démarrée en cours d'année »). Ce document rassemble les règles **sourcées** de l'année de création, décrit ce que le moteur calcule aujourd'hui et propose une conception. Il ne contient **aucun code**. Les décisions du propriétaire sont à la section 11, les cas calculés à la main à la section 12, le plan à la section 13.

- **Date de consultation des sources :** 23 novembre 2026. Le site de l'Urssaf refuse les lectures automatiques : les règles des indépendants viennent de Légifrance, du BOFiP, de la Cnav et de la CNBF, et quelques points de sources secondaires, signalés.
- **Exemples :** valeurs 2026 (PASS 48 060 €, PMSS 4 005 €, SMIC horaire 12,02 €). Une création « au 1er avril » compte 275 jours d'activité en 2026, « au 15 septembre » 108 jours (premier jour compté, comme les exemples du BOFiP).
- **Légende :** **[sourcé]** lu sur la source citée ; **[secondaire]** lu seulement sur une source non officielle ; **[à confirmer]** source officielle muette, ambiguë ou contradictoire.

## Sommaire

1. [Ce que fait le moteur aujourd'hui](#1-ce-que-fait-le-moteur-aujourdhui)
2. [Micro-entreprise](#2-micro-entreprise)
3. [Indépendant au réel : EI et gérant majoritaire d'EURL](#3-indépendant-au-réel--ei-et-gérant-majoritaire-deurl)
4. [Président de SASU et salariés](#4-président-de-sasu-et-salariés)
5. [Société à l'impôt sur les sociétés](#5-société-à-limpôt-sur-les-sociétés)
6. [Impôt sur le revenu du foyer](#6-impôt-sur-le-revenu-du-foyer)
7. [Tableau des règles](#7-tableau-des-règles)
8. [Proposition de conception](#8-proposition-de-conception)
9. [Cas de référence proposés](#9-cas-de-référence-proposés)
10. [Points incertains](#10-points-incertains)
11. [Décisions du propriétaire](#11-décisions-du-propriétaire-24-novembre-2026)
12. [Cas calculés à la main](#12-cas-calculés-à-la-main)
13. [Plan de réalisation](#13-plan-de-réalisation)

---

## 1. Ce que fait le moteur aujourd'hui

**La date.** `dateDeCreation` (« AAAA-MM », `DateDeCreationSchema`, `src/types.ts`) existe sur la micro-entreprise et sur la société (`CompanySchema` : SASU, EURL, EI), pas sur le portage ni sur la personne. Saisie par `ChampDateDeCreation.tsx` (mois et année, « Non renseignée » possible). Pas de date de fin d'activité. L'activité est supposée commencer le 1er du mois.

**Déjà géré** (tout ce qui lit la date) :

| Dispositif | Où | Effet |
|---|---|---|
| Plafonds de la micro | `dispositifs.ts`, `prorataDesPlafonds` | jours d'activité / 365 l'année de création ; plusieurs micros réunies : la plus ancienne (ADR 018) |
| ACRE de la micro | `dispositifs.ts`, `acreDeLAnnee` | mois par mois, jusqu'à la fin du 3e trimestre civil suivant ; 50 % ou 25 % selon la date |
| Sortie du régime micro | `dispositifs.ts`, `auDelaDesPlafonds` | les années avant la création ne comptent pas ; l'année de création, au prorata |
| CFE | `dispositifs.ts`, `partDeCFEDue` ; `frais-de-fonctionnement.ts` | 0 l'année de création, moitié l'année suivante, **dans les frais du comparateur seulement** (la simulation prend la CFE saisie) |
| Zone franche ou QPV | `exoneration-de-zone.ts` | mois d'activité de l'année, plafond au prorata des mois |
| Réserve légale | `simulation-au-reel.ts`, `etatAuDebutDeLaSimulation` | à zéro pour une société créée dans la session |

**Pas géré** (annuel, sans prorata) :

- **Indépendants au réel** (`cotisationsTNS.ts`, `cotisations-liberales.ts`) : assiettes minimales pleines (indemnités journalières 19 224 €, retraite de base 5 409 €, invalidité-décès 5 527 €) même sans revenu ; tranches sur le PASS annuel ; formation professionnelle sur le PASS entier. Une EURL qui ne rémunère pas son gérant paie les minimums sur l'année entière (`calculsEURL.ts`).
- **Président de SASU et salariés** (`cotisationsSalarie.ts`) : plafond de la Sécurité sociale annuel appliqué au brut annuel ; réduction générale sur le SMIC annuel entier.
- **Impôt sur les sociétés** (`calculsSociete.ts`) : limite de 42 500 € pleine ; exercice toujours égal à l'année civile.
- **Micro** : seuils de franchise de TVA pleins (`calculsAE.ts`).
- **Grille** : les flux saisis avant le mois de création sont comptés comme les autres, sans avertissement ni repère (`aggregateAnnualFlowsByEntity`). Une année entièrement antérieure à la création est simulée normalement, minimums des indépendants compris.

**Tests :** aucun cas d'une année de création pour les indépendants au réel, le plafond de la Sécurité sociale, l'impôt sur les sociétés, la réduction générale ou la TVA.

---

## 2. Micro-entreprise

| Règle | Année de création | Source |
|---|---|---|
| Plafonds du régime (203 100 € ventes, 83 600 € services, 2026-2028) | CA ramené à l'année : CA × 365 / jours d'activité (365 même une année bissextile). Dépasser en N puis en N+1 fait sortir du régime en N+2. **Déjà géré.** | [sourcé] art. 50-0 et 102 ter CGI ; [BOI-BIC-DECLA-10-10-20 § 30-35](https://bofip.impots.gouv.fr/doctrine/BOI-BIC-DECLA-10-10-20) |
| Franchise en base de TVA (réforme 2025) | **Prorata par jours / 365.** Année N : seuil majoré au prorata, TVA due dès le jour du dépassement. N+1 : franchise perdue au 1er janvier si le CA de N dépasse le seuil de base au prorata. Exemple, services créés le 15 septembre : 41 250 × 108/365 = 12 205 € en N ; 37 500 × 108/365 = 11 096 € pour N+1. | [sourcé] art. 293 B CGI ; [BOI-TVA-DECLA-40-10-10 § 285-295](https://bofip.impots.gouv.fr/doctrine/BOI-TVA-DECLA-40-10-10), version du 01/07/2026. D'anciennes pages et beaucoup de sites privés disent encore « pas de prorata » : le BOFiP de 2026 fait foi. |
| Versement libératoire | Option possible jusqu'au dernier jour du 3e mois qui suit la création. Ni le plafond de revenu fiscal de référence ni les taux ne sont au prorata. | [sourcé] [impots.gouv](https://www.impots.gouv.fr/professionnel/le-versement-liberatoire) |
| Abattement minimum (305 €) | Pas de prorata. | [sourcé] art. 50-0 et 102 ter CGI |
| Cotisations, formation professionnelle | Proportionnelles au CA : rien à proratiser. | art. L6331-48 code du travail |
| ACRE | Déjà géré (25 % pour une création depuis le 01/07/2026). | [sourcé] D131-6-3 CSS, décret 2026-69 |

---

## 3. Indépendant au réel : EI et gérant majoritaire d'EURL

**Règle générale : le PASS au prorata de la durée d'affiliation.** Pour un indépendant affilié moins d'une année, le plafond de la Sécurité sociale retenu est la valeur annuelle au 1er janvier, « réduite au prorata de la durée d'affiliation » ([sourcé] [R613-17 CSS](https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000038750258)). La retraite complémentaire le redit ([D635-7](https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000041966498)).

- **Ce qui suit le PASS au prorata :** les tranches de la maladie-maternité (barème progressif, [D621-2](https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000049904592)), des allocations familiales (110 % et 140 % du PASS), de la retraite de base plafonnée, de la retraite complémentaire (jusqu'à 4 PASS) et de l'invalidité-décès ; les bornes de l'abattement de 26 % (1,76 % et 130 % du PASS) **[à confirmer]**.
- **Unité du prorata [à confirmer] :** le texte dit « durée d'affiliation » sans préciser jours ou mois. Création au 1er avril : 48 060 × 275/365 = 36 210 € en jours, 48 060 × 9/12 = 36 045 € en mois. Le simulateur ne connaît que le mois de création ; les deux lectures ne diffèrent que de quelques dizaines d'euros de plafond.

**Minimums.**

| Minimum | Année de création | Source |
|---|---|---|
| Retraite de base : 450 × SMIC horaire (5 409 €) | **Pas de prorata**, « qu'il s'agisse d'une année complète d'activité ou non », mais **seulement si l'affiliation dure au moins 90 jours** dans l'année. Création au 15 octobre (78 jours) : pas de minimum. | [sourcé] [D633-2](https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000041966730) ; [circulaire Cnav 2024-24](https://legislation.lassuranceretraite.fr/Pdf/circulaire_cnav_2024_24_26072024.pdf) ; libéraux : [D642-4](https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000048838321) (« n'est pas réduite au prorata ») |
| Indemnités journalières : 40 % du PASS | **[à confirmer]** Par R613-17, le PASS au prorata réduirait ce minimum ; une source secondaire dit le contraire. | [D621-3](https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000049904537) ; [secondaire] Aesio |
| Invalidité-décès : 11,5 % du PASS | **[à confirmer]** Même question. | D632-1 |
| Formation professionnelle : 0,25 % du PASS (120 €) | **[secondaire]** Pas de prorata. | L6331-48 code du travail ; Aesio |

**Autres points.**

- **CSG-CRDS :** pas de seuil en PASS, rien à proratiser.
- **Bases forfaitaires des deux premières années** (19 % du PASS, 40 % pour les indemnités journalières) : seulement provisionnelles, régularisées sur le revenu réel. Le simulateur calcule les cotisations **définitives** : hors sujet, sauf à expliquer l'écart de trésorerie la première année (déjà noté en « reste » à la feuille de route).
- **ACRE hors micro** (créations depuis le 01/01/2026, demande sous 60 jours, 12 mois, exonération de 25 % jusqu'à 75 % du PASS puis dégressive jusqu'au PASS, PASS au prorata de l'affiliation) : [sourcé] [D131-6-1](https://www.legifrance.gouv.fr/codes/section_lc/LEGITEXT000006073189/LEGISCTA000006155763/), [fiche CNBF](https://www.cnbf.fr/wp-content/uploads/2026/03/Fiche-CNBF-Exonerations-ACRE-2026.pdf). C'est le point 2 de la phase 15 : il réutilisera le PASS au prorata construit ici.
- **Bénéfice de l'EI à l'IR :** sans bilan l'année de création, le bénéfice imposé est celui de la période qui va jusqu'au 31 décembre (art. 37 CGI) : l'année civile du simulateur convient.

---

## 4. Président de SASU et salariés

- **Plafond de la Sécurité sociale au prorata de la période d'emploi** ([sourcé] R242-2 CSS ; [secondaire] circulaire DSS du 19/12/2017, [legisocial](https://www.legisocial.fr/actualites-sociales/2432-entree-sortie-cours-mois-fixation-plafond-securite-sociale-change-1er-janvier-2018.html)) : chaque mois complet compte un PMSS ; un mois incomplet, PMSS × jours calendaires d'emploi / jours du mois. Les plafonds s'additionnent sur la période d'emploi (régularisation progressive). Rémunéré à partir du 1er avril : 9 × 4 005 = **36 045 €** au lieu de 48 060 €. Le simulateur commençant au 1er du mois, c'est **un PMSS par mois depuis le mois de création**, sans cas de mois incomplet.
- **Pour le président,** la « période d'emploi » est celle du mandat, pas celle des mois payés : un président nommé en avril et payé seulement en décembre cumule les plafonds d'avril à décembre. Le mois de création de la société est la meilleure approximation du début du mandat **[à confirmer]**.
- **Réduction générale (salariés seulement) :** le SMIC annuel est ramené à la période d'emploi ([sourcé] D241-7 CSS ; BOSS « Réduction générale »). Pour un salarié de la société créée en avril : SMIC de 9 mois. Le moteur suppose aujourd'hui un salarié à temps plein toute l'année.
- **Trimestres de retraite :** 150 × SMIC horaire (1 803 €) par trimestre, seuil annuel non proratisé ([secondaire] R351-9 CSS, non relu) : rien à changer.

---

## 5. Société à l'impôt sur les sociétés

- **Premier exercice :** sans bilan l'année de création, l'impôt porte sur la période qui va du début d'activité à la clôture du premier exercice, **au plus tard le 31 décembre N+1** ; pas d'impôt en N ([sourcé] art. 209 I al. 2 CGI).
- **Taux réduit de 15 % au prorata des mois :** la limite de 42 500 € est multipliée par le nombre de mois de l'exercice / 12, les jours restants comptés sur une base de 30 ([sourcé] art. 219 I b CGI ; [BOI-IS-LIQ-20-20 § 50](https://bofip.impots.gouv.fr/doctrine/BOI-IS-LIQ-20-20), exemple officiel 8,5/12 → 30 104 €). Création au 1er avril, clôture au 31 décembre : 42 500 × 9/12 = **31 875 €**. Premier exercice de 21 mois (avril N à décembre N+1) : 74 375 € **[à confirmer]** (le § 50 est appliqué par analogie).
- **CFE :** comme la micro (rien en N, moitié en N+1).

---

## 6. Impôt sur le revenu du foyer

Aucun prorata : barème, quotient familial et décote sont annuels. La déduction de 10 % sur les salaires garde son minimum (limité au salaire) et son maximum ([sourcé] art. 83 3° CGI). Rien à changer.

---

## 7. Tableau des règles

| Règle | Prorata l'année de création ? | Base | Géré aujourd'hui ? |
|---|---|---|---|
| Plafonds de CA de la micro | oui | jours / 365 | **oui** |
| Franchise de TVA (seuil majoré en N, seuil de base pour N+1) | oui | jours / 365 | non |
| Versement libératoire, abattement minimum | non | — | sans objet |
| Tranches en PASS des indépendants | oui | durée d'affiliation (unité à confirmer) | non |
| Minimum de retraite de base des indépendants | non, mais rien sous 90 jours d'affiliation | — | non (minimum toujours appliqué) |
| Minimums indemnités journalières et invalidité-décès | à confirmer | PASS au prorata ? | non |
| Formation professionnelle des indépendants | non (secondaire) | — | sans objet |
| Plafond de la Sécurité sociale (président, salariés) | oui | mois de la période d'emploi | non |
| SMIC de la réduction générale (salariés) | oui | période d'emploi | non |
| Limite de 42 500 € à 15 % | oui | mois de l'exercice / 12 | non |
| Premier exercice de plus de 12 mois | possible jusqu'au 31/12/N+1 | — | non (exercice = année civile) |
| CFE | rien en N, moitié en N+1 | — | dans le comparateur seulement |
| Barème de l'IR, déduction de 10 % | non | — | sans objet |

---

## 8. Proposition de conception

**Principe.** Un seul nombre par activité et par année, le **nombre de mois d'activité** (12, sauf l'année de création : mois de création à décembre ; 0 avant la création), dérivé de `dateDeCreation`. Les calculs qui doivent être au prorata le reçoivent ; ceux qui ne le sont pas n'en tiennent pas compte. Pas de nouvelle saisie : la date existe déjà.

1. **Indépendants au réel** (`cotisationsTNS.ts`, `cotisations-liberales.ts`) : PASS × mois / 12 pour toutes les tranches et bornes ; minimum de retraite de base plein, sauf affiliation de moins de 90 jours dans l'année (création en novembre ou décembre ; une création au 1er octobre donne 92 jours) ; minimums indemnités journalières et invalidité-décès selon la décision du point 10.2.
2. **Président et salariés** (`cotisationsSalarie.ts`, `plafond-entre-mandats.ts`) : plafond = PMSS × mois depuis la création, combiné avec la part du plafond entre plusieurs mandats (`avecUnePartDuPlafond`, ADR 018) ; SMIC de la réduction générale × mois / 12 pour les salariés.
3. **Impôt sur les sociétés** (`calculsSociete.ts`) : limite de 42 500 € × mois / 12 l'année de création ; l'exercice reste l'année civile (le premier exercice long est écarté, avec une note dans les limites du modèle).
4. **Micro** : seuils de franchise de TVA au prorata des jours (même fonction que les plafonds), avertissements existants inchangés.
5. **Année entièrement avant la création** : l'activité ne produit rien (ni minimums, ni CFE, ni impôt), avec une note.
6. **Flux saisis avant le mois de création** : avertissement dans les résultats (« 3 000 € de chiffre d'affaires saisis avant la création, en février et mars ») et repère dans la grille (mois grisés ou marqués « avant la création »). Ils restent comptés, pour ne pas perdre de saisie sans le dire **[à trancher]**.
7. **Explications** : chaque montant au prorata le dit dans la fiche de l'activité (« plafond de la Sécurité sociale au prorata : 36 045 €, 9 mois d'activité »), dans les exports et pour les outils des IA.
8. **Comparateur** : les colonnes reprennent la date de création de l'activité (déjà le cas pour la micro).
9. **Règles** : rien de nouveau dans les fichiers de règles, sauf peut-être le seuil de 90 jours (`TNS.cotisationsMinimales.joursDAffiliationMinimum`).

**Hors périmètre de ce point :** la date de fin d'activité (cessation) ; le premier exercice de plus de 12 mois ; les bases provisionnelles des deux premières années ; l'ACRE hors micro (point 2 de la phase 15, qui s'appuiera sur ce travail) ; une date au jour près.

---

## 9. Cas de référence proposés

À calculer à la main avant le code, avec les règles de 2026.

1. **EI au réel, services, créée en avril 2026**, bénéfice 30 000 € : cotisations avec le PASS au prorata (9/12) ; comparer à l'année pleine.
2. **EURL créée en octobre 2026, gérant non rémunéré** : pas de minimum de retraite de base (moins de 90 jours) ; minimums indemnités journalières et invalidité-décès selon la décision.
3. **SASU créée en avril 2026**, président payé 4 000 € brut par mois d'avril à décembre : plafond 36 045 € ; cotisations plafonnées différentes de l'année pleine.
4. **SASU créée en septembre 2026**, bénéfice 40 000 € : IS avec une limite de 42 500 × 4/12 = 14 167 € au taux réduit.
5. **Micro de services créée le 1er septembre 2026**, 15 000 € de CA : seuil de TVA de l'année 41 250 × 122/365 = 13 788 € dépassé (avertissement).
6. **Flux avant la création** : micro créée en mars avec du CA saisi en janvier : avertissement.

---

## 10. Points incertains

1. **Unité du prorata de R613-17** (jours ou mois). Proposition : les mois, faute de date au jour près, avec une note.
2. **Minimums indemnités journalières et invalidité-décès** : au prorata (lecture de R613-17) ou pleins (source secondaire) ? À vérifier sur une notice de l'Urssaf ou auprès d'elle.
3. **Bornes de l'abattement de 26 %** (en part du PASS) : au prorata ?
4. **Début du mandat du président** : le mois de création de la société, ou un champ à part ?
5. **Seuil de 90 jours** : apprécié sur l'année civile de création (une création au 1er octobre donne 92 jours : le minimum s'applique).
6. **Limite à 15 % d'un premier exercice de plus de 12 mois** (hors périmètre si le premier exercice long est écarté).

---

## 11. Décisions du propriétaire (24 novembre 2026)

1. **Périmètre :** tout en une fois : indépendants au réel, président et salariés, impôt sur les sociétés, franchise de TVA de la micro.
2. **Flux saisis avant la création :** comptés, avec un avertissement dans les résultats et les mois marqués dans la grille.
3. **Premier exercice de plus de 12 mois :** écarté ; l'exercice reste l'année civile, avec une note dans les limites du modèle.
4. **Date de fin d'activité :** plus tard (même mécanique).
5. **Points incertains 2 et 3 :** on suit la lecture du texte (R613-17) : minimums des indemnités journalières et de l'invalidité-décès, et bornes de l'abattement de 26 %, au prorata du PASS ; écrit comme une hypothèse dans les explications et dans l'ADR. La formation professionnelle reste pleine. Unité du prorata : les mois (point incertain 1).

---

## 12. Cas calculés à la main

Calculés le 24/11/2026 avec les barèmes de `2026.json`, par une réimplémentation des formules indépendante du code du simulateur (barème progressif de la maladie et des allocations familiales, tranches en PASS, minimums), selon les décisions ci-dessus. Ils deviendront les cas de référence (`references/creation-en-cours-d-annee.reference.test.ts`).

**Cas 1 : EI au réel, revenu avant cotisations 30 000 €, créée le 1er avril 2026** (9 mois, 275 jours). PASS au prorata : 48 060 × 9/12 = 36 045 €. Abattement : 26 % × 30 000 = 7 800 € (entre 1,76 % et 130 % du PASS au prorata) ; assiette 22 200 € dans les deux cas.

| Ligne | Année pleine | Au prorata |
|---|---|---|
| Maladie-maternité (taux progressif) | 504,84 € | **905,65 €** |
| Indemnités journalières | 111,00 € | 111,00 € |
| Retraite de base | 3 967,14 € | 3 967,14 € |
| Retraite complémentaire | 1 798,20 € | 1 798,20 € |
| Invalidité-décès | 288,60 € | 288,60 € |
| Allocations familiales | 0 € | 0 € |
| CSG-CRDS | 2 153,40 € | 2 153,40 € |
| Formation professionnelle | 120,15 € | 120,15 € |
| **Total** | 8 943,33 € | **9 344,14 €** |

**À retenir :** le prorata **augmente** les cotisations. Le même revenu, gagné en 9 mois, correspond à un revenu annuel plus élevé : l'assiette pèse 61,6 % du PASS au prorata au lieu de 46,2 %, et le taux progressif de la maladie monte (4,08 % au lieu de 2,27 %). L'explication doit le dire.

**Cas 2 : EURL, gérant non rémunéré (revenu 0).**

| | Année pleine | Créée en octobre (3 mois, 92 jours) | Créée en novembre (2 mois, 61 jours) |
|---|---|---|---|
| Indemnités journalières (minimum 40 % du PASS) | 96,12 € | 24,03 € | 16,02 € |
| Retraite de base (minimum 450 h de SMIC) | 966,59 € | 966,59 € | **0 €** (moins de 90 jours) |
| Invalidité-décès (minimum 11,5 % du PASS) | 71,85 € | 17,96 € | 11,98 € |
| Formation professionnelle | 120,15 € | 120,15 € | 120,15 € |
| **Total** | 1 254,71 € | 1 128,73 € | **148,15 €** |

**Cas 3 : SASU créée en avril 2026, président payé 5 000 € brut par mois d'avril à décembre** (brut 45 000 €). Plafond : 9 × 4 005 = 36 045 € au lieu de 48 060 €.

| | Plafond annuel | Plafond au prorata |
|---|---|---|
| Cotisations salariales (CSG-CRDS comprises) | 9 378,11 € | 9 334,55 € |
| Cotisations patronales | 16 735,50 € | 16 821,94 € |
| **Total** | 26 113,61 € | **26 156,49 €** |
| Net avant impôt | 35 621,89 € | **35 665,45 €** |

La part du brut au-dessus du plafond (8 955 €) passe en tranche 2 (retraite complémentaire, contributions d'équilibre générale et technique) et sort de la vieillesse plafonnée.

**Cas 4 : SASU créée en septembre 2026, bénéfice imposable 40 000 €.** Limite du taux réduit : 42 500 × 4/12 = 14 166,67 €. IS : 14 166,67 × 15 % + 25 833,33 × 25 % = **8 583,33 €**, au lieu de 6 000 € avec la limite pleine.

**Cas 5 : micro-entreprise de services créée le 1er septembre 2026** (122 jours), 15 000 € de CA. Seuil majoré de l'année : 41 250 × 122/365 = **13 787,67 €**, dépassé : avertissement (TVA due dès le dépassement). Seuil de base pour 2027 : 37 500 × 122/365 = 12 534,25 €, dépassé aussi : pas de franchise au 1er janvier 2027.

**Cas 6 : flux avant la création.** Micro créée en mars 2026 avec 2 000 € de CA saisis en janvier et en février : avertissement « 4 000 € saisis avant la création (janvier, février) », montants comptés.

---

## 13. Plan de réalisation

Une branche, dans cet ordre ; chaque étape garde la vérification complète verte.

1. **ADR 020** « Une activité créée en cours d'année » : les décisions de la section 11, les hypothèses (unité en mois, minimums au prorata, début du mandat au mois de création), ce qui est écarté (premier exercice long, cessation, date au jour près).
2. **Les mois d'activité** (`dispositifs.ts`) : `moisDActivite(creation, annee)` (12, mois de création à décembre, ou 0) et les jours d'affiliation (seuil de 90 jours) ; tests unitaires.
3. **Indépendants** (`cotisationsTNS.ts`, `cotisations-liberales.ts`, `calculsEI.ts`, `calculsEURL.ts`) : règles TNS au prorata (`avecLePassAuProrata`, sur le modèle d'`avecUnePartDuPlafond`) et minimums selon la section 11 ; seuil des 90 jours dans les règles de chaque année (indépendants et libéraux) ; cas 1 et 2.
4. **Président et salariés** (`cotisationsSalarie.ts`, `plafond-entre-mandats.ts`, `simulation-au-reel.ts`, `routage-des-flux.ts`) : plafond × mois / 12, combiné avec la part entre mandats (ADR 018) ; SMIC de la réduction générale × mois / 12 ; cas 3.
5. **Impôt sur les sociétés** (`calculsSociete.ts`) : limite au prorata l'année de création ; cas 4.
6. **Franchise de TVA de la micro** (`calculsAE.ts`) : seuils au prorata des jours (même calcul que les plafonds) ; avertissement pour N+1 ; cas 5.
7. **Année avant la création** : l'activité ne produit ni cotisation ni impôt ; note.
8. **Flux avant la création** : avertissement dans les résultats ; mois marqués dans la grille ; cas 6.
9. **Explications** : notes de la fiche de l'activité (plafond et limites au prorata, mois d'activité, minimum de retraite non dû, cotisations plus fortes qu'en année pleine), texte d'aide du champ « Date de création » complété pour les sociétés et l'EI, limites du modèle (premier exercice long), exports CSV et Markdown, outils des IA.
10. **Comparateur et optimiseur** : les colonnes reprennent les mois d'activité (vérifier que la date suit chaque statut converti, y compris le portage, qui la perd aujourd'hui).
11. **Documentation** : guide (carte du moteur, glossaire), `fonctionnalites.md`, CHANGELOG, Roadmap (phase 15 point 1 ✅, cessation en « plus tard »).

**Maquettes à valider avant le code :** la grille avec les mois avant la création (étape 8), et la fiche d'une activité créée en cours d'année avec ses explications (étape 9).
