# Professions libérales réglementées et leurs caisses : dossier de règles (phase 14 bis)

- **Date :** 2026-10-08 (toutes les pages citées ont été consultées ce jour-là)
- **Statut :** recherche ; décisions prises dans l'[ADR 015](../adr/015-professions-liberales-reglementees.md), codées pour la CIPAV et la CARPIMKO (phase 14 bis : règles `liberauxReglementes` de 2024 à 2026, cas du §9 dans `src/backend/logic/references/liberaux.reference.test.ts`)
- **Périmètre détaillé :** CIPAV et CARPIMKO, revenus 2024, 2025 et 2026
- **Périmètre d'orientation :** CARMF, CARCDSF, CAVP, CARPV, CAVEC, CAVAMAC, CAVOM, CPRN, CNBF

Ce dossier ne contient que des chiffres lus sur des pages officielles : sites des caisses, urssaf.fr, autoentrepreneur.urssaf.fr, service-public, legifrance, cnavpl.fr. Quand une page n'était plus en ligne, la copie de web.archive.org de cette même page officielle est utilisée, avec la mention **[archive]**. Les contradictions entre sources sont signalées, et ce qui n'a pas été trouvé est marqué **non sourcé** ou **à confirmer**.

Convention d'année : comme le prévoit l'ADR 007, l'année N d'une règle est **l'année des revenus**. Pour 2025, c'est donc le barème de la **régularisation** des revenus de 2025, faite en 2026, et non celui des acomptes appelés en 2025.

---

## 1. Synthèse

1. **Ce qui ne change pas pour un libéral réglementé.** La maladie-maternité, les allocations familiales, la CSG-CRDS et la formation professionnelle sont recouvrées par l'Urssaf. Depuis la régularisation des revenus de 2025, elles suivent **le même barème et la même assiette** que dans le moteur (`cotisationsTNS.ts`). L'abattement de 26 % s'applique aussi aux libéraux réglementés, y compris aux praticiens et auxiliaires médicaux.
2. **Ce qui change :**
   - les **indemnités journalières** : 0,30 % jusqu'à 3 PASS, au lieu de 0,5 % jusqu'à 5 PASS ;
   - la **retraite de base**, régime commun de la CNAVPL : 8,73 % jusqu'à 1 PASS et 1,87 % jusqu'à 5 PASS, au lieu de 17,87 % et 0,72 % ;
   - la **retraite complémentaire** et l'**invalidité-décès**, propres à chaque caisse ;
   - pour les auxiliaires médicaux conventionnés, la **prise en charge** d'une partie de la maladie et de l'ASV par l'Assurance maladie.
3. **CIPAV.**
   - Au réel, tout est proportionnel au revenu. Complémentaire à **11 % jusqu'à 1 PASS puis 21 % de 1 à 4 PASS** : pour 2025, fixée par le décret n° 2025-1076 (art. 12) ; pour 2026, écrite par l'Urssaf seule, aucun décret n'ayant été trouvé. La fiche CIPAV 2026, qui dit encore 9 % puis 22 %, est périmée (§5.1). Invalidité-décès à 0,5 % entre 37 % et 185 % du PASS.
   - En micro-entreprise, le taux global est de **23,2 %** (2025 et 2026), contre 25,6 % pour un libéral SSI en 2026.
4. **CARPIMKO.**
   - La micro-entreprise est **interdite** aux praticiens et auxiliaires médicaux (Urssaf).
   - En 2026, la complémentaire devient proportionnelle : 8,70 % entre 0,5 et 3 PASS, ce qui fait un minimum d'environ 2 091 €.
   - L'invalidité-décès est un forfait de 1 022 €.
   - L'ASV coûte au praticien 224 € plus 0,16 %, le reste étant payé par la CPAM.
   - La caisse appelle elle-même ses cotisations sur l'assiette de l'année précédente ; seule la retraite de base est régularisée sur le revenu de l'année.
   - CURPS de 0,10 %, plafonnée à 240 € en 2026.
   - Les cotisations minimales pèsent lourd à faible revenu.
5. **Sociétés.**
   - Les professions réglementées exercent en société d'exercice libéral (SELARL, SELAS…).
   - Pour un **associé de SEL**, la rémunération de l'activité libérale (rémunération « technique ») relève des BNC depuis l'imposition des revenus 2024, et de la caisse de sa profession. Le président de SELAS n'est assimilé salarié **que pour son mandat social** (§7). Cela change la colonne « SASU » du comparateur pour ces professions : l'ADR 015 s'en tient à un avertissement, la modélisation vient plus tard.

---

## 2. Sources

| Réf. | Page | Contenu |
|---|---|---|
| U-CIP26 | https://www.urssaf.fr/accueil/outils-documentation/taux-baremes/taux-cotisations-plr-cipav.html (mise à jour du 27/02/2026) | Taux 2026, libéraux réglementés CIPAV |
| U-PLR26 | https://www.urssaf.fr/accueil/outils-documentation/taux-baremes/taux-cotisations-plr-hors-cipav.html (mise à jour du 27/02/2026) | Taux 2026, libéraux réglementés hors CIPAV |
| U-PLR24 | https://web.archive.org/web/20250220162136/https://www.urssaf.fr/accueil/outils-documentation/taux-baremes/taux-cotisations-plr-hors-cipav.html **[archive]** | Taux 2024 (la capture de février 2025 montre encore 2024) |
| U-REF | https://www.urssaf.fr/accueil/independant/comprendre-payer-cotisations/reforme-cotisations-independants.html (mise à jour du 07/05/2026) | Réforme de l'assiette, champ et nouveaux taux |
| U-PAM26 | https://www.urssaf.fr/accueil/outils-documentation/taux-baremes/taux-cotisations-pam.html (mise à jour du 20/03/2026) | Taux 2026 des praticiens et auxiliaires médicaux, CURPS |
| U-PAM24 | https://web.archive.org/web/20240908022648/https://www.urssaf.fr/accueil/outils-documentation/taux-baremes/taux-cotisations-pam.html **[archive]** | Taux 2024 des praticiens et auxiliaires médicaux |
| U-AUX | https://www.urssaf.fr/accueil/independant/praticien-auxiliaire-medical/cotisations-auxiliaire-medical.html | Prise en charge, option des pédicures-podologues |
| U-PAMDEV | https://www.urssaf.fr/accueil/independant/creer-activite-independant/devenir-PAM.html | Micro-entreprise interdite |
| U-CURPS | https://www.urssaf.fr/accueil/independant/comprendre-payer-cotisations/vos-cotisations.html | CURPS |
| U-NOT26 | https://www.urssaf.fr/files/live/sites/urssaffr/files/outils-documentation/formulaires-modeles/independant-notice-revenus-2026.pdf | Rémunérations des associés de SEL : BNC |
| U-PASS | https://www.urssaf.fr/accueil/outils-documentation/taux-baremes/plafonds-securite-sociale.html | PASS 2024-2026 |
| U-ACT | https://www.urssaf.fr/accueil/actualites/taux-cotisations-autoentrepeneur.html (mise à jour du 30/01/2026) | Taux micro |
| AE-ESS | https://www.autoentrepreneur.urssaf.fr/portail/accueil/sinformer-sur-le-statut/lessentiel-du-statut.html | Taux micro, VFL, CFP, trimestres |
| AE-ESS-25 | https://web.archive.org/web/20251211194313/https://www.autoentrepreneur.urssaf.fr/portail/accueil/sinformer-sur-le-statut/lessentiel-du-statut.html **[archive]** | Même page fin 2025 |
| CIP-WEB | https://www.lacipav.fr/cotiser-pour-acquerir-des-droits-retraite-prevoyance | Répartition du forfait micro 2026 |
| CIP-WEB-25 | https://web.archive.org/web/20250915163052/https://www.lacipav.fr/cotiser-pour-acquerir-des-droits-retraite-prevoyance **[archive]** | Répartition du forfait micro 2025 |
| CIP-PL26 | https://www.lacipav.fr/sites/default/files/2026-03/Cotiser%20pour%20acqu%C3%A9rir%20des%20droits%20%C3%A0%20retraite%20-%20Fiche%20pratique%202026.pdf | Fiche pratique 2026 (réel) |
| CIP-AE26 | https://www.lacipav.fr/sites/default/files/2026-03/Cotiser%20pour%20acqu%C3%A9rir%20des%20droits%20%C3%A0%20retraite%20AE%20-%20Fiche%20pratique%202026.pdf | Fiche pratique 2026 (micro) |
| CIP-PREV26 | https://www.lacipav.fr/sites/default/files/2026-03/Tout%20savoir%20sur%20votre%20pr%C3%A9voyance%20-%20Fiche%20pratique%202026.pdf | Prévoyance 2026 |
| CIP-INV26 | https://www.lacipav.fr/sites/default/files/2026-03/La%20pension%20d%27invalidit%C3%A9%20-%20Fiche%20pratique%202026.pdf | Invalidité 2026 |
| CIP-CALC26 | https://www.lacipav.fr/sites/default/files/2026-03/Comment%20est%20calcul%C3%A9e%20la%20retraite%20-%20Fiche%20pratique%202026.pdf | Valeurs de point 2026 |
| CIP-QUI | https://www.lacipav.fr/qui-est-assure-a-la-cipav | Professions affiliées |
| CNAVPL-24 | https://www.cnavpl.fr/wp-content/uploads/2024/03/Guide-2024.pdf | Guide CNAVPL 2024 |
| CNAVPL-25 | https://www.cnavpl.fr/wp-content/uploads/2025/07/Guide-2025.pdf | Guide CNAVPL 2025 |
| CNAVPL-PREP | https://www.cnavpl.fr/preparer-sa-retraite/ (mise à jour du 30/12/2025) | Taux de base, minimum, début d'activité |
| CNAVPL-BASE | https://www.cnavpl.fr/regime-de-base/ | Trimestres |
| CNAVPL-COMP | https://www.cnavpl.fr/comprendre-sa-retraite/ | Paramètres 2025, points |
| CARP-REV | https://www.carpimko.com/je-suis-en-activite/cotisations/selon-mes-revenus | Barème CARPIMKO 2026 |
| CARP-BUL | https://www.carpimko.com/Portals/0/BulletinSpecialAssietteSocialeAvril2026.pdf | Bulletin d'avril 2026, comparaison 2025/2026 |
| CARP-ADAPT | https://www.carpimko.com/je-suis-en-activite/mes-demarches/adapter-mes-cotisations | Revenu estimé, régularisation de la retraite de base |
| CARP-ID | https://www.carpimko.com/je-suis-en-activite/ma-prevoyance/cotisation-invalidite-deces | Invalidité-décès |
| CARP-INC | https://www.carpimko.com/je-suis-en-activite/ma-prevoyance/incapacite-ou-dinvalidite | Prestations |
| D-2024-1214 | https://www.legifrance.gouv.fr/jorf/id/JORFTEXT000050854329 | Paramètres CARPIMKO 2024 |
| D-2025-1076 | https://www.legifrance.gouv.fr/jorf/id/JORFTEXT000052565475 | Décret n° 2025-1076 du 10/11/2025 : paramètres CARPIMKO 2025 et 2026 |
| D-2025-1076-12 | https://www.legifrance.gouv.fr/jorf/article_jo/JORFARTI000052565553 | Même décret, art. 12 : complémentaire CIPAV 2025 |
| D-79-262 | https://www.legifrance.gouv.fr/loda/id/JORFTEXT000000702512 | Décret n° 79-262, art. 2-I : tranches de la complémentaire CIPAV |
| A-2026-07-10 | https://www.legifrance.gouv.fr/jorf/id/JORFTEXT000054435904 | Arrêté du 10/07/2026 approuvant des règlements de la CARPIMKO (**non exploité**) |
| A-2025-11-14 | https://www.legifrance.gouv.fr/jorf/id/JORFTEXT000052604983 | Statuts de la complémentaire CARPIMKO (nouvel art. 7) |
| D-2008-1044 | https://www.legifrance.gouv.fr/loda/id/JORFTEXT000019599997 | ASV des auxiliaires médicaux |
| D-2024-688 | https://www.legifrance.gouv.fr/jorf/id/JORFTEXT000049888566 | Décret de la réforme de l'assiette |
| CSS-D642-3 | https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000049904651 | Taux de la retraite de base des libéraux |
| CSS-D642-4 | https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000041966471 | Minimum de la retraite de base |
| CSS-D621-3 | https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000043656764 | Indemnités journalières des libéraux |
| CSS-D613-4 | https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000046714712 | Taux micro (version du 01/01/2026) |
| CSS-L131-6 | https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000048683707 | Assiette des cotisations des indépendants |
| CSS-L311-3 | https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000051284232 | Assimilés salariés |
| SP-F31233-25 | https://entreprendre.service-public.fr/vosdroits/F31233 **[archive 20250708111625]** (« Vérifié le 01 janvier 2025 ») | Cotisations des libéraux 2025 |
| SP-F31233 | https://entreprendre.service-public.gouv.fr/vosdroits/F31233 | Cotisations des libéraux 2026 |
| SP-F23458 | https://entreprendre.service-public.gouv.fr/vosdroits/F23458 | Professions libérales : formes d'exercice, micro-social |
| SP-F38456 | https://entreprendre.service-public.gouv.fr/vosdroits/F38456 | SELAS |
| SP-F38455 | https://entreprendre.service-public.gouv.fr/vosdroits/F38455 (mise à jour du 21/02/2026) | SEL : rémunération technique en BNC |
| BOFIP-SEL | BOFiP, BOI-RES-BNC-000136-20240424 (https://bofip.impots.gouv.fr) | Rémunération technique des associés de SEL : BNC à compter de l'imposition des revenus 2024 |
| CE-328905 | Conseil d'État, 27/05/2011, n° 328905 (https://www.legifrance.gouv.fr) | Président de SELAS : régime général pour le mandat, caisse libérale pour l'activité |
| CSP-L4031-4 | Code de la santé publique, art. L4031-4 (https://www.legifrance.gouv.fr) | CURPS : plafond de 0,5 % du PASS |
| CT-L6331-48 | Code du travail, art. L6331-48 (https://www.legifrance.gouv.fr) | Formation professionnelle en micro-entreprise |
| SP-F39739 | https://entreprendre.service-public.gouv.fr/vosdroits/F39739 | Début d'activité des praticiens et auxiliaires médicaux |
| SP-A16510 | https://entreprendre.service-public.gouv.fr/actualites/A16510 | Ordonnance 2023-77 en vigueur au 01/09/2024 |

---

## 3. Cotisations recouvrées par l'Urssaf : comparaison avec le moteur

Le moteur calcule un travailleur non salarié avec `calculerCotisationsTNS` (`src/backend/logic/cotisationsTNS.ts`) et le bloc `TNS` des fichiers de règles (`src/backend/regles/2024.json`, `2025.json`, `src/backend/config.json` pour 2026).

### 3.1 Assiette : la réforme s'applique aux libéraux réglementés

- **Champ.** U-REF : « Sont concernés : l'ensemble des travailleurs non-salariés (sauf les artistes-auteurs et les marins) : les artisans, commerçants, professions libérales réglementées et non réglementées, les praticiens ou auxiliaires médicaux (Pam) ».
- **Date d'effet.** La réforme s'applique « à compter de la régularisation des cotisations de l'année 2025 (après la déclaration des revenus 2025, en 2026) ».
- **Retraite de base comprise.** CSS-D642-3, dans sa rédaction issue du décret 2024-688, applique 8,73 % « sur l'assiette de cotisations définie aux articles L. 131-6 à L. 131-6-2 », pour les périodes courant à partir du 01/01/2025.
- **Abattement.** 26 %, au moins 1,76 % et au plus 130 % du PASS (D136-5, décret 2024-688). CARP-BUL donne les valeurs 2025 : 829 € et 61 230 €.
- **Adoption par les caisses.**
  - La CARPIMKO calcule « Revenu Brut Social − 26 % (abattement) = Assiette Sociale » (CARP-BUL) pour sa retraite de base et sa complémentaire.
  - La CIPAV a ses cotisations recouvrées par l'Urssaf depuis 2023 (CNAVPL-25), sur la même assiette.
- **Conséquence pour le moteur.** `assietteSociale()` vaut telle quelle pour 2025 et 2026. Pour 2024, le moteur approche déjà l'ancienne assiette avec l'abattement (voir la `description` de `TNS` dans `2024.json`). Le même choix peut être repris pour les libéraux.
- **La CURPS.** U-CURPS la rattachait au revenu retenu pour l'impôt sur le revenu. U-PAM26, plus précise, la donne en part du « revenu d'activité non salarié dans la limite de 240 € pour 2026 », c'est-à-dire du revenu tiré de l'activité libérale. Elle se calcule donc simplement sur l'assiette du moteur, sans calcul circulaire (§5.2).

### 3.2 Ligne par ligne

| Ligne | Moteur actuel (SSI, 2026) | Libéral réglementé | Sources |
|---|---|---|---|
| Maladie-maternité | Barème progressif jusqu'à 8,5 % (`maladieMaternite`) | **Identique à partir des revenus 2025**. En 2024, ancien barème propre aux libéraux réglementés : 0 % sous 40 % du PASS, 4 % à 60 %, 6,5 % à 110 % et au-delà. Il plafonnait à 6,5 % contre 6,7 % pour la SSI. | U-REF ; U-PLR24 [archive] ; SP-F31233-25 |
| Indemnités journalières | 0,5 % jusqu'à 5 PASS, minimum sur 40 % du PASS | **0,30 % jusqu'à 3 PASS**, minimum sur 40 % du PASS, « y compris celle due au titre des première et deuxième années » | CSS-D621-3 ; U-CIP26 ; U-PLR26 |
| Allocations familiales | 0 % jusqu'à 110 % du PASS, puis 3,1 % à 140 % | Identique | U-PLR26 ; U-PLR24 |
| CSG-CRDS | 9,7 % sur l'assiette, dont 6,8 % déductible | Identique ; l'assiette est la même que celle des cotisations après la réforme | U-PLR26 ; U-REF |
| Formation professionnelle | 0,25 % du PASS | Identique : 0,25 % du PASS (0,34 % avec un conjoint collaborateur), soit 116 € en 2024, 118 € en 2025, 120 € en 2026 | U-PLR24 ; SP-F31233-25 ; U-PLR26 |
| Retraite de base | 17,87 % jusqu'à 1 PASS, 0,72 % au-delà ; minimum 450 × SMIC horaire | **8,73 % jusqu'à 1 PASS et 1,87 % jusqu'à 5 PASS**, les deux dès le premier euro ; minimum 450 × SMIC horaire | CSS-D642-3 ; CSS-D642-4 ; CNAVPL-PREP |
| Retraite complémentaire | 8,1 % puis 9,1 % jusqu'à 4 PASS | Barème de la caisse (§5) | — |
| Invalidité-décès | 1,3 % jusqu'à 1 PASS, minimum sur 11,5 % du PASS | Barème de la caisse (§5) | — |
| CURPS (santé) | — | 0,10 % pour les auxiliaires médicaux et les sages-femmes, plafonnée à 240 € en 2026 (232 € en 2024), assise sur le revenu d'activité non salarié | U-PAM26 ; U-PAM24 ; CSP-L4031-4 |

### 3.3 Minimums et début d'activité

**Minimums :**
- Retraite de base : assiette de 450 × SMIC horaire. Cela donne 5 243 € et **529 €** en 2024 (U-PLR24), 5 409 € et **573 €** en 2026 (U-CIP26, U-PLR26).
  - 2025 : assiette de 5 346 € et **540 €** selon CNAVPL-25, mais au taux de 10,10 % des acomptes. Au taux de régularisation de 10,60 %, cela ferait 567 €, **non sourcé**.
  - La cotisation n'est pas proratisée. Elle ne s'applique qu'aux assurés affiliés au moins 90 jours dans l'année (CSS-D642-4). Elle valide 3 trimestres (U-CIP26).
  - L'hypothèse d'une assiette de 11,5 % du PASS, valable pour l'invalidité-décès SSI, **ne vaut pas** pour la retraite de base des libéraux.
- Indemnités journalières : assiette de 40 % du PASS. Cela donne 18 547 € et 56 € en 2024, 19 224 € et 58 € en 2026 (U-PLR24, U-PLR26).
  - En 2025 : forfait de 57 € (SP-F31233-25) ; cotisation maximale **non sourcée**.
  - La page U-PLR24 affiche « 3,5 Pass » alors que 139 104 € correspond à 3 PASS. Les montants retenus sont ceux en euros.
- Les cotisations minimales ne s'appliquent pas aux bénéficiaires du RSA ou de la prime d'activité (U-PLR26). Ce cas n'est pas modélisé.

**Début d'activité :**
- Assiette forfaitaire de 19 % du PASS les deux premières années, « identique pour tous les organismes » (CNAVPL-PREP) : 8 810 € en 2024, 8 949 € en 2025, 9 131 € en 2026.
- Pour les praticiens et auxiliaires médicaux, l'assiette est de 19 % du PASS pour les allocations familiales, la retraite et l'invalidité-décès, et de 40 % du PASS pour la maladie et les IJ (SP-F39739).
- Le moteur ne modélise pas l'assiette forfaitaire de début d'activité, même en SSI. Ce dossier ne l'ajoute pas.

### 3.4 Le moteur n'a qu'une valeur par année : les acomptes ne sont pas modélisés

En 2025, les acomptes ont été appelés à 8,23 % en tranche 1, et la régularisation faite en 2026 applique 8,73 % (U-REF, CNAVPL-25 : « appliqué en 2026 lors de la régularisation de la cotisation 2025 »). Conformément à l'ADR 007, le fichier 2025 doit porter **8,73 %**, comme le fichier 2025 SSI porte déjà 17,87 %.

---

## 4. Retraite de base des professions libérales (régime commun CNAVPL)

| | 2024 | 2025 | 2026 |
|---|---|---|---|
| PASS | 46 368 € | 47 100 € | 48 060 € (U-PASS) |
| Tranche 1, jusqu'à 1 PASS | 8,23 % | **8,73 %** à la régularisation (8,23 % en acompte) | 8,73 % |
| Tranche 2, jusqu'à 5 PASS, dès le 1er euro | 1,87 % | 1,87 % | 1,87 % |
| Cotisation maximale | 8 151 € (U-PLR24) | non sourcé (calcul : 8 515 €) | 8 690 € (U-CIP26) |
| Assiette minimale (450 × SMIC horaire) | 5 243 € | 5 346 € (CNAVPL-25) | 5 409 € |
| Cotisation minimale | 529 € | 540 € en acompte (CNAVPL-25) ; régularisation non sourcée | 573 € |
| Revenu pour 1 trimestre (150 × SMIC horaire) | 1 745,50 € (CNAVPL-24) | 1 782 € (CNAVPL-25) | 1 803 € (CIP-PL26) |
| Points maximum, tranche 1 / tranche 2 | 525 / 25 | 557 / 25 | 557 / 25 (CNAVPL-COMP) |
| Valeur de service du point | 0,6399 € | 0,6540 € | 0,6599 € (CNAVPL-COMP, CIP-CALC26) |

**Sources :**
- Taux : CSS-D642-3, CNAVPL-PREP, CNAVPL-24, CNAVPL-25, U-REF.
- Trimestres : CNAVPL-BASE, « 150 heures […] avec un maximum de 4 trimestres par année civile ». U-PLR26 : 4 trimestres avec « 600 Smic horaire (7 212 € au 1er janvier 2026) ».

**Contradictions :**
- La fiche CIP-PL26 indique encore 8,23 % et un « forfait de 540 € » pour 2026, contre 8,73 % et 573 € à l'Urssaf. On retient l'Urssaf, qui recouvre la cotisation et s'appuie sur CSS-D642-3.
- La page CARPIMKO « calcul de ma retraite » affiche encore 525 points au maximum.
- CIP-PL26 donne aussi « 1 point pour 89,71 € » en tranche 1, alors que 48 060 / 557 = 86,28 € : **à confirmer**. Le nombre de points n'est pas utile au moteur.

---

## 5. Caisses détaillées

### 5.1 CIPAV

**Professions affiliées** (CIP-QUI) :
- architecte, architecte d'intérieur, économiste de la construction, maître d'œuvre, géomètre expert ;
- ingénieur conseil ;
- moniteur de ski, guide de haute montagne, accompagnateur de moyenne montagne ;
- ostéopathe, psychologue, psychothérapeute, ergothérapeute, diététicien, chiropracteur, psychomotricien ;
- artiste non affilié à la maison des artistes ;
- expert en automobile, expert devant les tribunaux, mandataire judiciaire à la protection des majeurs ;
- guide-conférencier.

Le périmètre est fixé par l'article L640-1 et la loi 2017-1836. Les autres libéraux non réglementés relèvent de la SSI depuis 2018 en micro-entreprise et depuis 2019 au réel (CNAVPL-25).

**Recouvrement :** l'Urssaf encaisse depuis le 01/01/2023 la retraite de base, la complémentaire et l'invalidité-décès. La CIPAV calcule les points et verse les prestations (CNAVPL-25, CIP-WEB).

#### Au réel

| | 2024 | 2025 | 2026 |
|---|---|---|---|
| Complémentaire, tranche 1 (jusqu'à 1 PASS) | 9 % | **11 %** (D-2025-1076-12) ; 9 % en acompte (CNAVPL-25) | **11 %** (U-CIP26, U-REF ; aucun décret trouvé) ; 9 % selon CIP-PL26, périmée |
| Complémentaire, tranche 2 | 22 % de 1 à 3,5 PASS (CNAVPL-24) | **21 % de 1 à 4 PASS** (D-2025-1076-12 ; bornes : D-79-262) ; 22 % en acompte (CNAVPL-25) | **21 % de 1 à 4 PASS** (U-CIP26, U-REF ; aucun décret trouvé) ; 22 % de 1 à 3 PASS selon CIP-PL26, périmée |
| Complémentaire, minimum | aucun | aucun | aucun (« Pas d'assiette minimale », CIP-PL26) |
| Complémentaire, maximum | — | — | 35 565 € (U-CIP26) |
| Invalidité-décès, taux | 0,5 % | 0,5 % | 0,50 % |
| Invalidité-décès, plafond (1,85 PASS) | 85 781 € | 87 135 € | 88 911 €, soit 445 € au plus |
| Invalidité-décès, assiette minimale (37 % du PASS) | 17 156 € | 17 427 € | 17 782 €, soit 89 € au moins |

**Sources de l'invalidité-décès :**
- CNAVPL-24 et CNAVPL-25 : « Depuis le 1er janvier 2023, la cotisation du régime est proportionnelle aux revenus d'activité ». Les anciennes classes A, B et C ont disparu.
- U-CIP26 donne les montants 2026.
- CNAVPL-24 écrit « 0,37 % PASS » pour l'assiette minimale : c'est une coquille pour 37 %, puisque 17 156 € = 0,37 × 46 368 €.

**Ancienne contradiction C1 : barème de la complémentaire CIPAV pour les revenus 2025 et 2026.**
- **2025 : résolue par le texte.** Décret n° 2025-1076 du 10/11/2025, art. 12 (D-2025-1076-12) : « Pour l'année 2025 […] 11° de l'article R. 641-1 : […] première tranche : 11 % ; […] deuxième tranche : 21 % ; valeur d'achat du point : 47,40 euros ». Le 11° de l'article R. 641-1 est la section de la CIPAV. Les bornes des tranches sont fixées par le décret n° 79-262, art. 2-I (D-79-262) : « une et quatre fois le même plafond à compter de l'exercice 2025 ».
- **2026 : l'Urssaf seule.** U-CIP26 : « 11 % dans la limite de 48 060 € (1 Pass) + 21 % sur la part des revenus comprise entre 48 060 € et 192 240 € (1 et 4 Pass) ». U-REF : « le taux passe de 9 % à 11% pour la part plafonnée et de 22 % à 21 % pour la part dépassant le seuil de 1 plafond annuel ». Aucun décret fixant ces taux pour 2026 n'a été trouvé : l'article 14 du décret 2025-1076, qui porte sur 2026, ne vise pas la CIPAV. Le décret n° 2026-418 du 29/05/2026 et le décret n° 2026-239 existent, mais n'ont **pas été lus** pour la CIPAV.
- **La fiche CIPAV 2026 (CIP-PL26) est périmée** : elle dit encore 9 % puis 22 % jusqu'à 3 PASS, et 8,23 % pour la retraite de base (§4).
- **Retenu (ADR 015) :** 11 % et 21 % en 2025 et en 2026 ; la `description` de 2026 dit que le taux vient de l'Urssaf seule.

**Autres paramètres :**
- Début d'activité 2026 : complémentaire à 11 % sur 9 131 €, soit 1 004 € (U-CIP26).
- Prestations d'invalidité-décès 2026 (CIP-INV26, CIP-PREV26) :
  - pension d'invalidité, versée à partir d'un taux d'invalidité de 66 % : forfait de 5 % du PASS (2 403 €) plus des points ;
  - capital décès : forfait de 15 % du PASS (7 209 €) plus des points ;
  - pendant l'invalidité totale : 4 trimestres assimilés par an.
- Valeur de service du point complémentaire : 2,89 € de 2024 à 2026. Valeur d'achat : 47,40 € en 2025 (D-2025-1076-12) ; 2024 et 2026 **non sourcés** par un texte.

#### En micro-entreprise

| | 2024 | 2025 | 2026 |
|---|---|---|---|
| Taux global sur le chiffre d'affaires | 21,2 % au 01/01, puis 23,2 % au 01/07 | 23,2 % | 23,2 % |
| Libéral SSI, pour comparaison (moteur `servicesBnc`) | 21,1 %, puis 23,1 % | 24,6 % | 25,6 % |
| Versement libératoire (BNC) | 2,2 % | 2,2 % | 2,2 % |
| Formation professionnelle | 0,2 % du CA | 0,2 % du CA | 0,2 % du CA |
| CA pour 1 trimestre / 4 trimestres | non établi (C5) | 2 694 € / 10 776 € | 2 792 € / 11 168 € |
| ACRE (taux réduit) | 12,10 % | 13,9 % | non sourcé |

**Sources :**
- Taux global 2024 : U-ACT, « depuis le 1er juillet 2024, passant de 21,2 % à 23,2 % ».
- Taux global 2025 : CNAVPL-25, « 23,2 % depuis le 1er juillet 2024 ».
- Taux global 2026 : CSS-D613-4 (version du 01/01/2026, décret 2025-943), ligne « affiliés à la section professionnelle mentionnée au 11° de l'article R. 641-1 […] 23,2 % ». AE-ESS le confirme.
- Versement libératoire et formation professionnelle : AE-ESS. La page donne la règle actuelle sans année pour la formation professionnelle.
- Trimestres : CIP-WEB-25, CIP-WEB, AE-ESS.
- ACRE : CNAVPL-24 et CNAVPL-25.

**Répartition du forfait (en part du forfait, utile pour les trimestres et les droits) :**

| Poste | 2025 (CIP-WEB-25) | 2026 (CIP-WEB) |
|---|---|---|
| CSG-CRDS | 34 % | 27 % |
| Maladie | 9,30 % + 0,90 % | 10,60 % |
| Indemnités journalières | — | 0,80 % |
| Retraite de base | 23,45 % + 5,35 % = 28,80 % | 29,50 % (dont 24,30 % + 5,20 %, CIP-AE26) |
| Complémentaire | 25,60 % | 30,70 % |
| Invalidité-décès | 1,40 % | 1,40 % |

**Vérification de cohérence.** Le seuil de CA pour un trimestre se retrouve exactement à partir de ces chiffres. C'est ce que fait déjà `protectionMicro()` avec `partRetraiteDeBaseMicro` et `tauxRetraiteDeBase` :
- 2026 : 1 803 € × 10,60 % / (23,2 % × 29,50 %) = 2 792 €, ce qui correspond à la page CIPAV.
- 2025 : 1 782 € × 10,10 % / (23,2 % × 28,80 %) = 2 694 €. La CIPAV a donc calculé ce seuil au taux des acomptes (8,23 % + 1,87 %).
- Pour la CIPAV en micro, il faudra `partRetraiteDeBaseMicro` = 0,295 et `tauxRetraiteDeBase` = 0,106 en 2026. En 2025, 0,288 et 0,101 reproduisent la page.

**Contradictions en micro :**
- **C4 :** la part de l'invalidité-décès vaut « 2,6 % » dans un paragraphe de CIP-WEB et « 1,40 % » dans sa liste. CIP-AE26 contient les deux, ainsi que des coquilles (« 23,5 % », « PASS 2025 soit 7 209 € »). Comme 1,40 % fait tomber la somme à 100 %, on retient 1,40 %.
- **C5 :** l'Urssaf (AE-ESS-25) présente les seuils 2 694 € comme ceux de « 2024 », la CIPAV comme ceux de 2025. La répartition du forfait 2024 est **non sourcée**.

### 5.2 CARPIMKO

**Professions affiliées :** infirmiers, masseurs-kinésithérapeutes, orthophonistes, orthoptistes, pédicures-podologues.

**Recouvrement :** la caisse appelle elle-même ses cotisations, retraite de base comprise : « La Carpimko calculera l'ensemble de vos cotisations à partir de votre assiette sociale, transmise par les URSSAF » (CARP-BUL). Ce sont la retraite de base, la complémentaire, l'ASV et l'invalidité-décès. La maladie, les allocations familiales, la CSG-CRDS, la formation professionnelle et la CURPS figurent sur les pages de l'Urssaf (U-PAM26, U-AUX).

**Assiette de l'année et régularisation (2026) :**
- Base de calcul (CARP-BUL, tableau « Cotisations en 2026 ») : l'**assiette sociale N-1** pour la retraite de base et la complémentaire ; les **revenus conventionnés N-1** pour l'ASV ; un **forfait** de 1 022 € pour l'invalidité-décès.
- **Seule la retraite de base est régularisée** sur le revenu de l'année. CARP-ADAPT : « il est possible d'anticiper la régularisation annuelle des cotisations du régime de retraite de base et d'adapter le montant de vos prélèvements en déclarant un "revenu estimé" ».
- Pour la complémentaire et l'ASV, aucune source consultée ne mentionne de régularisation. On en **déduit**, du silence des sources et non d'une phrase, qu'elles restent calculées sur N-1.
- **Retenu (ADR 015) :** la retraite de base sur le revenu de l'année simulée ; la complémentaire et l'ASV sur celui de l'année précédente quand elle est dans la session, sinon sur l'année simulée.

| | 2024 | 2025 | 2026 |
|---|---|---|---|
| Retraite de base | 8,23 % + 1,87 % | 8,73 % + 1,87 % (8,23 % en acompte, CARP-BUL) | 8,73 % + 1,87 % (CARP-REV) |
| Complémentaire, part forfaitaire | 2 176 € | 2 312 € | **supprimée** |
| Complémentaire, part proportionnelle | 3 % entre 25 246 € et 224 713 € | 3 % entre 25 246 € et 237 179 € | **8,70 % de l'assiette, bornée entre 0,5 et 3 PASS** (24 030 € à 144 180 €, soit 2 091 € à 12 544 €) |
| ASV, part forfaitaire (praticien + CPAM) | non sourcé | 221 € + 443 € | 224 € + 447 € |
| ASV, part proportionnelle (praticien + CPAM) | non sourcé | 0,16 % + 0,24 % des revenus conventionnés N-2 | 0,16 % + 0,24 % des revenus conventionnés N-1, dans la limite de 5 PASS |
| Invalidité-décès | 1 022 € | 1 022 € | 1 022 € |

**Sources :**
- Complémentaire 2024 : D-2024-1214, art. 6 et 7.
- Complémentaire 2025 : D-2025-1076, art. 12 et 13.
- Complémentaire 2026 : D-2025-1076, art. 14, « taux de la cotisation proportionnelle : 8,7 % ; seuil : 50 % du plafond annuel […] ; plafond : 3 fois le plafond annuel ». Également CARP-REV, CARP-BUL et A-2025-11-14 (nouvel art. 7, « comprise entre un minimum et un maximum »).
- ASV : CARP-REV et CARP-BUL ; plafond de 5 PASS : D-2008-1044, art. 2.
- Invalidité-décès : CARP-ID, due par tous les affiliés depuis le 01/01/2025.

**Contradictions et points à confirmer :**
- Plafond 2025 de la complémentaire : 231 840 € (CARP-BUL) contre 237 179 € (décret). Le décret fait foi.
- Mode de calcul 2024-2025 : le 3 % porte-t-il sur la seule part du revenu comprise entre le seuil et le plafond ? C'est la lecture de « entre 25 246 € et … » dans CARP-BUL, **à confirmer** dans le texte des statuts.
- Dispenses ou réductions de la complémentaire à faible revenu : **non sourcé**.
- Règlements de la CARPIMKO approuvés par l'arrêté du 10/07/2026 (A-2026-07-10) : texte repéré, **non exploité** dans ce dossier.

**Prise en charge par l'Assurance maladie (auxiliaires conventionnés).**
- **2026 (U-PAM26, U-AUX).**
  - Maladie sur les revenus conventionnés : 0 % sous 9 612 € (20 % du PASS), progressif jusqu'à 8,50 % à 144 180 €, puis 6,50 % au-delà. Prise en charge : « Taux progressif : entre 0 % et 8,40 % ».
  - Maladie sur les autres revenus (dépassements, activité non conventionnée) : de 3,25 % à 11,75 %, puis 9,75 % au-delà de 3 PASS.
  - Allocations familiales : barème commun, **sans prise en charge** pour les auxiliaires.
  - La prise en charge porte « uniquement sur vos revenus tirés de l'activité conventionnée nets de dépassements d'honoraires ».
- **2024 (U-PAM24 [archive]).** Taux de 0 à 6,50 % sur les revenus conventionnés, avec une prise en charge de 0 à 6,40 %. Sur les autres revenus, de 3,25 % à 9,75 %.
- **Contradiction des pages de l'Urssaf, non résolue mais interprétée.** Le texte de U-AUX dit encore : « Selon votre revenu, la Cpam peut prendre en charge 6,40 % du montant de votre cotisation : 0,10 % restent à votre charge ». Le tableau de U-PAM26 (et de U-AUX) donne un taux « entre 0 % et 8,50 % » et une prise en charge « Taux progressif : entre 0 % et 8,40 % ». **Lecture retenue :**
  - sur les revenus conventionnés nets de dépassements, tout le barème maladie est pris en charge **sauf 0,10 point**, qui reste au praticien ;
  - le « 6,40 % » du texte est un reste de l'ancien barème, dont le maximum était de 6,50 % (6,50 − 0,10 = 6,40, comme en 2024) ;
  - au-delà de 3 PASS, où le taux retombe à 6,50 %, la prise en charge **n'est écrite nulle part** ;
  - sur les autres revenus, le praticien paie le barème majoré de 3,25 points.

**CURPS (contribution aux unions régionales des professionnels de santé) :**
- U-PAM26, tableaux de l'auxiliaire médical et de la sage-femme : « Contribution aux unions régionales des professionnels de santé (Curps) 0,10 % du revenu d'activité non salarié dans la limite de 240 € pour 2026 ».
- Le plafond est fixé par le code de la santé publique à 0,5 % du PASS (CSP-L4031-4) : 0,5 % × 48 060 € = 240 €.
- Assiette : le revenu tiré de l'activité libérale. Le moteur la calcule sur sa propre assiette, sans boucle sur le revenu imposable.
- **ASV :** la CPAM paie les 2/3 de la part forfaitaire et 60 % de la part proportionnelle, d'après les montants : 447/671 et 0,24/0,40. Le texte de la convention (avenant 2 de la convention infirmière, arrêté du 15/07/2011) n'a été vu qu'en extrait : **non vérifié**.
- **2025 :** les seuils de la page des praticiens et auxiliaires médicaux sont **non sourcés**, aucune version 2025 n'ayant été trouvée. Le barème commun de la réforme s'applique à la régularisation.

**Micro-entreprise :**
- **Interdite.** U-PAMDEV : « En tant que praticien ou auxiliaire médical vous ne pouvez pas être auto-entrepreneur ».
- Cas particulier des pédicures-podologues : ils avaient un droit d'option vers le régime des libéraux, à exercer « d'ici le 31/07/2024 », avec effet au 01/01/2025 (U-AUX).
- Base légale de l'exclusion, et situation d'un auxiliaire non conventionné : **non sourcées**.

**Prestations (CARP-INC) :**
- L'Assurance maladie verse les IJ du 4e au 90e jour. La CARPIMKO verse ensuite une allocation de 55,44 €/jour (2025 et 2026), jusqu'à la fin de la 3e année.
- Rente d'invalidité : 20 160 € par an si elle est totale, 10 080 € si elle est partielle.

---

## 6. Autres caisses : tableau d'orientation (chiffres 2026, sans détail)

| Caisse | Professions | Complémentaire | Invalidité-décès | ASV / PCV | Micro-social | Source |
|---|---|---|---|---|---|---|
| CARMF | médecins | proportionnelle, 11,80 % jusqu'à 3,5 PASS | classes (626 € à 1 010 €) | oui (secteur 1) | non | https://www.carmf.fr/page.php?page=chiffrescles/stats/2026/taux2026.htm |
| CARCDSF | chirurgiens-dentistes, sages-femmes | forfait + 11,35 % entre 0,65 et 5 PASS | forfait (1 235 € pour les dentistes) | oui | non | https://www.carcdsf.fr/cotisations-du-praticien/montant-des-cotisations |
| CAVP | pharmaciens | répartition forfaitaire + classes de capitalisation | forfait (696 €) | biologistes seulement | non | https://www.cavp.fr/media/documents/Fiches-pratiques/2026/Les-cotisations-obligatoires-2026.pdf |
| CARPV | vétérinaires | classes | 3 classes (390 €, 780 €, 1 170 €) | non trouvé | non | https://www.carpv.fr/wp-content/uploads/2026/02/Livret-2026_-fevrier_VD.pdf |
| CAVEC | experts-comptables, commissaires aux comptes | 9 classes (A à I) | classes (288 € à 828 €) | non | non | https://www.cavec.fr/wp-content/uploads/Guide-annuel-retraite-prevoyance.pdf |
| CAVAMAC | agents généraux d'assurance | proportionnelle aux commissions (6,30 %) | 0,57 % ou 0,70 % (contradiction) | non | non | https://www.cavamac.fr/documents/taux-et-assiette-des-cotisations-rco-rid/ |
| CAVOM | commissaires de justice, greffiers des tribunaux de commerce, administrateurs et mandataires judiciaires | proportionnelle, 12,50 % jusqu'à 8 PASS | classes (315 € à 1 890 €) | non | non | https://www.cavom.net/wp-content/uploads/2026/01/Tableaux-recapitulatifs-parametres-RB-RC-RID-2026.pdf |
| CPRN | notaires | classes sur les produits de l'office + section proportionnelle | forfait (1 324 €) | non | non | https://www.cprn.fr/je-suis-affilie/je-suis-actif/mes-cotisations/ |
| CNBF (hors CNAVPL) | avocats | base propre (forfait selon l'ancienneté + 3,20 %) ; complémentaire en 3 classes au choix | — | non | non | https://www.cnbf.fr/wp-content/uploads/2026/01/Bareme-CNBF-2026.01.01.pdf |

- **Micro-social.** SP-F23458 : « le régime micro-social n'est pas applicable dans la plupart des cas. Il est réservé aux professions réglementées relevant de la Cipav ». Le micro-fiscal BNC reste ouvert à tous les libéraux. Le texte qui ouvre le micro-social aux affiliés de la CIPAV n'a pas été consulté (**non sourcé**).
- **Réforme de l'assiette.** La CARPV, la CNBF, la CAVP, la CAVEC et la CARMF mentionnent la nouvelle assiette. La CPRN, la CAVOM et la CAVAMAC calculent leur complémentaire sur les produits ou les commissions, sans changement.
- **Statut de ce tableau.** Ces lignes ont été relevées pour orientation seulement. Il faudra les reprendre caisse par caisse avant de coder.

---

## 7. Formes d'exercice

- **Ordonnance 2023-77, en vigueur au 01/09/2024 (SP-A16510).** Elle vise les professions « soumises à un statut législatif ou réglementaire ou [dont le] titre est protégé ».
  - Formes ouvertes à ces professions : SCP, SPE, SEL (SELARL et SELARLU, SELAS et SELASU, SELAFA, SELCA), SPFPL (SP-F23458).
  - Pour les professions non réglementées : « toutes les formes "classiques" de société ».
- **EURL ou SASU classique pour un ostéopathe, un psychologue, un kinésithérapeute ou un infirmier.** Aucune page officielle consultée ne l'autorise ni ne l'interdit en toutes lettres (**non sourcé**). Le titre des ostéopathes et des psychologues est protégé, ce qui les place dans le champ de l'ordonnance. **À confirmer** auprès des ordres ou de textes propres à chaque profession.
- **Régime social du dirigeant :**
  - CSS-L311-3, 11° : le gérant **minoritaire ou égalitaire** de SARL ou de SELARL est assimilé salarié. Le gérant majoritaire est non salarié. Il relève de la caisse de sa profession : c'est une déduction, pas une citation.
  - CSS-L311-3, 23° : le président de SAS ou de SELAS est assimilé salarié.
  - **Nuance clé**, SP-F31233 (2026) : « L'affiliation au régime général ne s'applique qu'à l'exercice du mandat social ». L'activité libérale relève « du régime des non-salariés, et de la section professionnelle compétente de la Cnavpl ». Le Conseil d'État l'avait jugé (CE-328905, 27/05/2011, n° 328905) : le président de SELAS exerçant sa profession dans la société est « cumulativement affilié » au régime général pour son mandat et à la caisse de sa profession pour son activité libérale.
  - **Fiscalité :** la rémunération technique d'un associé de SEL, c'est-à-dire celle de son activité libérale, relève des BNC depuis l'imposition des revenus 2024 (BOFIP-SEL ; SP-F38455, mise à jour du 21/02/2026). U-NOT26 : « à compter des revenus de l'année 2024, les rémunérations liées à l'activité libérale des associés de SEL à l'IS relèvent des BNC ». Les dividendes sont déclarés en plus.
  - **Conséquence :** pour un professionnel réglementé, la « SASU » du comparateur (en réalité une SELASU) ne fait pas sortir sa rémunération d'activité de sa caisse : elle reste en BNC et cotise à la caisse libérale, même pour le président ; seul le mandat social relève du régime général. L'ADR 015 s'en tient, pour l'instant, à un avertissement ; la modélisation est un chantier ultérieur de la roadmap.
- **Dividendes.** La règle des 10 % (capital, primes et comptes courants) vaut pour tous les indépendants dont la société est à l'IS (CSS-L136-3, II 2°). Il n'y a plus de règle propre aux SEL. Le sort des dividendes d'un président de SELAS exerçant dans la société est **non sourcé**.

---

## 8. Proposition d'implémentation (conception, sans code)

L'[ADR 015](../adr/015-professions-liberales-reglementees.md) a tranché les questions ouvertes de cette proposition. Là où les deux diffèrent (champ enregistré, format de fichier, CURPS, assiette de la CARPIMKO, sociétés), l'ADR fait foi.

1. **Profession sur l'activité.**
   - Ajouter un champ facultatif sur l'entreprise individuelle, la micro-entreprise et la société. L'ADR 015 enregistre la **profession** (`"non-reglementee"` par défaut, calcul actuel), jamais la caisse, qui s'en déduit.
   - Choisir la **profession** dans l'interface plutôt que la caisse : ostéopathe → CIPAV, kinésithérapeute → CARPIMKO… Une table profession → caisse vit dans les règles, ce qui permet aussi d'interdire la micro-entreprise à une profession CARPIMKO.
   - Pour la CARPIMKO, ajouter `conventionne` (oui/non) et la **part des recettes conventionnées sans dépassements** (100 % par défaut).
   - Le champ n'a de sens que pour une activité BNC : micro-entreprise, EI au réel et gérant d'EURL (ADR 015).
   - Format de fichier : le champ étant facultatif, avec « non réglementée » pour défaut, le numéro de format ne change pas (ADR 015, conformément aux ADR 005 et 009).
2. **Règles par année.**
   - Dans chaque fichier de règles, ajouter un bloc `liberauxReglementes` à côté de `TNS`, avec :
     - `commun` : `indemnitesJournalieres` (0,30 % jusqu'à 3 PASS), `retraiteDeBase` (tranches 8,73 % jusqu'à 1 et 1,87 % jusqu'à 5), assiettes minimales ;
     - `maladieMaternite` optionnelle, seulement pour 2024 (ancien barème) ;
     - un sous-bloc par caisse, avec `retraiteComplementaire` et `invaliditeDeces` décrits par un **type de barème** : `tranches` (déjà géré par `parTranches`), `proportionnelBorne` (taux, assiette minimale et maximale en part du PASS), `forfait` (montant), `forfaitPlusTranches`, plus tard `classes` ;
     - `asv` pour la CARPIMKO : forfait, taux, plafond, part prise en charge ;
     - `microEntreprise.cotisationsCipav` (23,2 %) et `partRetraiteDeBaseMicroCipav`.
   - Toutes les valeurs ont leur `description` et leur `source`, comme aujourd'hui. Les montants qui ne reposent que sur l'Urssaf (complémentaire CIPAV 2026) le disent dans la `description`.
3. **Calcul.**
   - `calculerCotisationsTNS` reçoit des règles « effectives ». Une fonction de fusion remplace dans `ReglesTNS` les lignes `indemnitesJournalieres`, `retraiteDeBase`, `retraiteComplementaire`, `invaliditeDeces` et `cotisationsMinimales` par celles de la caisse.
   - Le type `ReglesTNS` doit accepter un minimum pour la complémentaire (CARPIMKO, 0,5 PASS) et un plafond pour l'invalidité-décès (CIPAV, 1,85 PASS). Il doit aussi accepter un forfait (CARPIMKO, 1 022 €), qui n'entre pas dans des tranches.
   - Nouvelles lignes `CotisationTNS` : `asv`, `curps`, et `priseEnChargeAssuranceMaladie` (montant négatif, ou affiché à part).
   - `revenuAvantCotisationsPourUnNet` (gérant d'EURL) reste valable : la fonction reste croissante, mais les forfaits la décalent sans en changer la forme.
   - La CURPS (0,10 %, plafonnée) se calcule sur l'assiette du moteur, comme les autres lignes (§5.2) : pas de calcul circulaire.
   - CARPIMKO : la complémentaire et l'ASV se calculent sur le revenu de l'année précédente quand elle est dans la session (ADR 015).
4. **Micro-entreprise.**
   - `calculerMicro` choisit le taux BNC selon `regimeLiberal` : 23,2 % pour la CIPAV, refus avec avertissement pour la CARPIMKO et les autres caisses.
   - Le comparateur masque les colonnes « micro » et « micro-vfl » quand la profession les interdit. Il les remplace par une note.
   - Formation professionnelle en micro (0,2 % du CA) : modélisée depuis pour tous les micro-entrepreneurs, à part de ce chantier (0,1 % de la vente, 0,2 % des BNC, 0,3 % des BIC).
5. **Trimestres et protection sociale** (`protection-sociale.ts`).
   - `protectionTNS` utilise `revenuParTrimestre` (inchangé : 150 × SMIC horaire) et l'assiette minimale CNAVPL (450 × SMIC horaire, 3 trimestres), qui est déjà la même valeur que la SSI.
   - `protectionMicro` utilise pour la CIPAV `part` = 0,295 et `tauxRetraiteDeBase` = 0,106 en 2026. Cela reproduit exactement le seuil de 2 792 € (§5.1).
   - Les résumés de protection deviennent propres à la caisse :
     - CIPAV : IJ depuis 2021, invalidité-décès proportionnelle.
     - CARPIMKO : IJ de l'Assurance maladie du 4e au 90e jour, puis de la CARPIMKO à partir du 91e jour ; rente d'invalidité forfaitaire.
6. **Sociétés.**
   - Pour une profession réglementée, le comparateur affiche « SELARL » ou « SELAS » à la place de « EURL » ou « SASU », avec un avertissement sur les formes permises.
   - La rémunération d'activité de l'associé de SEL, président de SELAS compris, relève des BNC et de la caisse (§7). L'ADR 015 s'en tient à un avertissement ; la modélisation est un chantier ultérieur.
7. **2024.**
   - Même approximation d'assiette que la SSI 2024.
   - Ancien barème maladie des libéraux réglementés.
   - Micro CIPAV à 21,2 % au 1er janvier (ADR 007, point 4), avec 23,2 % au 01/07/2024 dans la `description`.

**Effort estimé :**

| Point | Effort |
|---|---|
| Champ profession, interface | M |
| Bloc de règles 2024 à 2026, schéma, tests de forme | M |
| Cotisations au réel CIPAV | S |
| Cotisations au réel CARPIMKO, avec prise en charge, ASV et CURPS | M à L |
| Micro CIPAV et interdiction CARPIMKO dans le comparateur | S |
| Trimestres et protection sociale | S |
| SELARL et SELAS (libellés, avertissements) | S ; L si la rémunération BNC du président de SELAS est modélisée |
| Chaque autre caisse | M (classes, forfaits, ASV) |
| Mise à jour de la FAQ, des exports et des outils pour les IA | S |

---

## 9. Cas de test proposés

**Hypothèses communes :**
- France métropolitaine ; pas d'ACRE ; activité sur toute l'année ; pas de conjoint collaborateur ; ni RSA ni prime d'activité.
- PASS 2026 : 48 060 € ; SMIC horaire au 01/01/2026 : 12,02 €.
- Pour le réel, l'assiette est le revenu avant cotisations − 26 %. L'abattement est compris entre 845,86 € et 62 478 € : les bornes ne jouent dans aucun cas.
- Maladie et allocations familiales : barème `maladieMaternite` et `allocationsFamiliales` de `config.json`, déjà sourcés (U-REF).
- La colonne « Moteur actuel » reproduit à la main ce que `calculerCotisationsTNS` donne aujourd'hui pour la même saisie.
- Montants arrondis au centime.

### Cas 1 : ostéopathe en micro-entreprise, 40 000 € de CA en 2026

- Cotisations : 23,2 % × 40 000 = **9 280,00 €** (CSS-D613-4, AE-ESS). Moteur actuel : 25,6 % = 10 240,00 €, soit 960 € de trop.
- Formation professionnelle : 0,2 % = 80,00 € (AE-ESS, modélisée depuis).
- Versement libératoire, s'il est choisi : 2,2 % = 880,00 €.
- Revenu imposable sans versement libératoire : 40 000 × (1 − 34 %) = 26 400 €.
- Trimestres : 40 000 ≥ 11 168 € → **4** (CIP-WEB).

### Cas 2 : ostéopathe en micro-entreprise, 9 000 € de CA en 2026

- Cotisations : 23,2 % × 9 000 = **2 088,00 €** (moteur actuel : 2 304,00 €).
- Trimestres : 9 000 / 2 792 → **3** (moteur actuel, avec part 0,464 et taux 17,87 % : 9 000 × 25,6 % × 0,464 / 17,87 % = 5 983 € de revenu validant, soit 3 trimestres aussi).
- Contrôle du seuil : 2 792 × 23,2 % × 29,5 % / 10,6 % = 1 802,7 €, soit environ 1 803 €.

### Cas 3 : psychologue en EI au réel, 25 000 € de bénéfice avant cotisations en 2026 (CIPAV)

Assiette : 25 000 − 6 500 = **18 500 €**, soit 0,38493 PASS.

| Ligne | Calcul | Libéral CIPAV | Moteur actuel (SSI) |
|---|---|---|---|
| Maladie | taux 1,5 % × (0,38493 − 0,2) / 0,2 = 1,38698 % × 18 500 | 256,60 | 256,60 |
| Indemnités journalières | 0,30 % × 19 224 (minimum) | 57,67 | 0,5 % × 19 224 = 96,12 |
| Allocations familiales | sous 110 % du PASS | 0,00 | 0,00 |
| Retraite de base | (8,73 % + 1,87 %) × 18 500 | 1 961,00 | 17,87 % × 18 500 = 3 305,95 |
| Complémentaire | 11 % × 18 500 (Urssaf) | 2 035,00 (1 665,00 au barème périmé de la fiche CIPAV, 9 %) | 8,1 % × 18 500 = 1 498,50 |
| Invalidité-décès | 0,5 % × 18 500 (au-dessus du minimum de 17 782) | 92,50 | 1,3 % × 18 500 = 240,50 |
| CSG-CRDS | 9,7 % × 18 500 | 1 794,50 | 1 794,50 |
| Formation professionnelle | 0,25 % × 48 060 | 120,15 | 120,15 |
| **Total** | | **6 317,42** (5 947,42 au barème périmé de la fiche) | **7 312,32** |

Trimestres : 18 500 / 1 803 → 4.

Sources : U-CIP26, CSS-D642-3, CSS-D621-3, U-REF.

### Cas 4 : architecte en EI au réel, 120 000 € de bénéfice avant cotisations en 2026 (CIPAV)

Assiette : 120 000 − 31 200 = **88 800 €**, soit 1,84769 PASS.

| Ligne | Calcul | Libéral CIPAV | Moteur actuel |
|---|---|---|---|
| Maladie | (6,5 % + 1,2 % × 0,74769 / 0,9 = 7,49692 %) × 88 800 | 6 657,27 | 6 657,27 |
| Indemnités journalières | 0,30 % × 88 800 | 266,40 | 0,5 % = 444,00 |
| Allocations familiales | 3,1 % × 88 800 | 2 752,80 | 2 752,80 |
| Retraite de base | 8,73 % × 48 060 + 1,87 % × 88 800 | 5 856,20 | 17,87 % × 48 060 + 0,72 % × 40 740 = 8 881,65 |
| Complémentaire | 11 % × 48 060 + 21 % × 40 740 | 13 842,00 (13 288,20 au barème périmé de la fiche : 9 % et 22 %) | 8,1 % × 48 060 + 9,1 % × 40 740 = 7 600,20 |
| Invalidité-décès | 0,5 % × 88 800 (sous le plafond de 88 911) | 444,00 | 1,3 % × 48 060 = 624,78 |
| CSG-CRDS | 9,7 % × 88 800 | 8 613,60 | 8 613,60 |
| Formation professionnelle | | 120,15 | 120,15 |
| **Total** | | **38 552,41** (37 998,61) | **35 694,45** |

Ce cas montre que le moteur actuel **sous-estime** les cotisations CIPAV à haut revenu, alors qu'il les surestime à bas revenu (cas 3). Il montre aussi que le barème périmé de la fiche CIPAV (9 % et 22 %) donnerait 554 € de moins à ce niveau de revenu.

### Cas 5 : kinésithérapeute conventionné en EI au réel, 60 000 € de bénéfice avant cotisations en 2026 (CARPIMKO)

Hypothèses : 100 % de recettes conventionnées sans dépassement ; revenu 2025 identique, pour les cotisations calculées sur N-1.

Assiette : 60 000 − 15 600 = **44 400 €**, soit 0,92384 PASS.

| Ligne | Calcul | À la charge du kiné | Part de la CPAM |
|---|---|---|---|
| Maladie | barème : (4 % + 2,5 % × 0,32384 / 0,5 = 5,6192 %) × 44 400 = 2 494,94 ; reste au praticien 0,10 % (lecture retenue, §5.2) | 44,40 | 2 450,54 |
| Indemnités journalières | 0,30 % × 44 400 | 133,20 | |
| Allocations familiales | sous 110 % du PASS | 0,00 | |
| Retraite de base | 10,60 % × 44 400 | 4 706,40 | |
| Complémentaire | 8,70 % × 44 400 (entre 24 030 et 144 180) | 3 862,80 | |
| ASV | 224 + 0,16 % × 44 400 | 295,04 | 447 + 0,24 % × 44 400 = 553,56 |
| Invalidité-décès | forfait | 1 022,00 | |
| CSG-CRDS | 9,7 % × 44 400 | 4 306,80 | |
| Formation professionnelle | | 120,15 | |
| **Total hors CURPS** | | **14 490,79** | 3 004,10 |
| CURPS | 0,10 % × 44 400 (sous le plafond de 240 €) | 44,40 | |

Moteur actuel pour la même saisie (SSI) : **19 251,77 €**, dont 2 494,94 de maladie, 222,00 d'IJ, 7 934,28 de retraite de base, 3 596,40 de complémentaire et 577,20 d'invalidité-décès. Il surestime donc de près de 4 760 €.

Sources : CARP-REV, CARP-BUL, D-2025-1076, U-PAM26, U-AUX.

### Cas 6 : infirmière conventionnée en EI au réel, 20 000 € de bénéfice avant cotisations en 2026 (CARPIMKO)

Assiette : **14 800 €**, soit 0,30795 PASS.

| Ligne | Calcul | À sa charge |
|---|---|---|
| Maladie | barème : 0,80955 % × 14 800 = 119,82 ; reste au praticien 0,10 % (lecture retenue, §5.2) | 14,80 |
| Indemnités journalières | 0,30 % × 19 224 (minimum) | 57,67 |
| Retraite de base | 10,60 % × 14 800 | 1 568,80 |
| Complémentaire | 8,70 % × 24 030 (**minimum**) | 2 090,61 |
| ASV | 224 + 0,16 % × 14 800 | 247,68 |
| Invalidité-décès | forfait | 1 022,00 |
| CSG-CRDS | 9,7 % × 14 800 | 1 435,60 |
| Formation professionnelle | | 120,15 |
| **Total** | | **6 557,31** (moteur actuel : 5 807,65) |

Ce cas montre le poids des minimums de la CARPIMKO, au contraire du cas 5 : le moteur **sous-estime** ici.

### Cas 7 : psychologue en micro-entreprise, 30 000 € de CA en 2025 (CIPAV)

- Cotisations : 23,2 % × 30 000 = **6 960,00 €** (CNAVPL-25). Moteur actuel : 24,6 % = 7 380,00 €.
- Trimestres : 30 000 ≥ 10 776 € → 4 (CIP-WEB-25).

### Cas 8 : kinésithérapeute qui choisit « micro-entreprise »

Le résultat attendu est un **refus**, avec un avertissement : « En tant que praticien ou auxiliaire médical vous ne pouvez pas être auto-entrepreneur » (U-PAMDEV). Le comparateur ne propose pas de colonne micro.

---

## 10. Brouillon de décision

Le brouillon qui figurait ici est devenu l'[ADR 015 : professions libérales réglementées](../adr/015-professions-liberales-reglementees.md). Elle tranche les six questions laissées au propriétaire (§11) :

1. complémentaire CIPAV à 11 % et 21 % (2025 par décret, 2026 par l'Urssaf seule, ce que la `description` dit) ;
2. CARPIMKO cotisation par cotisation : la retraite de base sur le revenu de l'année simulée, la complémentaire et l'ASV sur celui de l'année précédente quand elle est dans la session ;
3. saisie de la **profession**, jamais de la caisse, pour les seules activités BNC, « Non réglementée » par défaut ;
4. sociétés d'exercice libéral : un avertissement d'abord, la modélisation plus tard ;
5. formation professionnelle en micro : corrigée à part, pour tous les micro-entrepreneurs ;
6. CURPS et part conventionnée modélisées dès la première version de la CARPIMKO.

---

## 11. Non sourcé, incertain, à trancher

**Non sourcé ou incertain :**
- **Complémentaire CIPAV 2026 :** 11 % et 21 % jusqu'à 4 PASS, sourcés par l'Urssaf seule (U-CIP26, U-REF). Aucun décret trouvé pour 2026 : l'art. 14 du décret 2025-1076 ne vise pas la CIPAV ; les décrets n° 2026-418 du 29/05/2026 et n° 2026-239 n'ont pas été lus pour la CIPAV. Pour 2025, le barème est fixé par le décret 2025-1076, art. 12 (§5.1) : ce n'est plus une contradiction.
- Valeur d'achat du point CIPAV : 47,40 € sourcée pour 2025 seulement ; 2024 et 2026 non sourcées.
- Montant 2025 de la cotisation minimale de retraite de base au taux de régularisation ; cotisation maximale des IJ en 2025 ; formation professionnelle avec un conjoint collaborateur en 2025.
- CIPAV : répartition du forfait micro en 2024, seuil de trimestre en micro en 2024 (C5), ACRE micro en 2026.
- CARPIMKO :
  - ASV 2024 ;
  - mode exact du 3 % de 2024-2025 (seuil et plafond) ;
  - dispenses de la complémentaire à faible revenu ;
  - absence de régularisation de la complémentaire et de l'ASV : **déduite du silence des sources**, aucune phrase ne l'écrit (seule la retraite de base est dite régularisée, CARP-ADAPT) ;
  - texte de la prise en charge de l'ASV (2/3 et 60 %) ;
  - prise en charge maladie : les pages de l'Urssaf restent contradictoires (« 6,40 % […] 0,10 % restent à votre charge » contre un tableau « entre 0 % et 8,40 % »). La contradiction n'est pas résolue, mais **interprétée** (§5.2) : tout le barème est pris en charge sauf 0,10 point sur les revenus conventionnés nets de dépassements. Au-delà de 3 PASS, la prise en charge n'est écrite nulle part ;
  - seuils 2025 de la page des praticiens et auxiliaires médicaux ;
  - règlements approuvés par l'arrêté du 10/07/2026 (A-2026-07-10) : repérés, non exploités.
- **CURPS :** sourcée (U-PAM26, CSP-L4031-4) : 0,10 % du revenu d'activité non salarié des auxiliaires médicaux et des sages-femmes, plafonnée à 240 € en 2026 (0,5 % du PASS).
- Base légale de l'interdiction de la micro-entreprise pour les praticiens et auxiliaires médicaux, et du micro-social des affiliés de la CIPAV.
- EURL ou SASU classique pour les ostéopathes, psychologues, kinésithérapeutes et infirmiers ; dividendes d'un président de SELAS. Le rattachement de la rémunération technique d'un associé de SEL aux BNC et à la caisse libérale, président de SELAS compris, est en revanche sourcé (§7).
- Le tableau des autres caisses (§6) est indicatif : il doit être revérifié caisse par caisse.

**Hors de ce chantier, constaté en chemin :**
- **Formation professionnelle en micro-entreprise :** 0,1 % du chiffre d'affaires pour les commerçants, 0,2 % pour les libéraux, 0,3 % pour les artisans (CT-L6331-48 ; AE-ESS). Corrigée depuis à part, pour tous les micro-entrepreneurs (0,1 % de la vente, 0,2 % des BNC, 0,3 % des BIC), hors de l'ADR 015.

**Tranché par le propriétaire :** les six questions qui figuraient ici le sont dans l'ADR 015 (résumé au §10).
