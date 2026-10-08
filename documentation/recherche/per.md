# Recherche : le plan d'épargne retraite (PER)

Préparation du point 1 de la phase 17 de la feuille de route (« PER »). Ce document rassemble les règles **sourcées** pour les revenus 2024, 2025 et 2026, décrit ce que le moteur calcule aujourd'hui et propose où brancher le PER. Il ne contient **aucun code** et ne décide rien : la dernière section est un brouillon de décision à trancher.

- **Date de consultation des sources :** 8 octobre 2026, sauf mention contraire.
- **Convention d'année :** celle de l'ADR 007. « Versements 2026 » désigne les sommes versées sur le PER pendant 2026, déduites des revenus de 2026 et donc imposées en 2027.
- **Légende :** **[sourcé]** = lu sur la source citée ; **[calculé]** = déduit d'une règle sourcée par un calcul simple ; **[à confirmer]** = source officielle introuvable, ambiguë ou contradictoire.

## Sommaire

1. [Sources](#1-sources)
2. [Déduction de droit commun (article 163 quatervicies)](#2-déduction-de-droit-commun-article-163-quatervicies-du-cgi)
3. [Plafond des travailleurs non salariés (article 154 bis)](#3-plafond-des-travailleurs-non-salariés-article-154-bis-du-cgi-ex-madelin)
4. [Micro-entrepreneur](#4-micro-entrepreneur)
5. [Président de SASU](#5-président-de-sasu-assimilé-salarié)
6. [Effet sur les cotisations sociales des indépendants](#6-effet-sur-les-cotisations-sociales-des-indépendants)
7. [Effet sur le revenu fiscal de référence](#7-effet-sur-le-revenu-fiscal-de-référence)
8. [Sortie en capital ou en rente](#8-sortie-en-capital-ou-en-rente-principe-seulement)
9. [Ce qui a changé avec les lois de finances 2025 et 2026](#9-ce-qui-a-changé-avec-les-lois-de-finances-2025-et-2026)
10. [Ce que calcule le moteur aujourd'hui](#10-ce-que-calcule-le-moteur-aujourdhui)
11. [Où brancher le PER (conception)](#11-où-brancher-le-per-conception)
12. [Cas de test proposés](#12-cas-de-test-proposés)
13. [Points incertains](#13-points-incertains)
14. [Brouillon de décision](#14-brouillon-de-décision)

---

## 1. Sources

Chaque source est désignée par un code (S1, S2, etc.) dans la suite du document.

| Code | Source | Version ou date | Adresse |
|---|---|---|---|
| S1 | Article 163 quatervicies du CGI (Légifrance) | en vigueur depuis le 21/02/2026, modifié par la loi n° 2026-103 du 19/02/2026, art. 10 | https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000038836248/ |
| S2 | BOFiP, actualité ACTU-2026-00106 : PER à 70 ans et report porté à 5 ans (loi de finances pour 2026, art. 9 et 10) | 10/08/2026 | https://bofip.impots.gouv.fr/bofip/15111-PGP.html/ACTU-2026-00106 |
| S3 | BOI-IR-BASE-20-50-20 : limites de déduction des cotisations d'épargne retraite | 10/08/2026 | https://bofip.impots.gouv.fr/bofip/1124-PGP.html |
| S4 | BOI-IR-BASE-20-50-10 : cotisations d'épargne retraite déductibles | 10/08/2026 | https://bofip.impots.gouv.fr/bofip/1068-PGP.html/identifiant=BOI-IR-BASE-20-50-10-20260810 |
| S5 | Article 154 bis du CGI (Légifrance) | en vigueur depuis le 11/03/2023 | https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000047288764 |
| S6 | BOI-BIC-CHG-40-50-40-20 : limites de déduction, article 154 bis | 12/09/2012, version toujours en ligne | https://bofip.impots.gouv.fr/bofip/6566-PGP.html |
| S7 | Article 41 DN bis de l'annexe III au CGI | lu seulement à travers un résumé de moteur de recherche : **texte à relire** | https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000006297950 |
| S8 | BOI-RSA-GER-20 : rémunérations des gérants (article 62) | 12/09/2012 | https://bofip.impots.gouv.fr/bofip/6347-PGP.html |
| S9 | Brochure pratique IR 2026 (revenus 2025), « Charges à déduire du revenu », p. 225-236 | 2026 | https://www.impots.gouv.fr/www2/fichiers/documentation/brochure/ir_2026/pdf_som/12-charges_ded_rev_225a236.pdf |
| S10 | Brochure pratique IR 2025 (revenus 2024), même chapitre, p. 215-226 | 2025 | https://www.impots.gouv.fr/www2/fichiers/documentation/brochure/ir_2025/pdf_som/12-charges_ded_rev_215a226.pdf |
| S11 | Service-public.gouv.fr, fiche F34982 « PER individuel » | vérifiée le 18/06/2026 | https://www.service-public.gouv.fr/particuliers/vosdroits/F34982 |
| S12 | Article 1417 du CGI (revenu fiscal de référence) | en vigueur depuis le 01/07/2026 | https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000054373249 |
| S13 | Notice 2041 DRI, campagne des revenus 2024 (travailleurs indépendants), p. 13 | 2025 | https://www.impots.gouv.fr/notice-des-travailleurs-independants-revenus-2024 |
| S14 | Guide de la déclaration sociale et fiscale des revenus 2025 des indépendants (Urssaf et DGFiP), p. 13-14, 32 et 41 | v1.1 du 30/04/2026 | https://www.impots.gouv.fr/sites/default/files/media/1_metier/1_particulier/EV/1_declarer/190_travailleur_independant/ti_guide-declaration-revenus_v1.1-du-30-04-2026.pdf |
| S15 | Urssaf, « Réforme de l'assiette sociale et du barème des cotisations sociales » | mise à jour le 07/05/2026 | https://www.urssaf.fr/accueil/independant/comprendre-payer-cotisations/reforme-cotisations-independants.html |
| S16 | Article L136-3 du code de la sécurité sociale | en vigueur depuis le 28/02/2025 | https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000051284498 |
| S17 | BOI-ANNX-000513 : synthèse du régime fiscal des PER | 10/08/2026 | https://bofip.impots.gouv.fr/bofip/14911-PGP.html/identifiant%3DBOI-ANNX-000513-20260810 |
| S18 | Urssaf, plafonds de la sécurité sociale (PASS 2026 : 48 060 €) | 2026 | https://www.urssaf.fr/accueil/outils-documentation/taux-baremes/plafonds-securite-sociale.html |
| S19 | Loi n° 2026-103 du 19/02/2026 de finances pour 2026, art. 9 | JO du 20/02/2026 | https://www.legifrance.gouv.fr/jorf/article_jo/JORFARTI000053508199 |

**Valeurs du PASS utilisées.**
- 43 992 € (2023), 46 368 € (2024) et 47 100 € (2025) : lues dans S9 et S10.
- 48 060 € (2026) : S18. Ce montant est déjà dans `src/backend/config.json`.

---

## 2. Déduction de droit commun (article 163 quatervicies du CGI)

### Règle

1. **Qui :** chaque membre du foyer fiscal (S1, S3). La déduction vaut pour les versements volontaires sur un PER individuel, ainsi que pour un PERECO ou un PERO (versements volontaires). Le PERP, la PREFON et les régimes assimilés sont aussi concernés (S9).
2. **Sur quel revenu :** la déduction se fait du **revenu net global**, et non d'un revenu catégoriel (S1). Elle **ne peut pas créer ni augmenter un déficit global** (S9, encadré « À noter »).
3. **Plafond de l'année N.** Il est égal à la différence entre deux termes (S1 I-2, S3) :
   - **Premier terme :** 10 % des revenus d'activité professionnelle **de N-1**, retenus dans la limite de 8 PASS, ou 10 % du PASS si ce montant est plus élevé. Le **PASS retenu est celui de N-1**, l'année civile précédant le versement (S3 § 80 ; S9 et S10 le chiffrent).
   - **Second terme :** les sommes déjà déduites ou exonérées en N-1 au titre de l'épargne retraite professionnelle :
     - cotisations « article 83 » et PERO obligatoire ;
     - cotisations des indépendants déduites en application de l'article 154 bis (Madelin, PER), **sauf la part correspondant à 15 % du bénéfice compris entre 1 et 8 PASS** (S3 § 330-350) ;
     - abondement de l'employeur au PERCO, PERECO ou PERO, dans la limite exonérée (16 % du PASS) ;
     - jours de congé monétisés (S9).
4. **Revenus d'activité professionnelle** (S1 II, S3 § 90-200, S9) :
   - **Salaires, allocations chômage, rémunérations de l'article 62 :** montant imposable **après la déduction de 10 % ou les frais réels** (S9 : « nets de frais professionnels » ; exemple S9 : 40 000 € de salaire donnent 36 000 €).
   - **BIC, BNC et BA professionnels :** **montant imposable** (S3 § 150), y compris les bénéfices exonérés au titre des articles 44 sexies et suivants (S3 § 170). Les plus-values à long terme sont exclues (S3 § 200).
   - **Micro-entrepreneur au versement libératoire :** montant **diminué de l'abattement** de l'article 50-0 ou 102 ter (S3 § 190). Voir la section 4.
   - **Dividendes :** ce ne sont pas des revenus d'activité professionnelle. Ils ne figurent pas dans la liste de S1 II.
5. **Report :** la part non utilisée du plafond d'une année « peut être utilisée au cours de l'une des **cinq** années suivantes » (S1, rédaction en vigueur depuis la loi de finances pour 2026).
   - **Entrée en vigueur : à partir de l'imposition des revenus de 2026** (S2).
   - Les plafonds non utilisés **de 2024 et de 2025 restent reportables 3 ans** ; celui de 2026 et des années suivantes l'est 5 ans (S11 : « la part non utilisée des plafonds des années 2024 et 2025 peut être utilisée uniquement dans un délai de 3 ans »).
6. **Ordre d'imputation :** les versements s'imputent d'abord sur le plafond de l'année, puis sur les plafonds reportés, **en commençant par les plus anciens** (S9, S10).
7. **Excédent :** la part des versements qui dépasse le plafond disponible n'est **ni déductible ni reportable** (S9, exemples ; S3 § 391).
8. **Mutualisation entre conjoints :**
   - **Qui peut la demander :** un couple marié ou pacsé imposé en commun, sur demande expresse (case **6QR**) (S9, S3).
   - **Effet :** les plafonds des deux conjoints et leurs versements sont additionnés en un seul plafond pour le foyer (S9).
   - **Ordre d'imputation :** d'abord le plafond de l'année, puis les reliquats des années précédentes (S9).
   - **Doctrine récente (non lue) :** le BOFiP du 10/08/2026 traiterait la mutualisation au-delà de 70 ans. Aucune page officielle n'a été lue sur ce point, ce qui est sans effet pour le simulateur aujourd'hui (pas d'âge).
9. **Plafond communiqué au contribuable :**
   - Il est **calculé par l'administration et imprimé sur la déclaration de revenus** de l'année suivante. S9 : « Le plafond de déduction des cotisations d'épargne retraite calculé lors de l'imposition des revenus de 2024 est imprimé sur la déclaration des revenus 2025. »
   - S'il est erroné, on le corrige en lignes 6PS, 6PT et 6PU (S9).
   - Sa présence **sur l'avis d'impôt** est une pratique connue, mais elle n'a pas été relue sur une source officielle : **[à confirmer]**.
10. **70 ans :** les versements effectués **à partir du 1er janvier 2026** par un titulaire âgé de **70 ans ou plus** ne sont plus déductibles (loi de finances pour 2026, art. 9 ; S2, S4 § 115, S19).
11. **Option pour la non-déduction :** chaque versement peut être fait sans déduction, en échange d'une fiscalité allégée à la sortie (S11, S17 ; article L224-20 du code monétaire et financier).
12. **Primo-arrivants :** une personne qui s'installe en France a droit à un plafond spécifique et à un plafond complémentaire triple (S1, S9, case 6QW). Ce cas est hors périmètre du simulateur.

### Montants par année

| Versements de | Revenus de référence | PASS retenu | Plancher (10 % PASS) | Maximum (10 % × 8 PASS) | Plafonds non utilisés encore disponibles | Report du plafond de l'année | Sources |
|---|---|---|---|---|---|---|---|
| 2024 | 2023 | 43 992 | **4 399** | **35 194** | 2021, 2022, 2023 | 3 ans | S10 [sourcé] |
| 2025 | 2024 | 46 368 | **4 637** | **37 094** | 2022, 2023, 2024 | 3 ans | S9, S10 [sourcé] |
| 2026 | 2025 | 47 100 | **4 710** | **37 680** | 2023, 2024, 2025 | **5 ans** (utilisable de 2027 à 2031) | S9, S11, S1, S2 [sourcé] |
| 2027 (pour mémoire) | 2026 | 48 060 | 4 806 | 38 448 | 2024, 2025, 2026 | 5 ans | [calculé] à partir de S1 et S18, non publié |

**Contradiction relevée [à confirmer].** S9, la brochure IR 2026 imprimée au printemps 2026 après la loi de finances, écrit encore pour le plafond « pour l'imposition des revenus de 2026 » : « Le plafond ou la fraction de plafond non utilisé est reporté sur les 3 années suivantes ». Or Légifrance (S1), le BOFiP (S2) et service-public (S11) disent 5 ans à partir des revenus de 2026. **On retient 5 ans** (la loi et la doctrine priment sur la brochure). Il faudra revérifier sur la brochure IR 2027.

**Calendrier des reports.**

| Plafond de l'année | Dernière année d'utilisation |
|---|---|
| 2021 | 2024 |
| 2022 | 2025 |
| 2023 | 2026 |
| 2024 | 2027 |
| 2025 | 2028 |
| 2026 | 2031 |
| 2027 | 2032 |

Tout le calendrier est **[calculé]** à partir de S1, S2 et S11.

---

## 3. Plafond des travailleurs non salariés (article 154 bis du CGI, ex-Madelin)

### Qui y a droit

| Situation | Article 154 bis ? | Source |
|---|---|---|
| Entrepreneur individuel au réel (BIC, BNC), y compris l'EURL à l'IR | Oui : le versement se déduit du **bénéfice** | S5 (« pour la détermination des bénéfices industriels et commerciaux et des bénéfices des professions non commerciales ») |
| Gérant majoritaire de SARL ou d'EURL à l'IS (article 62) | Oui : le versement se déduit de la **rémunération** de l'article 62, « dans les mêmes conditions et limites annuelles » que les BIC et BNC | S8 § 110 et § 190 ; S9 (lignes 6OS et 6QS, « rémunérations perçues par les associés gérants relevant de l'article 62 ») |
| Micro-entrepreneur | **Non** : le bénéfice est forfaitaire et aucune charge réelle n'est déductible | **[à confirmer]**. Déduit de S5, qui ne vise que la détermination du bénéfice réel. Aucune phrase officielle explicite n'a été trouvée. |
| Président de SASU (assimilé salarié) | Non : il n'est pas travailleur non salarié | S5, S8 |

### Plafond (S5 II 1°, S6, S9)

> Limite = le plus élevé de :
> - **a)** 10 % du bénéfice imposable retenu dans la limite de 8 PASS, **plus 15 %** de la fraction de ce bénéfice comprise entre 1 et 8 PASS ;
> - **b)** 10 % du PASS.

Précisions :
- **Bénéfice à retenir :** le bénéfice imposable **avant déduction** des cotisations et primes facultatives elles-mêmes (S6, qui cite l'article 41 DN bis de l'annexe III ; S7 à relire). Sont exclus les plus-values à long terme, les déficits reportés et certains abattements (S6).
- **PASS à retenir :** celui de **l'année de clôture de l'exercice**, donc de l'année du bénéfice (S6). S9 et S10 le confirment : pour les bénéfices 2024, la fraction se situe « entre 46 368 et 370 944 », et pour les bénéfices 2025 « entre 47 100 et 376 800 ».
- **Gérant majoritaire :** l'assiette exacte n'est pas écrite noir sur blanc dans S8.
  - **Hypothèse retenue :** la rémunération imposable (nette des cotisations obligatoires) avant la déduction des versements facultatifs.
  - La déduction de 10 % ou les frais réels s'appliquent **après** (S8 § 220-260).
  - **[à confirmer]**
- **Plafond propre à la retraite :** la limite porte sur la retraite. La prévoyance et la perte d'emploi ont leurs propres plafonds (S6). Le simulateur ne s'occupe que de la retraite.

### Montants par année (bénéfice de l'année N, PASS de N)

| Bénéfice de | PASS | Plancher (10 % PASS) | Tranche du supplément de 15 % | Plafond maximal : 10 % × 8 PASS + 15 % × 7 PASS = 1,85 PASS | Sources |
|---|---|---|---|---|---|
| 2024 | 46 368 | 4 637 | 46 368 à 370 944 | 85 781 | S10 (tranche) [sourcé] ; plafond maximal [calculé] |
| 2025 | 47 100 | 4 710 | 47 100 à 376 800 | 87 135 | S9 (tranche) [sourcé] ; plafond maximal [calculé] |
| 2026 | 48 060 | 4 806 | 48 060 à 384 480 | 88 911 | [calculé] (S5, S18) |

Exemple officiel (S6) : bénéfice de 150 000 €, PASS de 35 352 € : 15 000 + 15 % × (150 000 − 35 352) = 32 197 €.

### Articulation avec l'article 163 quatervicies

1. **Choisir le cadre de déduction.** Un même versement est déduit **soit** du bénéfice ou de la rémunération (article 154 bis), **soit** du revenu global (article 163 quatervicies), jamais des deux.
   - S9 : les lignes 6NS, 6NT et 6NU, qui portent les versements déduits du revenu global, ne sont permises que si « les cotisations n'ont pas été déduites des revenus catégoriels BIC, BNC, BA, rémunérations article 62 ».
   - S17 présente les deux régimes côte à côte.
   - **Choix du travailleur non salarié : [à confirmer].** Le texte le laisse ouvert, versement par versement, mais aucune phrase officielle lue ne décrit ce choix comme une option formelle.
2. **Réduction du plafond de l'année suivante.** Les sommes déduites en N au titre de l'article 154 bis **réduisent le plafond 163 quatervicies de N+1**. Cette réduction **ne compte pas** la part de 15 % entre 1 et 8 PASS (S3 § 330-350, S9 ; c'est le « second terme »).
   - Exemple officiel (S9, revenus 2024) : bénéfice de 50 000 €, Madelin de 4 000 €. Le plafond 154 bis est de 5 545 €. La part qui s'impute est 4 000 − 545 = 3 455 €. Le plafond 163 quatervicies restant est donc 5 000 − 3 455 = 1 545 €.
3. **Revenu retenu pour le premier terme de N+1 :** le bénéfice **après** déduction des versements 154 bis, puisque c'est son « montant imposable » (S3 § 150).
   - Les exemples officiels (S3 § 410, S9) n'emploient qu'un seul chiffre de bénéfice et ne tranchent pas explicitement.
   - **[à confirmer]**

---

## 4. Micro-entrepreneur

| Question | Réponse | Source |
|---|---|---|
| Quelle déduction ? | Celle de l'article 163 quatervicies seulement, sur le revenu global (voir la section 3 pour l'article 154 bis) | S1, S9 ; [à confirmer] pour l'exclusion du 154 bis |
| Revenus pris pour le plafond | Le chiffre d'affaires **après l'abattement forfaitaire** (71 %, 50 % ou 34 %). C'est le bénéfice imposable du régime micro, BIC ou BNC « pour leur montant imposable ». | S3 § 150 ; S9 (« revenus relevant des catégories BA, BIC, BNC lorsque l'activité est exercée à titre professionnel ») |
| Et sous versement libératoire ? | Les revenus restent comptés, **diminués de l'abattement** | S3 § 190 [sourcé] |
| Le versement libératoire empêche-t-il le PER ? | **Non**, aucune incompatibilité. Mais la déduction porte sur le revenu global au barème, dont le revenu au versement libératoire ne fait pas partie. Sans autre revenu au barème dans le foyer, la déduction est perdue : elle ne peut pas créer de déficit global (S9) et l'excédent n'est pas reportable. | S1, S9 ; raisonnement [calculé] |
| Effet sur les cotisations | Aucun : elles sont assises sur le chiffre d'affaires | Régime micro-social |
| Effet sur le revenu fiscal de référence | Aucun : la déduction 163 quatervicies est réintégrée (section 7) | S12 |

---

## 5. Président de SASU (assimilé salarié)

- **Cadre :** seulement l'article 163 quatervicies (section 2).
- **Revenus pris pour le plafond :** la rémunération imposable après la déduction de 10 % ou les frais réels (S9). **Les dividendes n'entrent pas dans le plafond.**
- **Épargne retraite d'entreprise (pour orienter seulement) :**
  - **Ce qui existe :** la société peut mettre en place un PERECO (anciennement PERCO) ou un PERO (anciennement « article 83 »). L'abondement de l'employeur est exonéré d'impôt dans la limite de 16 % du PASS (7 419 € en 2024, 7 536 € en 2025 ; S9 et S10). Les cotisations obligatoires du PERO se déduisent du salaire. Les deux réduisent le plafond 163 quatervicies de l'année suivante (S9).
  - **Accès d'un président sans salarié :** l'éligibilité aux dispositifs d'épargne salariale n'a pas été vérifiée. **[à confirmer]**, hors périmètre du point 1.
  - **Traitement social :** il n'a pas été étudié (forfait social, CSG sur l'abondement). Hors périmètre.
- **Cotisations :** un versement volontaire sur un PER individuel ne change ni le salaire ni les cotisations.

---

## 6. Effet sur les cotisations sociales des indépendants

**Conclusion : les versements PER (et Madelin) d'un travailleur non salarié ne diminuent pas l'assiette des cotisations, ni avant ni après la réforme de 2025.** C'est une bonne nouvelle pour le moteur : l'assiette TNS ne bouge pas.

| Revenus de | Règle | Source |
|---|---|---|
| 2024 (ancienne assiette) | L'assiette est le revenu imposable, **majoré** des cotisations facultatives Madelin et des « montants versés dans le cadre des nouveaux plans d'épargne retraite » (rubrique DSEA/DSEB). Sont exceptées les sommes pour lesquelles l'option de non-déduction fiscale a été prise, puisqu'elles n'ont rien diminué. | S13, p. 13 [sourcé] |
| 2025 et 2026 (assiette unique, abattement de 26 %) | **Gérant (article 62) :** la rémunération brute est déclarée sans déduction : « ne pas déduire les cotisations sociales et la part de CSG déductible fiscalement, les cotisations Madelin, ni les montants perçus au titre de l'intéressement, participation et abondement PER » (S14, p. 41). | S14 [sourcé] |
| 2025 et 2026, entreprise individuelle | Le revenu brut social se calcule à partir de la liasse fiscale. Pour un BNC (2035), le calcul rajoute la ligne BK des « charges sociales personnelles », qui inclut les cotisations facultatives Madelin (BZ) et les versements aux nouveaux PER (BU) (S14, p. 14 et 32). L'Urssaf résume : le revenu brut est « le chiffre d'affaires moins les charges de l'entreprise, autres que les cotisations sociales et la CSG déductibles fiscalement » (S15). | S14, S15 ; **[à confirmer]** pour la ligne BK, la mise en page du PDF rendant la lecture du formulaire incertaine |

- **Texte de loi :** l'article L136-3 du code de la sécurité sociale (S16) ne mentionne pas explicitement les versements facultatifs. La règle se lit dans les notices officielles (S13, S14), pas dans le texte du code consulté.
- **Écart avec le moteur pour 2024 :** le moteur applique déjà l'assiette unique à 2024, par approximation (ADR 007). Sur le PER, cela ne change rien, puisque l'assiette est indépendante du PER dans les deux régimes.

---

## 7. Effet sur le revenu fiscal de référence

| Déduction | Réintégrée dans le revenu fiscal de référence ? | Source |
|---|---|---|
| Article 163 quatervicies (revenu global) | **Oui** : « du montant des cotisations ou des primes déduites en application de l'article 163 quatervicies » (article 1417 IV 1° a) | S12 [sourcé] |
| Article 154 bis (bénéfice ou rémunération de l'article 62) | **Non** : elle ne figure pas dans la liste du IV 1° (a, a bis, b, c, d, e) | S12 [sourcé, par absence] |

**Conséquences pour le moteur :**
- Un versement déduit au titre de l'article 163 quatervicies **ne change pas** le revenu fiscal de référence.
- Un versement déduit au titre de l'article 154 bis **le diminue**. Comme le revenu fiscal de référence se juge au niveau du foyer, il peut rendre le versement libératoire accessible deux ans plus tard au conjoint micro-entrepreneur.

---

## 8. Sortie en capital ou en rente (principe seulement)

Ces règles servent uniquement à l'avertissement affiché dans l'interface (S17, S11).

| | Versements déduits | Versements non déduits (option) |
|---|---|---|
| **Capital** | Versements : impôt au barème, sans la déduction de 10 %. Gains : prélèvement forfaitaire unique. | Versements : exonérés d'impôt sur le revenu. Gains : prélèvement forfaitaire unique. |
| **Rente** | Rente viagère à titre gratuit : imposée comme une pension | Rente viagère à titre onéreux : seule une fraction est imposable, selon l'âge |

**Texte proposé pour l'interface :** « La déduction n'est qu'un report d'impôt : les sommes déduites seront imposées à la sortie, en capital au barème, ou en rente comme une pension. Le simulateur ne modélise pas la sortie. »

Les prélèvements sociaux s'appliquent aux gains. Le taux de 18,6 % sur certains revenus du capital depuis 2026 est cité dans `config.json` pour les dividendes ; son application aux gains du PER n'a pas été vérifiée : **[à confirmer]**.

---

## 9. Ce qui a changé avec les lois de finances 2025 et 2026

| Texte | Changement | Application | Source |
|---|---|---|---|
| Loi de finances pour 2025 (n° 2025-127 du 14/02/2025) | **Aucun changement identifié** pour les articles 163 quatervicies et 154 bis. Un moteur de recherche a attribué à cette loi le report à 5 ans : c'est faux, la mesure vient de la loi de finances pour 2026. | | S1 (historique), S2 ; **[à confirmer]** par une lecture du sommaire de la loi |
| Loi de finances pour 2026, art. 10 | Report des plafonds non utilisés porté de **3 à 5 ans** | À partir de l'imposition des revenus de 2026 ; les plafonds 2024 et 2025 restent à 3 ans | S1, S2, S11 |
| Loi de finances pour 2026, art. 9 | Plus de déduction pour les versements faits à **70 ans ou plus** | Versements à partir du 01/01/2026 | S2, S4, S19 |
| Loi de financement de la sécurité sociale pour 2024, art. 18, et décret 2024-688 | Assiette sociale unique des travailleurs non salariés : le PER reste **non déductible** de l'assiette | Revenus 2025 | S14, S15 |

---

## 10. Ce que calcule le moteur aujourd'hui

Il n'existe aucun code PER, Madelin, 154 bis ou 163 quatervicies. Seule la feuille de route en parle (lignes 169, 299 et 301). Le moteur ne calcule **pas de TMI** : `calculerIR` rend seulement le montant de l'impôt.

| Élément | Où | Ce qui s'y passe |
|---|---|---|
| Base du barème du foyer | `src/backend/logic/simulation-engine.ts`, `revenusDuFoyer` (vers la l. 558) | `baseBareme += revenusSalariaux − déduction (10 % ou frais réels) + other_taxable_income + beneficesImposables`, par membre du foyer. Aucune autre charge du revenu global. |
| Impôt du foyer | même fichier, `calculerFoyer` (vers la l. 585) | Barème sur `baseBareme` ; comparaison du prélèvement forfaitaire et de l'option pour le barème sur les dividendes ; ajout du versement libératoire. |
| Barème | `src/backend/logic/calculsIR.ts`, `calculerIR` (l. 32) | Barème par part, plafonnement du quotient familial, décote. |
| Revenu fiscal de référence | `calculerFoyer` (vers les l. 599-602) | `revenuImposableGlobal + dividendes hors barème + revenusAuVersementLiberatoire`. La feuille de route (l. 169) note que les « déductions PER » ne sont pas calculables. |
| Contrôle du versement libératoire sur N-2 | `analyserVersementLiberatoire` et `rfrDuTitulaire` (simulation-engine.ts, vers les l. 366-385) ; `preparerLAnnee` et `simulerLesAnnees` (`simulation-pluriannuelle.ts`) | Le revenu fiscal de référence de N-2 est pris dans la session (`ContexteDeLAnnee.rfrN2`) s'il y figure, sinon il est saisi. |
| Déduction de 10 % et frais réels | `abattementSalaires`, `revenusSalariaux` et `fraisProfessionnels` (simulation-engine.ts, vers les l. 517-555) | Salaires, allocations chômage, rémunération de dirigeant (SASU et EURL). |
| Assiette des travailleurs non salariés | `src/backend/logic/cotisationsTNS.ts`, `assietteSociale` et `calculerCotisationsTNS` | Revenu avant cotisations moins l'abattement de 26 % (borné). **Rien à changer pour le PER** (section 6). |
| Entreprise individuelle au réel | `src/backend/logic/calculsEI.ts`, `calculerEI` | `revenuImposable = bénéfice − cotisations + part non déductible`, ajouté à `beneficesImposables` par `simulerEntrepriseIndividuelle`. |
| EURL (gérant) | `src/backend/logic/calculsEURL.ts`, `calculerEURL` | `remunerationImposable = net + part non déductible`, puis comptée dans `revenusSalariaux` (déduction de 10 %). |
| SASU (président) | `src/backend/logic/calculsSASU.ts`, `calculerSASU` ; `verserRemuneration` | Même chemin que l'EURL, par `remunerationsImposables`. |
| Micro-entreprise | `src/backend/logic/calculsAE.ts`, `calculerMicro` et `calculerRevenuImposable` ; `simulerMicroEntreprise` (simulation-engine.ts) | Revenu après abattement : au barème (`beneficesImposables`) ou, sous versement libératoire, dans `revenusAuVersementLiberatoire` (revenu fiscal de référence seulement). |
| Règles par année | `src/backend/logic/regles.ts` (`ReglesFiscales.IR`, `TNS.plafondSecuriteSociale`) ; `src/backend/regles/2024.json`, `2025.json` et `src/backend/config.json` (2026) | PASS en double : `regimeGeneral` et `TNS`. Toute nouvelle clé doit être ajoutée dans les trois fichiers (test `MemeForme` dans `regles.test.ts`), dans `testing/regles-de-test.ts` et dans `outils/lecture.ts` (`reglesCles`). |
| Flux | `src/types.ts`, `FinancialFlowSchema` (énumération des types) | Les types de flux d'une personne sont `salary`, `are`, `other_taxable_income` et `expense`. |

---

## 11. Où brancher le PER (conception)

### 11.1 Saisie

- **Flux de versement.** Nouveau type de flux sur la personne, par exemple `versement_per`. C'est un montant versé dans le mois, sorti de la trésorerie du foyer, comme `expense`.
  - **Fichiers à compléter :** `flow-constants.ts` (libellés, `flowTypesByEntityType.person`, `outgoingFlowTypes`), `color-constants.ts`, `outils/commun.ts` (`TYPES_DE_FLUX`, `SENS_DES_TYPES`, `TYPES_PERMIS.personne`).
  - **Format de fichier :** une ancienne version de l'application écarterait ce flux inconnu (`keepValidFlows`). Il faut donc le **format suivant** avec migration (ADR 005), même si la migration elle-même est vide.
- **Réglages PER de la personne.** Nouveau champ facultatif de `PersonSchema`, commun à toutes les années comme `fraisReels`. Il contient :
  - `cadre` : `"revenu_global"` (163 quatervicies) ou `"professionnel"` (154 bis, proposé seulement si la personne est titulaire d'une EI au réel ou gérante d'EURL) ;
  - `nonDeductible` : option pour la non-déduction, booléen ;
  - `plafondSaisi` : plafond 163 quatervicies de la première année de la session, tel qu'il figure sur la déclaration (total des plafonds disponibles, ou détail par année d'origine pour gérer l'expiration) ;
  - `mutualisation` : case 6QR, à porter plutôt **sur la relation de couple** ou sur le foyer, puisqu'elle concerne les deux conjoints.
  - **Option plus légère :** commencer par un seul champ « plafond disponible » sans le détail par année. Sur 3 années de session, l'expiration des reliquats compte peu.

### 11.2 Calcul

1. **Contexte de l'année.** `ContexteDeLAnnee` reçoit, sur le modèle de `rfrN2`, les données de N-1 par personne : revenus d'activité professionnelle, versements 154 bis déduits et leur part de 15 %, plafond restant et reliquats par année d'origine. `simulerLesAnnees` les remplit si N-1 est dans la session ; sinon on prend `plafondSaisi` ; à défaut, le plancher, avec un avertissement.
2. **Versement au titre de l'article 154 bis.**
   - **Entreprise individuelle :** déduire le versement dans `simulerEntrepriseIndividuelle`, dans la limite de l'article 154 bis calculée sur le bénéfice avant ce versement. L'excédent bascule en 163 quatervicies **[à confirmer]**, ou est perdu.
   - **Gérant d'EURL :** même logique sur la rémunération de l'article 62, avant la déduction de 10 %.
   - **Cotisations :** `calculerCotisationsTNS` **ne change pas**.
3. **Versement au titre de l'article 163 quatervicies.** Nouvelle étape dans `revenusDuFoyer` ou juste après :
   - calculer le plafond disponible de chaque déclarant, ou du couple s'il y a mutualisation ;
   - imputer d'abord sur le plafond de l'année, puis sur les reliquats du plus ancien au plus récent ;
   - déduire de `baseBareme`, sans descendre sous zéro (pas de déficit global) ;
   - **ajouter la déduction au revenu fiscal de référence** (article 1417 IV 1° a).
4. **Résultats.**
   - `PersonResult.per` (ou un champ du foyer) : versé, déduit, cadre, plafond utilisé, reliquat par année d'origine, excédent perdu, **plafond pour N+1**.
   - `FoyerFiscalResult` : total déduit et montant réintégré au revenu fiscal de référence.
   - **Économie d'impôt :** la calculer **par différence** (impôt sans versement moins impôt avec), pas par la TMI que le moteur ne connaît pas. La TMI pourrait être affichée à titre indicatif avec une petite fonction dans `calculsIR.ts`.
5. **Règles de l'année.** Nouveau bloc `IR.epargneRetraite` dans les trois fichiers de règles :
   - `tauxRevenus` 0,10, `plafondEnPass` 8, `plancherPartDuPass` 0,10 ;
   - `dureeReport` : 3 en 2024 et 2025, 5 en 2026 ;
   - `ageLimiteDeduction` : `null` en 2024 et 2025, 70 en 2026 ;
   - `article154bis` : 0,10 / 0,15 / 1 à 8 PASS / plancher 0,10 ;
   - le PASS de N-1 doit être connu : **soit une clé `passAnneePrecedente`** dans chaque fichier, soit une lecture de `reglesDeLAnnee(N-1)`, qui échoue pour 2024 (pas de fichier 2023) ; d'où la clé.

### 11.3 Comparateur et optimiseur

- **Comparateur.** Option `versementPER` dans `ComparaisonOptions`, appliquée par `sessionConvertie` comme flux synthétique de janvier sur la personne dirigeante, avec le cadre qui convient au statut :
  - 154 bis pour l'EI et l'EURL ;
  - 163 quatervicies pour la SASU et la micro-entreprise.

  Trois modes :
  - « aucun » ;
  - « montant saisi » ;
  - « **plafond** » : le maximum déductible sans perte, calculé par statut. Pour la micro sous versement libératoire, il vaut zéro, sauf autre revenu au barème dans le foyer.
- **Lecture :** la ligne « Net dans la poche » doit **distinguer l'épargne bloquée** (versement PER) du net disponible. Sinon un PER semblera toujours appauvrir le foyer, ou l'enrichir si on oublie l'impôt de sortie. Proposition : afficher « net disponible » et « épargne retraite constituée » côte à côte.
- **Optimiseur rémunération et dividendes.** Le PER est une troisième dimension. On le garde **en dehors de la grille** : pour chaque point, on applique le versement en mode « plafond » ou saisi. Une recherche à deux dimensions coûterait cher et serait peu lisible.
- **Effet de bord à signaler.** En EURL, une rémunération plus haute augmente le plafond 154 bis. En SASU, elle n'augmente que le plafond 163 quatervicies de **l'année suivante**.

### 11.4 Outils pour les IA, exports, interface

- **Outils pour les IA :**
  - `TYPES_DE_FLUX` et `proposerFlux` (nouveau type) ;
  - `ReglagesActeurSchema` : réglages PER proposables ;
  - `resumeDuFoyer` et `expliquerPersonne` : ligne PER ;
  - `reglesCles` : bloc `epargneRetraite`.
- **Exports :**
  - CSV : une section « Épargne retraite » sur le modèle de `lignesDesFraisProfessionnels` (versé, cadre, déduit, plafond utilisé, reliquats, plafond pour N+1, réintégration au revenu fiscal de référence) ;
  - Markdown : sous-section par foyer ;
  - les réglages du comparateur ;
  - les fixtures `session-maximale.ts`.
- **Interface :**
  - champ « Plafond épargne retraite (déclaration de revenus) » dans `ChampsDeLActeur` ;
  - avertissement de sortie (section 8) ;
  - avertissement « 70 ans », sans objet tant que la date de naissance (phase 15) n'existe pas.

---

## 12. Cas de test proposés

**Hypothèses communes :**
- Année 2026 du simulateur, barème de `config.json` (tranches 11 600 / 29 579 / 84 577 / 181 917 ; décote 897 €, 1 483 € pour un couple, taux 45,25 %).
- PASS 2025 = 47 100 € pour le plafond 163 quatervicies.
- PASS 2026 = 48 060 € pour l'article 154 bis.
- Les montants de bénéfice et de rémunération sont **fiscaux**, cotisations obligatoires déjà déduites, pour isoler l'effet du PER.
- Pas de reliquat de plafond sauf mention contraire.
- Impôts arrondis à l'euro.

**Contrôles de l'impôt (célibataire, 1 part), utilisés plusieurs fois :**

| Base | Calcul | Impôt |
|---|---|---|
| 60 000 | 17 979 × 11 % + 30 421 × 30 % = 1 977,69 + 9 126,30 | 11 104 |
| 54 000 | 1 977,69 + 24 421 × 30 % | 9 304 |
| 45 000 | 1 977,69 + 15 421 × 30 % | 6 604 |
| 40 290 | 1 977,69 + 10 711 × 30 % | 5 191 |
| 36 000 | 1 977,69 + 6 421 × 30 % | 3 904 |
| 32 400 | 1 977,69 + 2 821 × 30 % | 2 824 |
| 33 000 | 1 977,69 + 3 421 × 30 % | 3 004 |
| 28 290 | 16 690 × 11 % = 1 835,90, moins la décote (897 − 0,4525 × 1 835,90 = 66,26) | 1 770 |

### Cas 1 : EI au réel, 60 000 € de bénéfice, 6 000 € versés au titre de l'article 154 bis

**Données :** célibataire ; bénéfice imposable 2026 avant versement : 60 000 € ; versement PER 2026 : 6 000 €.

1. **Plafond 154 bis :** 10 % × 60 000 + 15 % × (60 000 − 48 060) = 6 000 + 1 791 = **7 791 €** (au moins le plancher de 4 806 €). Le versement de 6 000 € est entièrement déductible du bénéfice (S5, S6).
2. **Bénéfice imposable :** 54 000 €.
3. **Impôt :** 11 104 € sans versement, **9 304 €** avec. L'économie est de **1 800 €**, soit 30 % × 6 000.
4. **Cotisations : inchangées** (section 6).
5. **Revenu fiscal de référence :** 60 000 → **54 000 €**, car la déduction 154 bis n'est pas réintégrée (S12).
6. **Plafond 163 quatervicies pour 2027 :**
   - premier terme : 10 % × 54 000 = 5 400 € (bénéfice après déduction, voir la section 3, point 3 [à confirmer]) ;
   - second terme : 6 000 − 15 % × (60 000 − 48 060) = 6 000 − 1 791 = 4 209 € ;
   - **plafond 2027 = 1 191 €** (S3 § 330-350, S9).
   - **Variante à trancher :** avec un bénéfice de 60 000 € au premier terme, le plafond serait de 1 791 €.

### Cas 1 bis : même EI, versement déduit du revenu global (163 quatervicies)

**Donnée supplémentaire :** bénéfice 2025 de 60 000 €, sans PER en 2025.

1. **Plafond 2026 :** max(6 000 ; 4 710) = **6 000 €**, sous le maximum de 37 680 €.
2. **Revenu global :** 60 000 − 6 000 = 54 000 €. **Impôt : 9 304 €**, la même économie de 1 800 €.
3. **Revenu fiscal de référence : 60 000 €**, la déduction étant réintégrée.

**Ce que le cas montre :** l'impôt est le même, mais pas le revenu fiscal de référence. Le plafond 2027 diffère aussi : 10 % × 60 000 = 6 000 €, sans second terme.

### Cas 2 : gérant majoritaire d'EURL à l'IS, 4 000 € versés au titre de l'article 154 bis

**Données :** célibataire ; rémunération imposable (article 62, avant la déduction de 10 %) : 40 000 € ; versement PER : 4 000 €.

1. **Plafond 154 bis :** max(10 % × 40 000 = 4 000 ; 10 % × 48 060 = 4 806) = **4 806 €**. La rémunération est sous 1 PASS, il n'y a donc pas de supplément de 15 %. Le versement est entièrement déductible (S8 § 190).
2. **Rémunération après versement :** 36 000 €. Déduction de 10 % : 3 600 €. **Net imposable : 32 400 €.**
3. **Sans versement :** 40 000 − 4 000 = 36 000 €.
4. **Impôt :** 3 904 € sans versement, **2 824 €** avec. L'économie est de **1 080 €**, soit 30 % × 4 000 × 0,9 : le versement réduit aussi la déduction de 10 %.
5. **Cotisations : inchangées.** La rémunération brute est déclarée à l'Urssaf sans déduire le PER (S14, p. 41).
6. **Revenu fiscal de référence :** 36 000 → **32 400 €**.

### Cas 3 : président de SASU, 5 000 € versés, plafond dépassé

**Données :** célibataire ; salaire net imposable de 50 000 € en 2025 comme en 2026 (après déduction de 10 % : 45 000 €) ; versement PER 2026 : 5 000 €.

1. **Plafond 2026 :** max(10 % × 45 000 = 4 500 ; 4 710) = **4 710 €**.
2. **Déduction :** 4 710 €. Les 290 € restants ne sont ni déductibles ni reportables (S9).
3. **Revenu global :** 45 000 − 4 710 = 40 290 €.
4. **Impôt :** 6 604 € sans versement, **5 191 €** avec. L'économie est de **1 413 €**, soit 30 % × 4 710.
5. **Revenu fiscal de référence :** 40 290 + 4 710 = **45 000 €**, inchangé.
6. **Cotisations : inchangées.**

### Cas 4 : micro-entrepreneur BNC sans versement libératoire

**Données :** célibataire ; chiffre d'affaires de 50 000 € en 2025 et en 2026 ; abattement de 34 % : 33 000 € ; versement PER 2026 : 4 710 €.

1. **Plafond 2026 :** max(10 % × 33 000 = 3 300 ; 4 710) = **4 710 €** (S3 § 150, S9).
2. **Revenu global :** 33 000 − 4 710 = 28 290 €.
3. **Impôt :** 3 004 € sans versement, **1 770 €** avec (décote comprise). L'économie est de **1 234 €** : 3 421 € à 30 %, 1 289 € à 11 %, et 66 € de décote gagnés.
4. **Cotisations :** inchangées, puisqu'elles sont assises sur le chiffre d'affaires.
5. **Revenu fiscal de référence :** 28 290 + 4 710 = **33 000 €**, inchangé.

### Cas 5 : micro-entrepreneur BNC avec versement libératoire, seul, puis en couple

**Données :** même chiffre d'affaires de 50 000 € ; versement libératoire de 2,2 % : 1 100 € ; versement PER de 4 710 € (plafond comme au cas 4, S3 § 190).

- **Seul, sans autre revenu :** le revenu global au barème vaut 0 €. La déduction ne sert à rien : elle ne peut pas créer de déficit global (S9). **Économie nulle.** L'excédent n'est pas reportable (S9). Le revenu fiscal de référence reste à 33 000 € (revenu au versement libératoire après abattement).
  - **Le simulateur doit l'avertir** et, en mode « plafond », proposer un versement nul.
- **Marié, conjoint salarié :** 30 000 € nets imposables après la déduction de 10 %, 2 parts.
  - **Impôt au barème du couple :**
    - sans versement : 30 000 / 2 = 15 000 par part, (15 000 − 11 600) × 11 % = 374 € par part, soit 748 € ; la décote couple vaut 1 483 − 0,4525 × 748 = 1 144,53, ce qui annule l'impôt : **0 €** ;
    - avec versement : 25 290 € de base, donc aussi **0 €**.
  - **Économie nulle ici aussi.** Le cas sert de test de non-régression de la décote : un versement PER n'a de valeur qu'au-dessus du seuil d'imposition.

### Cas 6 : couple marié, mutualisation des plafonds

**Données :**
- Monsieur, président de SASU : 100 000 € de salaire net imposable en 2025 et 2026, soit 90 000 € après la déduction de 10 %. Son plafond 2026 est de 9 000 €.
- Madame, sans activité : plafond 2026 de 4 710 € (plancher).
- Versements 2026 : Monsieur 12 000 €, Madame 0 €.
- 2 parts.

1. **Sans mutualisation :** Monsieur déduit 9 000 €, les 3 000 € restants sont perdus. Base : 81 000 €. Impôt : 2 × [1 977,69 + (40 500 − 29 579) × 30 %] = 2 × 5 253,99 = **10 508 €**.
2. **Avec mutualisation (case 6QR) :** plafond commun de 9 000 + 4 710 = 13 710 €. Les 12 000 € sont entièrement déductibles. Base : 78 000 €. Impôt : 2 × [1 977,69 + (39 000 − 29 579) × 30 %] = 2 × 4 803,99 = **9 608 €**.
3. **Sans versement :** 2 × 6 603,99 = **13 208 €**.
4. **Gain de la mutualisation :** 900 €, soit 30 % × 3 000.
5. **Revenu fiscal de référence :** 90 000 € dans les trois cas, la déduction étant réintégrée.
6. **Reliquat de 1 710 €** (13 710 − 12 000) : à quel conjoint l'attribuer pour le report ? **[à confirmer]** dans le BOI-IR-BASE-20-50-30, non lu.
   - Dans l'exemple de S9 avec mutualisation, c'est le reliquat « de Monsieur » qui reste reportable : le plafond de Madame, plus petit et versé en totalité, a été consommé en premier.

### Cas 7 : reports et passage de 3 à 5 ans (salarié, 1 part)

**Données :**
- Plafonds non utilisés : 2 000 € du plafond 2023, 1 000 € du plafond 2025.
- Plafond 2026 : 4 710 €.
- Versements : 7 000 € en 2026, rien en 2027.

1. **En 2026,** le versement s'impute d'abord sur le plafond 2026 (4 710 €), puis sur les reliquats les plus anciens : 2 000 € de 2023, puis 290 € de 2025. Les 7 000 € sont déductibles. Il reste 710 € du plafond 2025.
2. **En 2027 :**
   - le reliquat 2023 aurait de toute façon expiré fin 2026 (3 ans) ;
   - les 710 € de 2025 restent utilisables jusqu'en **2028** (3 ans) ;
   - un éventuel reliquat du plafond 2026 serait utilisable jusqu'en **2031** (5 ans).
3. **Ce que le cas vérifie :** l'ordre d'imputation (S9) et les dates d'expiration (S2, S11).

---

## 13. Points incertains

1. **Durée du report affichée par la brochure IR 2026** (3 ans) contre la loi, le BOFiP et service-public (5 ans à partir des revenus 2026). On retient 5 ans.
2. **Revenu du premier terme 163 quatervicies pour un travailleur non salarié qui a déduit au titre de l'article 154 bis :** bénéfice après déduction (lecture de S3 § 150) ou avant ? Cela change le plafond N+1 au cas 1.
3. **Assiette de l'article 154 bis pour le gérant de l'article 62 :** rémunération nette des cotisations obligatoires, avant les versements facultatifs et avant la déduction de 10 % ? (S8 renvoie aux règles BIC et BNC sans détailler.)
4. **Choix du cadre pour un travailleur non salarié** (154 bis ou 163 quatervicies) et **sort de l'excédent** au-delà du plafond 154 bis : peut-il basculer en 163 quatervicies ?
5. **Exclusion explicite du micro-entrepreneur** de l'article 154 bis : logique, mais aucune phrase officielle relue.
6. **Ligne BK de la 2035** (revenu brut social 2025) : sa lecture comme « charges sociales personnelles, dont facultatives Madelin et PER » est rendue incertaine par la mise en page du PDF. La conclusion de la section 6 tient tout de même grâce à S14 p. 41 (gérant), S13 (2024) et S15.
7. **Plafond sur l'avis d'impôt :** il est sourcé sur la déclaration (S9), pas relu pour l'avis.
8. **Article 41 DN bis de l'annexe III :** lu seulement à travers S6 et un résumé de recherche.
9. **Attribution du reliquat en cas de mutualisation** (cas 6).
10. **Loi de finances pour 2025 :** aucun changement trouvé, à confirmer par une lecture de son sommaire.
11. **Prélèvements sociaux sur les gains à la sortie** : le taux n'a pas été vérifié. Sans effet sur le moteur, qui ne modélise pas la sortie.

---

## 14. Brouillon de décision

Ce brouillon est à relire et à trancher par le propriétaire. Il ne crée pas d'ADR.

**Contexte.** La phase 17, point 1, demande un PER statut par statut. La recherche montre que :
- le PER **ne touche pas** aux cotisations des indépendants ;
- il agit sur l'impôt par **deux cadres** (154 bis et 163 quatervicies), qui diffèrent sur le revenu fiscal de référence et sur le plafond de l'année suivante ;
- le plafond dépend de **l'année précédente** et de **reliquats** qui expirent.

**Proposition.**
1. **Saisie :** un flux `versement_per` sur la personne, plus des réglages PER facultatifs sur la personne : cadre, option de non-déduction, plafond disponible saisi. La mutualisation est portée par le couple. Format de fichier suivant, avec une migration vide.
2. **Plafond :**
   - calculé à partir de N-1 quand N-1 est dans la session (revenus professionnels, versements 154 bis et leur part de 15 %, reliquats par année d'origine) ;
   - sinon saisi : un total la première version, le détail par année plus tard ;
   - à défaut, le plancher, avec un avertissement.
3. **Cadre par défaut :**
   - 154 bis pour l'EI au réel et le gérant d'EURL, dans la limite de l'article 154 bis ; l'excédent est perdu, avec un avertissement, en attendant confirmation de la bascule possible ;
   - 163 quatervicies pour toutes les autres personnes.
4. **Revenu fiscal de référence :** réintégrer la déduction 163 quatervicies, et pas celle de l'article 154 bis.
5. **Cotisations des travailleurs non salariés :** inchangées, documenté et testé.
6. **Comparateur :** option « versement PER » avec trois modes (aucun, montant, plafond) et la ligne « épargne retraite constituée » distincte du net disponible. L'optimiseur applique le mode choisi à chaque point, sans nouvelle dimension de recherche.
7. **Règles :** bloc `IR.epargneRetraite` par année, avec le PASS de N-1 en clé explicite.
8. **Hors périmètre :**
   - la sortie (seulement un avertissement) ;
   - l'épargne salariale (PERECO et PERO) et l'abondement, saisis plus tard comme un montant qui réduit le plafond de N+1 ;
   - les primo-arrivants ;
   - la règle des 70 ans, tant que la date de naissance n'existe pas.

**Effort estimé.**

| Point | Effort |
|---|---|
| Flux, schéma, migration, libellés, outils pour les IA | S |
| Règles par année et tests de forme | S |
| Déduction 163 quatervicies (plafond, reliquats, mutualisation, pas de déficit, revenu fiscal de référence) | **M** |
| Déduction 154 bis (EI, EURL) et second terme de N+1 | M |
| Chaînage N-1 dans `simulerLesAnnees` (reliquats, expiration 3 ou 5 ans) | M |
| Comparateur (modes, épargne distincte du net) | M |
| Optimiseur (mode appliqué à chaque point) | S |
| Exports CSV et Markdown, interface, avertissements, FAQ | M |
| Cas de référence (section 12) | S |

**Total :** environ L. C'est un point de taille moyenne à grande, surtout à cause du chaînage des reliquats et de la mutualisation.

**À trancher par le propriétaire.**
1. Plafond saisi : un total seulement, ou le détail par année d'origine ? Le détail est exact pour l'expiration, mais demande plus de saisie.
2. Cadre pour un travailleur non salarié : choix laissé à l'utilisateur, ou 154 bis imposé ?
3. Mutualisation : réglage sur le couple ou sur la personne ?
4. Comparateur : faut-il un mode « plafond » automatique ? Et comment présenter l'épargne bloquée dans « Net dans la poche » ?
5. Faut-il afficher la TMI, puisque l'économie d'impôt sera calculée par différence de toute façon ?
6. Faut-il lever d'abord les points 2 à 4 de la section 13, par exemple auprès d'un expert-comptable, avant de coder l'article 154 bis ?
