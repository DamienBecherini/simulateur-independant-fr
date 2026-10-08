# Professions libérales réglementées et leurs caisses : dossier de règles (phase 14 bis)

- **Date :** 2026-10-08 (toutes les pages citées ont été consultées ce jour-là)
- **Statut :** recherche, rien n'est codé
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
   - Au réel, tout est proportionnel au revenu. Complémentaire à 11 % puis 21 % jusqu'à 4 PASS d'après l'Urssaf ; la fiche CIPAV dit encore 9 % puis 22 %, ce qui reste **à confirmer**. Invalidité-décès à 0,5 % entre 37 % et 185 % du PASS.
   - En micro-entreprise, le taux global est de **23,2 %** (2025 et 2026), contre 25,6 % pour un libéral SSI en 2026.
4. **CARPIMKO.**
   - La micro-entreprise est **interdite** aux praticiens et auxiliaires médicaux (Urssaf).
   - En 2026, la complémentaire devient proportionnelle : 8,70 % entre 0,5 et 3 PASS, ce qui fait un minimum d'environ 2 091 €.
   - L'invalidité-décès est un forfait de 1 022 €.
   - L'ASV coûte au praticien 224 € plus 0,16 %, le reste étant payé par la CPAM.
   - Les cotisations minimales pèsent lourd à faible revenu.
5. **Sociétés.**
   - Les professions réglementées exercent en société d'exercice libéral (SELARL, SELAS…).
   - Pour un **associé de SEL à l'IS**, les rémunérations de l'activité libérale relèvent des BNC à compter des revenus 2024 (notice Urssaf 2026). Le président de SELAS n'est assimilé salarié **que pour son mandat social**. Cela change la colonne « SASU » du comparateur pour ces professions (**à confirmer** et à trancher, voir §8).

---

## 2. Sources

| Réf. | Page | Contenu |
|---|---|---|
| U-CIP26 | https://www.urssaf.fr/accueil/outils-documentation/taux-baremes/taux-cotisations-plr-cipav.html (mise à jour du 27/02/2026) | Taux 2026, libéraux réglementés CIPAV |
| U-PLR26 | https://www.urssaf.fr/accueil/outils-documentation/taux-baremes/taux-cotisations-plr-hors-cipav.html (mise à jour du 27/02/2026) | Taux 2026, libéraux réglementés hors CIPAV |
| U-PLR24 | https://web.archive.org/web/20250220162136/https://www.urssaf.fr/accueil/outils-documentation/taux-baremes/taux-cotisations-plr-hors-cipav.html **[archive]** | Taux 2024 (la capture de février 2025 montre encore 2024) |
| U-REF | https://www.urssaf.fr/accueil/independant/comprendre-payer-cotisations/reforme-cotisations-independants.html (mise à jour du 07/05/2026) | Réforme de l'assiette, champ et nouveaux taux |
| U-PAM26 | https://www.urssaf.fr/accueil/outils-documentation/taux-baremes/taux-cotisations-pam.html | Taux 2026 des praticiens et auxiliaires médicaux |
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
| CARP-ID | https://www.carpimko.com/je-suis-en-activite/ma-prevoyance/cotisation-invalidite-deces | Invalidité-décès |
| CARP-INC | https://www.carpimko.com/je-suis-en-activite/ma-prevoyance/incapacite-ou-dinvalidite | Prestations |
| D-2024-1214 | https://www.legifrance.gouv.fr/jorf/id/JORFTEXT000050854329 | Paramètres CARPIMKO 2024 |
| D-2025-1076 | https://www.legifrance.gouv.fr/jorf/id/JORFTEXT000052565475 | Paramètres CARPIMKO 2025 et 2026 |
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
- **Exception : la CURPS.** Elle est assise sur le revenu retenu pour l'impôt sur le revenu, pas sur l'assiette sociale (U-CURPS).

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
| CURPS (santé) | — | 0,10 % pour les auxiliaires médicaux, plafonnée à 240 € en 2026 (232 € en 2024), assise sur le revenu imposable | U-CURPS ; U-PAM24 |

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
| Complémentaire, tranche 1 (jusqu'à 1 PASS) | 9 % | 9 % (CNAVPL-25) **ou 11 %** à la régularisation (U-REF) | **11 %** (U-CIP26) ; 9 % selon CIP-PL26 |
| Complémentaire, tranche 2 | 22 % de 1 à 3,5 PASS (CNAVPL-24) | 22 % de 1 à 4 PASS (CNAVPL-25) **ou 21 %** (U-REF) | **21 % de 1 à 4 PASS** (U-CIP26) ; 22 % de 1 à 3 PASS selon CIP-PL26 |
| Complémentaire, minimum | aucun | aucun | aucun (« Pas d'assiette minimale », CIP-PL26) |
| Complémentaire, maximum | — | — | 35 565 € (U-CIP26) |
| Invalidité-décès, taux | 0,5 % | 0,5 % | 0,50 % |
| Invalidité-décès, plafond (1,85 PASS) | 85 781 € | 87 135 € | 88 911 €, soit 445 € au plus |
| Invalidité-décès, assiette minimale (37 % du PASS) | 17 156 € | 17 427 € | 17 782 €, soit 89 € au moins |

**Sources de l'invalidité-décès :**
- CNAVPL-24 et CNAVPL-25 : « Depuis le 1er janvier 2023, la cotisation du régime est proportionnelle aux revenus d'activité ». Les anciennes classes A, B et C ont disparu.
- U-CIP26 donne les montants 2026.
- CNAVPL-24 écrit « 0,37 % PASS » pour l'assiette minimale : c'est une coquille pour 37 %, puisque 17 156 € = 0,37 × 46 368 €.

**Contradiction C1 (la plus structurante) : barème de la complémentaire CIPAV pour les revenus 2025 et 2026.**
- L'Urssaf (U-REF, U-CIP26) applique 11 % puis 21 % jusqu'à 4 PASS « à compter de la déclaration de vos revenus 2025, en 2026 ».
- La fiche CIPAV 2026 (CIP-PL26) dit encore 9 % puis 22 % jusqu'à 3 PASS.
- **Proposition :** retenir l'Urssaf, qui recouvre la cotisation, et le signaler dans la `description`. Le texte réglementaire (décret fixant le barème de la complémentaire CIPAV) n'a **pas été trouvé** : il est **à confirmer** avant de coder.

**Autres paramètres :**
- Début d'activité 2026 : complémentaire à 11 % sur 9 131 €, soit 1 004 € (U-CIP26).
- Prestations d'invalidité-décès 2026 (CIP-INV26, CIP-PREV26) :
  - pension d'invalidité, versée à partir d'un taux d'invalidité de 66 % : forfait de 5 % du PASS (2 403 €) plus des points ;
  - capital décès : forfait de 15 % du PASS (7 209 €) plus des points ;
  - pendant l'invalidité totale : 4 trimestres assimilés par an.
- Valeur de service du point complémentaire : 2,89 € de 2024 à 2026. Valeur d'achat : 47,40 € en 2025 et 2026 ; 2024 **non sourcé**.

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

**Recouvrement :** la caisse recouvre elle-même la retraite de base, la complémentaire, l'ASV et l'invalidité-décès ; l'Urssaf recouvre la maladie, les allocations familiales, la CSG-CRDS, la formation professionnelle et la CURPS. Ce partage est **à confirmer** : il se déduit de CARP-BUL, aucune phrase ne l'écrit.

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
- Assiette de l'année : CARP-BUL indique que les cotisations 2026 sont calculées sur « l'assiette sociale N-1 ». Reste à vérifier s'il y a une régularisation sur le revenu de l'année (**à confirmer**). Pour le moteur, la proposition est de calculer sur le revenu de l'année simulée, comme pour la SSI (voir §8).

**Prise en charge par l'Assurance maladie (auxiliaires conventionnés).**
- **2026 (U-PAM26, U-AUX).**
  - Maladie sur les revenus conventionnés : 0 % sous 9 612 € (20 % du PASS), progressif jusqu'à 8,50 % à 144 180 €, puis 6,50 % au-delà. Prise en charge : « Taux progressif : entre 0 % et 8,40 % ».
  - Maladie sur les autres revenus (dépassements, activité non conventionnée) : de 3,25 % à 11,75 %, puis 9,75 % au-delà de 3 PASS.
  - Allocations familiales : barème commun, **sans prise en charge** pour les auxiliaires.
  - La prise en charge porte « uniquement sur vos revenus tirés de l'activité conventionnée nets de dépassements d'honoraires ».
- **2024 (U-PAM24 [archive]).** Taux de 0 à 6,50 % sur les revenus conventionnés, avec une prise en charge de 0 à 6,40 %. Sur les autres revenus, de 3,25 % à 9,75 %.
- **Incohérence.** Le texte de U-AUX dit encore « la Cpam peut prendre en charge 6,40 % … 0,10 % restent à votre charge », alors que son tableau dit « 0 % à 8,40 % ». La lecture la plus simple, **à confirmer**, est la suivante :
  - sur les revenus conventionnés, le praticien paie 0,10 point de la maladie, et la CPAM le reste ;
  - sur les autres revenus, il paie le barème majoré de 3,25 points.
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
  - **Nuance clé**, SP-F31233 (2026) : le régime d'assimilé salarié « ne s'applique qu'à l'exercice du mandat social ». L'activité libérale relève « du régime des non-salariés, et de la section professionnelle compétente de la Cnavpl ».
  - U-NOT26 : « à compter des revenus de l'année 2024, les rémunérations liées à l'activité libérale des associés de SEL à l'IS relèvent des BNC ». Les dividendes sont déclarés en plus.
  - **Conséquence :** pour un professionnel réglementé, la « SASU » du comparateur (en réalité une SELASU) ne fait pas sortir sa rémunération d'activité de sa caisse. Ce point est **à confirmer** et à trancher (§9).
- **Dividendes.** La règle des 10 % (capital, primes et comptes courants) vaut pour tous les indépendants dont la société est à l'IS (CSS-L136-3, II 2°). Il n'y a plus de règle propre aux SEL. Le sort des dividendes d'un président de SELAS exerçant dans la société est **non sourcé**.

---

## 8. Proposition d'implémentation (conception, sans code)

1. **Profession sur l'activité.**
   - Ajouter un champ `regimeLiberal` sur l'entreprise individuelle, la micro-entreprise et la société. Valeurs : `"non-reglemente"` (par défaut, calcul actuel), `"cipav"`, `"carpimko"`, puis les autres caisses.
   - Choisir la **profession** dans l'interface plutôt que la caisse : ostéopathe → CIPAV, kinésithérapeute → CARPIMKO… Une table profession → caisse vit dans les règles, ce qui permet aussi d'interdire la micro-entreprise à une profession CARPIMKO.
   - Pour la CARPIMKO, ajouter `conventionne` (oui/non) et la **part des recettes conventionnées sans dépassements** (100 % par défaut).
   - Le champ n'a de sens que pour une activité BNC : c'est à valider pour un gérant d'EURL dont l'activité est libérale.
   - Format de fichier suivant (`FORMAT_VERSION_ACTUEL` 3 → 4) : la migration pose `"non-reglemente"` partout, conformément à l'ADR 005.
2. **Règles par année.**
   - Dans chaque fichier de règles, ajouter un bloc `liberauxReglementes` à côté de `TNS`, avec :
     - `commun` : `indemnitesJournalieres` (0,30 % jusqu'à 3 PASS), `retraiteDeBase` (tranches 8,73 % jusqu'à 1 et 1,87 % jusqu'à 5), assiettes minimales ;
     - `maladieMaternite` optionnelle, seulement pour 2024 (ancien barème) ;
     - un sous-bloc par caisse, avec `retraiteComplementaire` et `invaliditeDeces` décrits par un **type de barème** : `tranches` (déjà géré par `parTranches`), `proportionnelBorne` (taux, assiette minimale et maximale en part du PASS), `forfait` (montant), `forfaitPlusTranches`, plus tard `classes` ;
     - `asv` pour la CARPIMKO : forfait, taux, plafond, part prise en charge ;
     - `microEntreprise.cotisationsCipav` (23,2 %) et `partRetraiteDeBaseMicroCipav`.
   - Toutes les valeurs ont leur `description` et leur `source`, comme aujourd'hui. Les montants contradictoires (C1) sont documentés dans la `description`.
3. **Calcul.**
   - `calculerCotisationsTNS` reçoit des règles « effectives ». Une fonction de fusion remplace dans `ReglesTNS` les lignes `indemnitesJournalieres`, `retraiteDeBase`, `retraiteComplementaire`, `invaliditeDeces` et `cotisationsMinimales` par celles de la caisse.
   - Le type `ReglesTNS` doit accepter un minimum pour la complémentaire (CARPIMKO, 0,5 PASS) et un plafond pour l'invalidité-décès (CIPAV, 1,85 PASS). Il doit aussi accepter un forfait (CARPIMKO, 1 022 €), qui n'entre pas dans des tranches.
   - Nouvelles lignes `CotisationTNS` : `asv`, `curps`, et `priseEnChargeAssuranceMaladie` (montant négatif, ou affiché à part).
   - `revenuAvantCotisationsPourUnNet` (gérant d'EURL) reste valable : la fonction reste croissante, mais les forfaits la décalent sans en changer la forme.
   - La CURPS dépend du revenu imposable : elle est calculée après coup, sur une approximation du revenu imposable, en le signalant.
4. **Micro-entreprise.**
   - `calculerMicro` choisit le taux BNC selon `regimeLiberal` : 23,2 % pour la CIPAV, refus avec avertissement pour la CARPIMKO et les autres caisses.
   - Le comparateur masque les colonnes « micro » et « micro-vfl » quand la profession les interdit. Il les remplace par une note.
   - Formation professionnelle en micro (0,2 % du CA) : elle n'est modélisée pour aucun micro-entrepreneur aujourd'hui. C'est un chantier séparé, à décider.
5. **Trimestres et protection sociale** (`protection-sociale.ts`).
   - `protectionTNS` utilise `revenuParTrimestre` (inchangé : 150 × SMIC horaire) et l'assiette minimale CNAVPL (450 × SMIC horaire, 3 trimestres), qui est déjà la même valeur que la SSI.
   - `protectionMicro` utilise pour la CIPAV `part` = 0,295 et `tauxRetraiteDeBase` = 0,106 en 2026. Cela reproduit exactement le seuil de 2 792 € (§5.1).
   - Les résumés de protection deviennent propres à la caisse :
     - CIPAV : IJ depuis 2021, invalidité-décès proportionnelle.
     - CARPIMKO : IJ de l'Assurance maladie du 4e au 90e jour, puis de la CARPIMKO à partir du 91e jour ; rente d'invalidité forfaitaire.
6. **Sociétés.**
   - Pour une profession réglementée, le comparateur affiche « SELARL » ou « SELAS » à la place de « EURL » ou « SASU », avec un avertissement sur les formes permises.
   - La question de la rémunération d'activité du président de SELAS, qui relève des BNC, est à trancher (§9) avant de modifier la colonne.
7. **2024.**
   - Même approximation d'assiette que la SSI 2024.
   - Ancien barème maladie des libéraux réglementés.
   - Micro CIPAV à 21,2 % au 1er janvier (ADR 007, point 4), avec 23,2 % au 01/07/2024 dans la `description`.

**Effort estimé :**

| Point | Effort |
|---|---|
| Champ profession, migration du format, interface | M |
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
- Formation professionnelle : 0,2 % = 80,00 € (AE-ESS, non modélisée).
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
| Complémentaire | 11 % × 18 500 (Urssaf) | 2 035,00 (1 665,00 au barème de la fiche CIPAV, 9 %) | 8,1 % × 18 500 = 1 498,50 |
| Invalidité-décès | 0,5 % × 18 500 (au-dessus du minimum de 17 782) | 92,50 | 1,3 % × 18 500 = 240,50 |
| CSG-CRDS | 9,7 % × 18 500 | 1 794,50 | 1 794,50 |
| Formation professionnelle | 0,25 % × 48 060 | 120,15 | 120,15 |
| **Total** | | **6 317,42** (5 947,42 au barème de la fiche) | **7 312,32** |

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
| Complémentaire | 11 % × 48 060 + 21 % × 40 740 | 13 842,00 (13 288,20 au barème de la fiche : 9 % et 22 %) | 8,1 % × 48 060 + 9,1 % × 40 740 = 7 600,20 |
| Invalidité-décès | 0,5 % × 88 800 (sous le plafond de 88 911) | 444,00 | 1,3 % × 48 060 = 624,78 |
| CSG-CRDS | 9,7 % × 88 800 | 8 613,60 | 8 613,60 |
| Formation professionnelle | | 120,15 | 120,15 |
| **Total** | | **38 552,41** (37 998,61) | **35 694,45** |

Ce cas montre que le moteur actuel **sous-estime** les cotisations CIPAV à haut revenu, alors qu'il les surestime à bas revenu (cas 3). Il montre aussi que la contradiction C1 pèse 554 € à ce niveau de revenu.

### Cas 5 : kinésithérapeute conventionné en EI au réel, 60 000 € de bénéfice avant cotisations en 2026 (CARPIMKO)

Hypothèses : 100 % de recettes conventionnées sans dépassement ; revenu 2025 identique, pour les cotisations calculées sur N-1.

Assiette : 60 000 − 15 600 = **44 400 €**, soit 0,92384 PASS.

| Ligne | Calcul | À la charge du kiné | Part de la CPAM |
|---|---|---|---|
| Maladie | barème : (4 % + 2,5 % × 0,32384 / 0,5 = 5,6192 %) × 44 400 = 2 494,94 ; reste au praticien 0,10 % (**à confirmer**, §5.2) | 44,40 | 2 450,54 |
| Indemnités journalières | 0,30 % × 44 400 | 133,20 | |
| Allocations familiales | sous 110 % du PASS | 0,00 | |
| Retraite de base | 10,60 % × 44 400 | 4 706,40 | |
| Complémentaire | 8,70 % × 44 400 (entre 24 030 et 144 180) | 3 862,80 | |
| ASV | 224 + 0,16 % × 44 400 | 295,04 | 447 + 0,24 % × 44 400 = 553,56 |
| Invalidité-décès | forfait | 1 022,00 | |
| CSG-CRDS | 9,7 % × 44 400 | 4 306,80 | |
| Formation professionnelle | | 120,15 | |
| **Total hors CURPS** | | **14 490,79** | 3 004,10 |
| CURPS | 0,10 % × revenu imposable : environ 60 000 − 14 490,79 + 2,9 % × 44 400 = 46 797 € | environ 46,80 | |

Moteur actuel pour la même saisie (SSI) : **19 251,77 €**, dont 2 494,94 de maladie, 222,00 d'IJ, 7 934,28 de retraite de base, 3 596,40 de complémentaire et 577,20 d'invalidité-décès. Il surestime donc de près de 4 760 €.

Sources : CARP-REV, CARP-BUL, D-2025-1076, U-PAM26, U-AUX, U-CURPS.

### Cas 6 : infirmière conventionnée en EI au réel, 20 000 € de bénéfice avant cotisations en 2026 (CARPIMKO)

Assiette : **14 800 €**, soit 0,30795 PASS.

| Ligne | Calcul | À sa charge |
|---|---|---|
| Maladie | barème : 0,80955 % × 14 800 = 119,82 ; reste au praticien 0,10 % (à confirmer) | 14,80 |
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

### ADR-0XX : Professions libérales réglementées et caisses de la CNAVPL

- **Date :** à fixer
- **Statut :** Proposé

#### Contexte

Toute activité BNC est aujourd'hui calculée comme une profession libérale non réglementée relevant de la SSI (`cotisationsTNS.ts`, taux micro `servicesBnc`). Pour un affilié de la CNAVPL, plusieurs lignes diffèrent : les indemnités journalières, la retraite de base, la retraite complémentaire, l'invalidité-décès, la micro-entreprise et, pour les auxiliaires médicaux conventionnés, la prise en charge de l'Assurance maladie.

Sur les cas calculés à la main (§9), le moteur actuel se trompe de −2 900 € (architecte CIPAV à 120 000 €, sous-estimé) à +4 800 € par an (kinésithérapeute conventionné à 60 000 €, surestimé). La maladie, les allocations familiales, la CSG-CRDS, la formation professionnelle et l'assiette (abattement de 26 %) sont communes à tous les indépendants à partir des revenus de 2025.

#### Décision

1. Chaque activité porte une profession, qui mène à une caisse. Le défaut est « non réglementée », ce qui garde le calcul actuel. Le format de fichier passe à la version suivante, avec une migration.
2. Les fichiers de règles par année reçoivent un bloc `liberauxReglementes` : des lignes communes à la CNAVPL et un sous-bloc par caisse, dont les barèmes sont typés (tranches, proportionnel borné, forfait, classes). Le calcul au réel réutilise `calculerCotisationsTNS` sur des règles fusionnées.
3. On implémente d'abord la CIPAV (réel et micro), puis la CARPIMKO (réel, avec les conventionnés). Les autres caisses viennent ensuite, une par une, chacune avec ses sources.
4. Selon l'ADR 007, l'année d'une règle est l'année des revenus. On retient le barème de régularisation : 8,73 % pour la retraite de base dès 2025. En cas de contradiction entre la caisse et l'Urssaf, on retient la source qui recouvre la cotisation (l'Urssaf pour la CIPAV), et la `description` le dit.
5. La micro-entreprise est refusée pour les professions qui ne peuvent pas y accéder. Le comparateur l'indique au lieu d'afficher une colonne fausse.

#### Conséquences

- **Positives :**
  - Des cotisations justes pour les professions les plus nombreuses.
  - Le moteur actuel est réutilisé, et les sources restent dans les fichiers de règles.
  - Les trimestres en micro CIPAV retombent exactement sur les seuils publiés.
- **Négatives ou compromis :**
  - Le schéma des règles grossit : forfaits, minimums de la complémentaire, plafond de l'invalidité-décès.
  - Il faut une saisie de plus (profession, conventionnement, part conventionnée).
  - Il reste des incertitudes (C1, prise en charge maladie, CARPIMKO calculée sur N-1).
  - Les autres caisses restent approchées tant qu'elles ne sont pas codées.
  - La rémunération du président de SELAS reste un point ouvert.

---

## 11. Non sourcé, incertain, à trancher

**Non sourcé ou incertain :**
- **C1, complémentaire CIPAV pour les revenus 2025 et 2026 :** 11 % et 21 % jusqu'à 4 PASS selon l'Urssaf, contre 9 % et 22 % (jusqu'à 3 ou 4 PASS) selon la CIPAV et la CNAVPL. Le texte réglementaire n'a pas été trouvé.
- Montant 2025 de la cotisation minimale de retraite de base au taux de régularisation ; cotisation maximale des IJ en 2025 ; formation professionnelle avec un conjoint collaborateur en 2025.
- CIPAV : répartition du forfait micro en 2024, seuil de trimestre en micro en 2024 (C5), ACRE micro en 2026, valeur d'achat du point en 2024.
- CARPIMKO :
  - ASV 2024 ;
  - mode exact du 3 % de 2024-2025 (seuil et plafond) ;
  - dispenses de la complémentaire à faible revenu ;
  - assiette N-1 et régularisation ;
  - texte de la prise en charge (2/3 et 60 %) ;
  - règle exacte de la prise en charge maladie sous le nouveau barème (« 0,10 % restent à votre charge » contre « 0 à 8,40 % ») ;
  - seuils 2025 de la page des praticiens et auxiliaires médicaux.
- Base légale de l'interdiction de la micro-entreprise pour les praticiens et auxiliaires médicaux, et du micro-social des affiliés de la CIPAV.
- EURL ou SASU classique pour les ostéopathes, psychologues, kinésithérapeutes et infirmiers ; dividendes d'un président de SELAS.
- Le tableau des autres caisses (§6) est indicatif : il doit être revérifié caisse par caisse.

**À trancher par le propriétaire :**
1. Retenir l'Urssaf (11 % et 21 %) pour la complémentaire CIPAV en attendant le texte, ou attendre ?
2. CARPIMKO calculée sur N-1 : calculer sur le revenu de l'année simulée (même convention que la SSI, recommandé) ou modéliser le décalage avec la simulation sur plusieurs années ?
3. Saisie de la profession (liste de professions) ou de la caisse ?
4. Pour une profession réglementée en société : simple avertissement, ou modélisation de la rémunération BNC de l'associé de SEL à l'IS (président de SELAS compris) ?
5. Modéliser la formation professionnelle en micro (0,2 % du CA, pour tous les micro-entrepreneurs, pas seulement les libéraux) dans ce chantier ou à part ?
6. CURPS et part conventionnée : les modéliser dès la CARPIMKO, ou les approcher (100 % conventionné, CURPS ignorée) dans un premier temps ?
