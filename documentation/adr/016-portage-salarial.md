# ADR-016: Portage salarial

- **Date :** 2026-10-14
- **Statut :** Accepté (2026-10-14)

## Contexte

« Et en portage salarial ? » est l'une des premières questions d'un indépendant qui hésite entre les statuts : le portage promet la protection d'un salarié (assurance chômage, régime général, mutuelle) sans créer de structure, contre des frais de gestion et des cotisations de salarié. Le comparateur (micro-entreprise avec et sans versement libératoire, EI au réel, SASU, EURL) n'a pas de colonne pour y répondre, et la grille ne sait pas représenter une personne portée : on peut y saisir un salaire, mais pas le chiffre d'affaires facturé dont il découle. La phase 18 de la feuille de route (point 3) demande une colonne du comparateur et un statut de la grille, avec des conditions réglables parce qu'elles varient d'une société de portage à l'autre, et une IA capable de traduire ces conditions en réglages au schéma fixe.

Cette ADR fixe le modèle de calcul, la place du portage dans l'application, les réglages, le format de fichier, l'outil pour les IA et ce qui n'est pas modélisé. Proposée et acceptée le 14 octobre 2026, avec les décisions du propriétaire (section « Décisions du propriétaire »).

### Ce que disent les textes (sources officielles, consultées le 2026-10-14)

**Fixé par la loi ou par la convention de branche, identique dans toutes les sociétés de portage :**

- **Définition et conditions** (code du travail, art. L1254-1 et L1254-2 I ; [fiche Entreprendre F31620](https://entreprendre.service-public.gouv.fr/vosdroits/F31620)) : le salarié porté a l'expertise, la qualification et l'autonomie de trouver ses clients et de négocier ses prix ; niveau bac + 2 ou trois ans d'expérience dans le secteur ; une prestation dure au plus 36 mois chez un même client ; les services à la personne sont exclus. Le portage porte sur des **prestations de services**.
- **Contrat** (fiche F31620) : CDD de portage (18 mois au plus, renouvellement compris) ou CDI de portage. **Les périodes sans prestation ne sont pas rémunérées** (art. L1254-21 II) et l'entreprise de portage n'est pas tenue de fournir du travail (art. L1254-2 III).
- **Rémunération minimale.** À défaut d'accord de branche étendu, 75 % du plafond mensuel de la sécurité sociale pour un temps plein (art. L1254-2 II). La convention collective de branche des salariés en portage salarial du 22 mars 2017 (IDCC 3219) en est un. Son [article 21.3 en vigueur](https://www.legifrance.gouv.fr/conv_coll/article/KALIARTI000050004613), modifié par l'avenant n° 12 du 20 décembre 2022, a été étendu par l'[arrêté du 10 juillet 2024](https://www.legifrance.gouv.fr/jorf/id/JORFTEXT000050002857) (JO du 17 juillet 2024). Le Conseil d'État a rejeté le recours contre cet arrêté le 19 mai 2026 (n° 497965). L'article fixe deux choses :
  - un **plancher de 69 % du plafond de la sécurité sociale « base 2017 »**, soit 2 255,61 € par mois (plafond mensuel 2017 : 3 269 €) ;
  - un salaire minimum par niveau de l'[article 37](https://www.legifrance.gouv.fr/conv_coll/article/KALIARTI000050004610) : premier niveau 63 % (24 mois au plus), junior 70 %, senior 75 %, expert 85 %.

  Le forfait en jours n'est plus un niveau ; il relève du statut de cadre. Le minimum se compte à la journée, à la demi-journée ou à l'heure.
  **Ce qui levait l'incohérence de la version proposée :** les taux de 77 % (plancher), 70, 75 et 85 % (junior, senior, forfait en jours) viennent de l'**ancienne** version de l'article 21.3, que Légifrance donne comme abrogée. La fiche F31620, vérifiée par service-public.fr le 28 mai 2026, les reprend encore (2 517,13 € = 77 %) : elle est en retard sur la convention. Les taux de 63 et 69 % sont ceux de la version en vigueur. Les contrats en cours dont le minimum aurait baissé gardent l'ancien (avenant n° 12, art. 3, II).
- **Indemnité d'apport d'affaires : 5 %** de la rémunération brute mensuelle (art. 21.2 de la convention ; art. L1254-25 du code du travail pour son information mensuelle). Elle est comprise dans le revenu minimal.
- **Réserve financière : 10 %** (art. 21.3 et 21.4 ; son utilisation à l'art. 22.2).
  - En CDI : 10 % du salaire de base de la dernière mission, placés sur le compte d'activité pour financer les périodes sans mission (allocation de prospection, trois mois au plus).
  - En CDD : une indemnité de précarité de 10 %, versée en fin de contrat.
- **Compte d'activité et relevé mensuel** (art. L1254-25 ; [section du code du travail](https://www.legifrance.gouv.fr/codes/section_lc/LEGITEXT000006072050/LEGISCTA000030435227/)). Chaque mois, le salarié porté reçoit le détail du versement du client, des frais de gestion, des frais professionnels, des prélèvements sociaux et fiscaux, de sa rémunération nette et de l'indemnité d'apport d'affaires. Le calcul de la convention (art. 21.2) est : « prix de la prestation HT encaissé – frais de gestion = montant disponible ». Ce montant finance les cotisations, la rémunération, l'indemnité d'apport d'affaires, les congés payés, l'indemnité de fin de CDD et les frais professionnels. Le contrat précise « les modalités de déduction des frais professionnels » (art. L1254-15 et L1254-21 I).
- **Catégorie** : le salarié porté est « technicien – agent de maîtrise ou cadre » selon son expertise (convention, chapitre V). En pratique il est presque toujours cadre. Il paie donc la cotisation APEC et reçoit la prévoyance des cadres (lignes ci-dessous).
- **APEC : 0,06 % du brut dans la limite de 4 plafonds** (tranches A et B), soit 0,036 % pour l'employeur et 0,024 % pour le salarié. Elle est due pour tout cadre relevant des articles 4 et 4 bis de la convention de 1947. Sources Agirc-Arrco :
  - [circulaire 2024-1-DRJ](https://www.agirc-arrco.fr/wp-content/uploads/2024/09/Circulaire-AgircArrco-2024-1-drj.pdf) ;
  - [guide de codification DSN 2025](https://www.agirc-arrco.fr/storage/2025/03/Aide-a-la-codification_AA_CT2025_v1.2-3.pdf), p. 8 ;
  - [circulaire « Paramètres 2026 » 2025-16-SG-DRJ](https://www.agirc-arrco.fr/storage/CirculaireAgircArrco2025-16sg-drj.pdf) (protocole Agirc-Arrco – Apec du 24 avril 2024).

  Taux vérifiés pour 2024, 2025 et 2026.
- **Prévoyance des cadres : 1,50 % de la rémunération sous le plafond de la sécurité sociale** (tranche 1), à la charge exclusive de l'employeur, affectée par priorité au décès. Source : [article 1er de l'accord national interprofessionnel du 17 novembre 2017](https://www.legifrance.gouv.fr/conv_coll/article/KALIARTI000036732016), étendu par l'[arrêté du 27 juillet 2018](https://www.legifrance.gouv.fr/jorf/id/JORFTEXT000037311605/). Cet accord reprend l'obligation de la convention collective nationale du 14 mars 1947 sans modifier ses articles 4 et 4 bis, qui définissent les cadres (art. 2.1).
- **Taux qui dépendent de l'effectif de la société de portage** (Légifrance ; urssaf.fr et boss.gouv.fr étaient injoignables le jour de la consultation) :
  - FNAL : 0,10 % dans la limite du plafond sous 50 salariés, 0,50 % sur tout le brut à partir de 50 ([code de la construction, art. L813-5](https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000038839912)) ;
  - contribution légale à la formation professionnelle : 0,55 % sous 11 salariés ([code du travail, art. L6331-1](https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000044981927)), 1 % à partir de 11 ([art. L6331-3](https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000044981918)) ;
  - participation à l'effort de construction : 0,45 % à partir de 50 salariés ([code de la construction, art. L313-1](https://www.legifrance.gouv.fr/codes/id/LEGISCTA000006176366)). Une société exonérée de taxe sur les salaires parce que son chiffre d'affaires est soumis à la TVA y reste soumise ([BOI-TPS-PEEC-10, § 40](https://bofip.impots.gouv.fr/bofip/6360-PGP.html/identifiant=BOI-TPS-PEEC-10-20141218)) ;
  - taxe d'apprentissage : 0,68 % ([art. L6241-1](https://www.legifrance.gouv.fr/codes/section_lc/LEGITEXT000006072050/LEGISCTA000006178193/)), déjà dans le bulletin du salarié. La contribution supplémentaire à l'apprentissage (250 salariés et plus, [art. L6242-1](https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000043701803)) n'est pas modélisée.
- **Formation professionnelle conventionnelle** (art. 36 de la convention).
  - L'[avenant n° 10 du 15 décembre 2020](https://www.legifrance.gouv.fr/conv_coll/article/KALIARTI000043477274) l'avait fixée, étendue, à 1,05 % de la masse salariale sous 11 salariés et à 0,60 % à partir de 11, du 1er janvier 2021 au 31 décembre 2024.
  - L'[avenant n° 14 du 24 février 2025](https://www.legifrance.gouv.fr/conv_coll/article/KALIARTI000051668460), « en vigueur non étendu » depuis le 31 décembre 2024, réécrit l'article sans aucun taux.
  - Pour 2025 et 2026, le taux de 2024 est repris comme valeur prudente, marquée « NON SOURCÉ » dans les règles (« À vérifier »).
- **Réduction générale des cotisations patronales.**
  - **Qui y a droit.** Elle s'applique aux salariés pour lesquels l'employeur est tenu à l'assurance chômage ([code de la sécurité sociale, art. L241-13, II, 1°](https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000042912368) ; [code du travail, art. L5422-13](https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000006903835)). Le salarié porté en bénéficie (fiche F31620 : « Les salariés portés bénéficient de l'assurance chômage »). Aucun texte consulté n'exclut le portage.
  - **2026 : réduction dégressive unique** ([art. D241-7](https://www.legifrance.gouv.fr/codes/id/LEGISCTA000006185779/), décret n° 2026-509). C = Tmin + Tdelta × (½ × (3 × SMIC annuel / brut − 1))^1,75, avec :
    - Tmin = 0,02 ;
    - Tdelta = 0,3781 pour les employeurs du 1° de l'art. L813-5 du code de la construction (moins de 50 salariés), 0,3821 pour ceux du 2° (50 et plus) ;
    - extinction à 3 SMIC.
  - **2024 et 2025 : réduction Fillon** ([art. D241-7 dans sa version de 2024](https://www.legifrance.gouv.fr/codes/section_lc/LEGITEXT000006073189/LEGISCTA000006185779/2024-06-01/)). T vaut 0,3194 et 0,3234. Le [décret n° 2025-318](https://www.legifrance.gouv.fr/jorf/id/JORFTEXT000051430146) les porte à 0,3193 et 0,3233 à partir du 1er mai 2025 ; le fichier garde la valeur du 1er janvier (ADR 007).
- **Frais professionnels remboursés.** Ils sont exclus de l'assiette des cotisations sur justificatifs, en application :
  - de l'[arrêté du 20 décembre 2002](https://www.legifrance.gouv.fr/loda/id/LEGITEXT000005633729), jusqu'au 6 septembre 2025 ;
  - puis de l'[arrêté du 4 septembre 2025](https://www.legifrance.gouv.fr/jorf/id/JORFTEXT000052198430), qui l'abroge (art. 1 et 2, 1° : « remboursement des dépenses réellement engagées »).

  Ils ne sont pas imposables ([CGI, art. 81, 1°](https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000038836748/2019-10-01)), sans cumul avec une déduction des mêmes frais ([BOI-RSA-CHAMP-20-50-10](https://bofip.impots.gouv.fr/bofip/5612-PGP.html/identifiant=BOI-RSA-CHAMP-20-50-10-20200710)). Aucun régime propre au portage n'a été trouvé.
- **Mutuelle (part du salarié).** La cotisation salariale à une complémentaire santé collective et obligatoire, sous contrat « responsable », est déductible du revenu imposable ([CGI, art. 83, 1° quater](https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000053545390)). La limite est de 5 % du plafond plus 2 % de la rémunération, sans dépasser 2 % de 8 plafonds, prévoyance comprise.
  Elle ne réduit pas l'assiette de la CSG : l'art. L136-1-1, III, 2° du code de la sécurité sociale n'exclut que la part salariale prise en charge par l'employeur.
  La part patronale de la mutuelle s'ajoute au salaire imposable et à l'assiette de la CSG. La part patronale de prévoyance est soumise à la CSG-CRDS et, à partir de 11 salariés, au forfait social de 8 % (art. L137-15 et L137-16).
- **Versement mobilité** : dû à partir de 11 salariés ([CGCT, art. L2333-64 et suivants](https://www.legifrance.gouv.fr/codes/id/LEGISCTA000039802388)). Ses taux maximaux :
  - hors Île-de-France : de 0,55 % à 1,75 % selon la population et les transports (art. L2333-67) ;
  - Paris, Hauts-de-Seine, Seine-Saint-Denis et Val-de-Marne : 3,20 % au plus ([art. L2531-4](https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000048837031)).

  Le taux appliqué à Paris est de 3,20 % depuis le 1er février 2024, et de 2,95 % avant ([table des taux de l'Urssaf, open.urssaf.fr](https://open.urssaf.fr/api/explore/v2.1/catalog/datasets/table_taux_vmrr/records)).
- **Assurance chômage** : le salarié porté en relève ([Unédic](https://www.unedic.org/l-assurance-chomage-et-vous/employeur-du-secteur-prive/mes-demarches/qui-dois-je-assurer-contre-le-risque-de-chomage) ; fiche F31620, qui ajoute qu'il peut cumuler l'ARE avec les revenus d'une activité portée). L'employeur paie donc l'assurance chômage et l'AGS, comme pour tout salarié.
- **Pas d'ACRE** : c'est une aide aux créateurs d'entreprise ; le salarié porté n'en crée pas.

**Variable d'une société de portage à l'autre, donc réglable :**

- **Les frais de gestion.**
  - Aucun texte n'en fixe le taux ni la forme : la loi et la convention imposent seulement de les détailler (art. L1254-25, 2° ; art. 21.2).
  - Aucune source officielle ne les chiffre. Le rapport de l'IGAS RM2011-128P décrit le mécanisme sans pourcentage ([vie-publique.fr](https://www.vie-publique.fr/files/rapport/pdf/114000584.pdf)), et rien n'a été trouvé à la DARES, au ministère du travail ou au Parlement.
  - La fourchette de 5 à 10 % du chiffre d'affaires HT est celle qu'annoncent les sites commerciaux et d'information sur le portage.
  - Certaines sociétés ajoutent un plancher ou un plafond mensuel, ou des frais fixes par mois.
- **Le contrat proposé** (CDD ou CDI) et donc la forme de la réserve.
- **L'effectif de la société de portage**, dont dépendent plusieurs cotisations patronales (FNAL, formation professionnelle, participation à l'effort de construction, versement mobilité) et le paramètre de la réduction générale.
- **Le versement mobilité de la commune** de l'établissement.
- **Ce que la société fait de la réduction générale.** La loi l'ouvre pour tout salarié payé moins de 3 SMIC, donc pour la plupart des salariés portés. Aucune source ne dit si les sociétés la reversent au salarié (en salaire) ou la gardent : c'est une condition commerciale.
- **La mutuelle** (part du salarié) et le contrat de prévoyance au-delà du minimum des cadres.

## Décisions du propriétaire (2026-10-14)

1. **Frais de gestion par défaut : 7 %**, annoncés comme valeur typique (milieu de la fourchette de 5 à 10 % couramment annoncée ; aucune source officielle).
2. **Contrat par défaut : CDI** ; la réserve est montrée comme « conservée ».
3. **Effectif par défaut : 50 salariés et plus.**
4. **Réduction générale non reversée par défaut**, avec un réglage à cocher.
5. **Mutuelle : un seul réglage, « mutuelle, coût mensuel »**, part du salarié, 0 € par défaut, retirée du net. Traitement retenu (simple et conforme aux textes ci-dessus) :
   - retirée du net de chaque mois avec salaire ;
   - retirée du salaire imposable (CGI, art. 83, 1° quater), sans contrôle de la limite de déduction, qu'une mutuelle ordinaire n'atteint pas ;
   - assiette de la CSG inchangée ;
   - comptée avec les cotisations sociales de l'activité.

   La part patronale, qui serait imposable et soumise à la CSG, n'est pas modélisée.
6. **Ordre** : le moteur et la colonne du comparateur d'abord, la grille complète ensuite.

## Décision

**Le portage salarial devient un type d'acteur de la grille, « Activité en portage salarial », et une colonne « Portage salarial » du comparateur, calculée en convertissant l'activité comparée dans ce type d'acteur, comme on la convertit aujourd'hui en micro-entreprise. Les conditions de la société de portage sont un objet au schéma fixe, `ConditionsPortage`, porté par l'acteur et par les réglages du comparateur ; le droit et la convention restent dans les règles de l'année.**

### 1. Modèle de calcul, pas à pas

Pour une année, à partir de la grille de l'acteur (ou de l'activité convertie) :

1. **Chiffre d'affaires facturé** `CA` : les prestations de services HT du mois (`ca_services`), facturées par la société de portage. La vente de marchandises n'est pas permise en portage : une activité qui en a voit, dans la colonne, sa vente écartée avec un avertissement, et la colonne est écartée du meilleur net si elle n'a que de la vente (`statutActuelNonRetenu` de l'ADR 009, avec sa raison). Sur l'acteur lui-même, un chiffre d'affaires de vente (possible seulement par un fichier) est écarté avec le même avertissement.
2. **Frais de gestion**, **mois par mois** (le plancher et le plafond sont mensuels) : pour chaque mois où `CA_mois > 0`,
   `FG_mois = min(plafond, max(plancher, taux × CA_mois)) + fraisFixesMensuels`, borné à `CA_mois`.
   Un mois sans chiffre d'affaires n'a ni frais de gestion ni salaire (période sans mission, art. L1254-21 II).
3. **Frais professionnels remboursés** `FP` : les charges saisies sur l'acteur (`deductible_expense`), remboursées sur justificatifs hors salaire. Elles sont dépensées, donc absentes du net, mais ni cotisées ni imposées. Dans la colonne, les charges de l'activité comparée deviennent ces frais, comme elles deviennent des charges dans les autres statuts au réel.
4. **Enveloppe disponible** : `E = CA − FG − FP` sur l'année (0 si négative, avec un avertissement : les frais dépassent le chiffre d'affaires ; le découvert reste sur le compte d'activité).
5. **Masse salariale brute** `M` : la plus grande telle que `coutEmployeur(M) ≤ E`, trouvée par dichotomie (60 tours), comme `brutPourUnNet` trouve un brut à partir d'un net (`cotisationsSalarie.ts`) : le coût employeur n'est pas linéaire (tranches du plafond, contribution d'équilibre technique, réduction générale). `coutEmployeur` est `calculerBulletinDuPorte(M, …)` : un **troisième statut de bulletin**, `"porte"`, à côté de `"president"` et `"salarie"`, qui reprend toutes les cotisations du salarié et y ajoute celles du cadre en portage (voir plus bas). Le coût employeur croît avec le brut, par sauts vers le haut (contribution d'équilibre technique au passage du plafond, environ 100 €) : une enveloppe qui tombe dans un saut n'est pas payée à l'euro près, et ce **reliquat** reste sur le compte d'activité, montré avec la réserve.
6. **Partage de la masse salariale** (information et réserve) : salaire de base `B = M / (1 + 5 % + 10 %)`, indemnité d'apport d'affaires `5 % × B`, réserve ou indemnité de précarité `10 % × B` (taux des règles de l'année). Les congés payés sont dans `B` : sur une année, ils sont du salaire versé comme un autre et ne changent pas les cotisations.
   - **CDD** : l'indemnité de précarité est versée en fin de contrat, supposée dans l'année ; tout `M` est versé.
   - **CDI** : la réserve reste sur le compte d'activité. Elle est montrée comme **« conservé »**, au même titre que le résultat conservé d'une société (ADR 014), et sort du net de l'année ; le reste de `M` est versé. Approximation : les cotisations de la réserve sont prises au prorata de `M`, comme si elle était versée au même taux, et comptées dans l'année.
7. **Salaire net** : `net = M_versé − cotisations salariales` (CSG et CRDS comprises), au prorata pour la part versée, moins la mutuelle.
8. **Impôt du foyer** : le net imposable (net versé, plus la CSG non déductible et la CRDS de la part versée) rejoint les salaires de la personne dans `impot-du-foyer.ts`, avec la déduction de 10 % ou ses frais réels (`FraisReels`, déjà saisis sur la personne). Les frais professionnels remboursés ne sont pas imposables.
9. **Protection sociale** : celle d'un salarié du régime général (`protection-sociale.ts`, statut « salarié ») : trimestres de retraite d'après le brut, indemnités journalières, assurance chômage. Elle sert la colonne du comparateur et viendra avec elle.
10. **Contrôle du minimum conventionnel** : si le salaire de base mensuel moyen des mois avec chiffre d'affaires est sous le plancher d'un temps plein (montant de la convention, en euros, dans les règles), un avertissement le signale, avec le salaire du niveau expert, sans rien changer au calcul (le minimum se compte au jour ou à l'heure, que le simulateur ne connaît pas).

Dans le résultat de l'activité : chiffre d'affaires `CA` ; charges `FG + FP` ; cotisations sociales, salariales et patronales (après la réduction générale si elle est reversée) et mutuelle ; revenu versé, le net ; résultat conservé, la réserve nette d'un CDI et le reliquat. Le détail pas à pas est dans `ActivityResult.portage` (`DetailPortage`). Le salaire rejoint le titulaire comme « Salaire en portage salarial » (`PersonResult.detail.salairesPortage`).

#### Le bulletin `"porte"`

Il part du bulletin `"salarie"` (règles `regimeGeneral` de l'année) et en change, par des règles nouvelles d'un bloc `portageSalarial` du fichier de l'année, chacune avec `description` et `source` :

| Ligne | Salarié actuel du moteur | Salarié porté |
| --- | --- | --- |
| Catégorie | non cadre | cadre |
| APEC | non | 0,024 % salarié, 0,036 % employeur, jusqu'à 4 PASS |
| Prévoyance des cadres | non | 1,50 % employeur sur la tranche 1 (minimum de l'ANI du 17/11/2017) |
| FNAL | 0,10 % jusqu'au PASS (moins de 50 salariés) | selon l'effectif réglé : 0,50 % sur tout le brut à partir de 50 |
| Formation professionnelle | 0,55 % (moins de 11) | selon l'effectif : 0,55 % ou 1 %, plus la contribution conventionnelle (1,05 % ou 0,60 %) |
| Participation à l'effort de construction | non | 0,45 % à partir de 50 salariés |
| Versement mobilité | non | taux réglé (0 par défaut), à partir de 11 salariés seulement |
| Réduction générale | appliquée | appliquée seulement si la société la reverse (réglage) ; son paramètre `tDelta` suit l'effectif (0,3821 à partir de 50 salariés en 2026, 0,3234 en 2024 et 2025) ; non reversée, son montant est dit (« gardée par la société ») |

Le reste (maladie, vieillesse, allocations familiales, accidents du travail, retraite complémentaire, CEG, CET, chômage, AGS, dialogue social, taxe d'apprentissage, CSG-CRDS) est celui du salarié, sans changement.

#### Exemple calculé à la main

Une personne seule, sans autre revenu, 60 000 € HT facturés en 2026, répartis sur 12 mois ; frais de gestion de 7 %, sans plancher, plafond ni frais fixes ; aucun frais professionnel ; société de 50 salariés ou plus, sans versement mobilité ; réduction générale non reversée ; CDD (ou réserve versée dans l'année) ; pas de mutuelle. Règles de 2026 du simulateur (PASS 48 060 €).

| Étape | Calcul | Montant |
| --- | --- | --- |
| Chiffre d'affaires HT | | 60 000 € |
| Frais de gestion | 7 % × 60 000 | − 4 200 € |
| Enveloppe disponible | | 55 800 € |
| Taux patronal (brut sous le PASS) | 13 + 8,55 + 2,11 + 5,25 + 0,64 + 0,30 + 0,50 (FNAL) + 4,72 + 1,29 + 4,00 + 0,25 + 0,016 + 1,00 + 0,60 (formation) + 0,68 + 0,036 (APEC) + 1,50 (prévoyance) + 0,45 (construction) | 44,892 % |
| Masse salariale brute `M` | 55 800 / 1,44892 | 38 511 € |
| dont salaire de base, apport d'affaires, précarité | `M` / 1,15 ; × 5 % ; × 10 % | 33 488 € ; 1 674 € ; 3 349 € |
| Cotisations patronales | 38 511 × 44,892 % | 17 289 € |
| Taux salarial | 6,90 + 0,40 + 3,15 + 0,86 + 0,024 (APEC) + 9,70 × 0,9825 (CSG-CRDS) | 20,864 % |
| **Salaire net** | 38 511 × (1 − 20,864 %) | **30 476 €**, soit 50,8 % du chiffre d'affaires |
| Net imposable | 30 476 + 38 511 × 0,9825 × 2,9 % | 31 574 € |
| Déduction de 10 % | | − 3 157 € |
| Revenu net imposable | | 28 416 € |
| Impôt (1 part) | 11 % × (28 416 − 11 600) = 1 850, décote 897 − 45,25 % × 1 850 = 60 ; 1 789,82 arrondi à l'euro | 1 790 € |
| **Net après impôt** | 30 476,32 − 1 790 | **28 686 €** |

La version proposée donnait 28 687 € : elle retranchait l'impôt non arrondi (1 789,82 €). Le moteur, qui arrondit l'impôt à l'euro comme l'administration, donne 28 686 € ; la ligne est corrigée.

Variantes, mêmes hypothèses :

- **CDI, réserve conservée** (contrat par défaut) : 35 163 € bruts versés, 27 826 € nets dans l'année, et 2 650 € nets (3 349 € bruts) sur le compte d'activité, montrés comme conservés. Impôt 1 395 €, net après impôt 26 431 €.
- **Réduction générale reversée** : la masse salariale `M` vérifie `M × (1,44892 − C(M)) = 55 800`. À 50 salariés et plus, Tdelta vaut 0,3821, d'où un coefficient de 0,0695 ; `M` = 40 452 €, réduction 2 811 €, net 32 012 € (+ 1 536 €), impôt 2 058 €, net après impôt 29 954 €. La version proposée calculait avec le Tdelta des moins de 50 salariés (0,3781) : `M` = 40 440 €, net 32 003 €. L'écart d'une dizaine d'euros était annoncé ; le moteur prend le bon paramètre. Non reversée, la réduction que garde la société vaut 0,0815 × 38 511 = 3 139 €. C'est l'écart le plus fort entre deux conditions plausibles : il justifie un réglage explicite.

Approximations de cet exemple, toutes dites dans l'interface ou ici :
- cotisations annuelles au lieu de douze bulletins (identiques pour un salaire régulier, la régularisation progressive des plafonds le garantit à peu près) ;
- taux d'accidents du travail de 0,64 % (celui des règles actuelles) ;
- ni mutuelle, ni prévoyance au-delà du minimum des cadres ;
- ni la CSG-CRDS ni le forfait social de 8 % sur la prévoyance patronale. Ils réduiraient le net d'environ 56 € et coûteraient environ 46 € de plus à l'enveloppe (art. L136-1-1, L137-15 et L137-16 du code de la sécurité sociale).

Ces montants sont figés par les cas de référence (`references/portage.reference.test.ts`), dérivés à la main ligne à ligne : le moteur les retrouve au centime.

### 2. Où le portage apparaît

Trois options ont été comparées :

| Option | Pour | Contre |
| --- | --- | --- |
| **A. Colonne du comparateur seulement**, calcul à part | Moins de code ; pas de format de fichier touché | Pas de « statut de la grille » (roadmap) ; une personne déjà portée ne peut pas simuler son année ; un calcul qui n'est pas celui du moteur, donc deux chemins à tenir |
| **B. Un nouveau type d'acteur `"portage"`** (« Activité en portage salarial »), relié à sa personne ; la colonne convertit l'activité comparée dans ce type | Un seul calcul, celui du moteur, pour la grille, le comparateur, le calcul à l'envers, les exports et les outils pour les IA ; la conversion suit le modèle de la micro-entreprise (`convertirLActivite`) | Un type d'acteur de plus à traiter partout (cartes, relations, routage des flux, nettoyage, outils) |
| **C. Un `legalStatus: "PORTAGE"`** de la société au réel | Réutilise la fiche de société | Faux : le portage n'est ni à l'IS ni à l'IR, n'a ni capital, ni dividendes, ni réserves (`IMPOSITION_DES_STATUTS` et toutes les tables par statut l'exigeraient) |
| D. Une personne avec des salaires saisis (possible aujourd'hui) | Rien à coder | Pas de chiffre d'affaires, donc pas de comparaison ; c'est le repli actuel |

**Retenu : B**, en trois temps (décision 6) : le type d'acteur et son calcul dans le moteur ; la colonne du comparateur ; la saisie complète dans la grille (carte, fiche des conditions, glisser-déposer).

- **L'acteur** : `PortageSchema = { id, type: "portage", name, conditions?: ConditionsPortage, avatar, locked }`. Flux permis : `ca_services` (prestations facturées HT) et `deductible_expense` (frais professionnels remboursés). Pas de `profession` : la caisse d'un libéral ne s'applique pas à un salarié (l'ADR 015 ne concerne que les non-salariés). Pas de `dateDeCreation` non plus, prévue dans la version proposée : sans ACRE ni CFE, elle ne changerait aucun calcul.
- **La relation** : la relation existante **« Titulaire »**, de la personne vers l'acteur, affichée « salarié porté » sur cette carte (et déjà par les outils pour les IA : « Lucie — Titulaire (salarié porté) — … »). Un seul titulaire ; le salaire calculé est celui de cette personne, et rejoint son foyer.
- **Le comparateur** : `STATUTS_COMPARES` recevra `"portage"` avec la colonne. Chaque table typée par `StatutCompare` (titres, dirigeant, frais, protection sociale) fera échouer la compilation jusqu'à ce qu'elle ait sa ligne, comme le prévoit le guide du développeur (« Ajouter un statut »). La colonne s'appelle « Portage salarial » ; elle n'a pas de partage du bénéfice ni d'optimiseur. Tant qu'elle n'existe pas, une activité en portage n'est pas proposée au comparateur (`comparableActivities`, `activiteComparee`, `comparer_statuts` le disent).
- **Frais de fonctionnement supposés** (ADR 009) : aucun pour le portage. La société de portage tient la comptabilité, facture et assure le plus souvent la responsabilité civile ; ses frais de gestion en tiennent lieu. `FRAIS_DES_COLONNES` passera donc à `Record<StatutCompare, StatutFrais | null>` : la colonne du portage reçoit un écart de frais égal à moins les frais supposés du statut actuel. **`STATUTS_FRAIS` ne change pas** : chacune de ses clés est obligatoire dans les fichiers enregistrés, et une clé `portage` les rendrait invalides pour les versions précédentes.
- **Calcul à l'envers** (point 1 de la phase 18) : la colonne passera par `colonneDuStatut`, donc « Combien facturer pour un net visé ? » et `chiffre_affaires_pour_net_vise` la calculeront sans code de plus. La dichotomie sur la masse salariale (60 bulletins) s'ajoute à chaque essai du calcul à l'envers : à mesurer avec la colonne.

### 3. Réglages

**Dans les règles de l'année** (`portageSalarial` de `2024.json`, `2025.json` et `2026.json`, chaque valeur avec `description` et `source`) :
- l'indemnité d'apport d'affaires (0,05) ;
- la réserve financière et l'indemnité de précarité (0,10) ;
- le minimum conventionnel en euros : le plancher, et le salaire du niveau expert ;
- l'APEC et la prévoyance des cadres ;
- par effectif, ce qui en dépend : FNAL, formation légale et conventionnelle, participation à l'effort de construction, `tDelta` de la réduction générale, versement mobilité dû ou non.

Le minimum est de 2 517,13 € et 2 778,65 € au 1er janvier 2024 (ancien barème, valeur du 1er janvier, ADR 007), puis de 2 255,61 € et 2 778,65 € en 2025 et 2026. Ce sont des règles : ni l'utilisateur ni une IA ne les règlent. Une année sans ce bloc n'existe pas : le type `ReglesFiscales` l'exige, et une année future reprend les dernières règles connues avec un avertissement, comme pour le reste.

**Conditions de la société de portage** (`ConditionsPortageSchema`, `src/types.ts`, chaque champ facultatif ; absent, il prend la valeur typique) :

| Nom | Type | Unité | Bornes | Valeur typique (annoncée comme telle) | Source de la valeur typique |
| --- | --- | --- | --- | --- | --- |
| `tauxFraisDeGestion` | nombre | part du CA HT | 0 à 0,30 | 0,07 | Décision 1 : milieu de la fourchette de 5 à 10 % des sites commerciaux ; aucune source officielle |
| `plancherMensuel` | nombre ou absent | € par mois avec CA | 0 à 5 000 | aucun | Pratique de certaines sociétés ; pas de valeur typique |
| `plafondMensuel` | nombre ou absent | € par mois avec CA | 0 à 50 000, et ≥ plancher | aucun | Idem |
| `fraisFixesMensuels` | nombre | € par mois avec CA | 0 à 2 000 | 0 | Idem |
| `contrat` | `"CDI"` ou `"CDD"` | | | `"CDI"` | Décision 2 : le CDI est le seul qui couvre plusieurs clients |
| `effectif` | `"moinsDe11"`, `"de11a49"`, `"50EtPlus"` | salariés de la société de portage | | `"50EtPlus"` | Décision 3 : les salariés portés sont regroupés dans des sociétés qui en emploient beaucoup ; non sourcé |
| `tauxVersementMobilite` | nombre | part du brut | 0 à 0,032 | 0 | Dépend de la commune ; au plus 3,20 % (CGCT, art. L2531-4), 3,20 % à Paris depuis le 1er février 2024 ; ignoré, avec un avertissement, sous 11 salariés |
| `reductionGeneraleReversee` | booléen | | | `false` | Décision 4 : aucune source ne dit que les sociétés la reversent |
| `mutuelleMensuelle` | nombre | € par mois avec salaire | 0 à 1 000 | 0 | Décision 5 : part du salarié, propre à chaque contrat |

Valeurs typiques réunies dans `conditionsPortageParDefaut()` (`options-du-comparateur.ts`) ; `conditionsPortageRetenues()` complète les conditions saisies et nomme celles qui sont typiques (`DetailPortage.valeursTypiques`), pour qu'interface, exports et outils les signalent : « valeur courante, à remplacer par les conditions de votre société ».

**Où elles sont enregistrées :**

- **Sur l'acteur** (`PortageSchema.conditions`) pour une activité en portage dans la grille (fait).
- **Dans les réglages du comparateur** (ADR 009), pour l'activité comparée : `ReglagesComparateurSchema.portage?: ConditionsPortage` (avec la colonne). Comme les frais de fonctionnement, ce sont des choix de structure, valables pour toutes les années, et seuls les champs changés sont enregistrés. Quand l'activité comparée est elle-même en portage, sa colonne prend les conditions de l'acteur, et le comparateur n'affiche pas les siennes.
- Comme pour l'ADR 009, ils sont hors de l'historique d'annulation dans le comparateur ; sur l'acteur, ils en font partie, comme toute modification d'un acteur.

**Format de fichier.** La règle de l'ADR 005 (section « Versionnage du format ») s'applique : **le numéro de format reste 3, sans migration**.
- `conditions` (et plus tard `portage` dans les réglages du comparateur) sont des champs facultatifs dont l'absence a un sens : les valeurs typiques.
- `"portage"` est une nouvelle variante de l'union des acteurs. Une version précédente l'écarte en le signalant dans son rapport, avec ses flux et sa relation, ce que l'ADR 005 accepte pour une nouvelle valeur d'énumération.
- Une condition hors bornes est écartée seule (`.catch(undefined)`), comme la part conventionnée de l'ADR 015 ; un plancher supérieur au plafond fait écarter les deux. Dans le fichier, une clé inconnue de `conditions` est ignorée et non refusée, pour qu'une condition ajoutée plus tard ne fasse pas perdre l'acteur à une version précédente. Le paramètre de l'outil pour les IA, lui, est strict (section 4).
- La session « maximale » (`session-maximale.ts`) contient un acteur en portage avec toutes ses conditions, sa relation et ses flux, pour le test « rien ne se perd ». Les réglages du comparateur avec `portage` y entreront avec la colonne.

**Exports.** Le rapport Markdown décrira l'acteur, ses conditions et le détail de l'étape 1 à 8 (enveloppe, masse salariale, partage, net, conservé) ; le CSV et le PDF du comparateur auront une colonne de plus ; l'export de la grille liste l'acteur comme les autres. Les conditions annoncées typiques y seront marquées comme telles. Dans cette première étape, l'export Markdown nomme seulement la nature de l'acteur.

### 4. Avec une IA

La personne colle les conditions de sa société de portage (page de tarifs, contrat, courriel) dans son client d'IA. L'IA les traduit en `ConditionsPortage` et les envoie comme une proposition, relue puis appliquée dans l'application (ADR 010 et 011).

**Lecture (fait avec le moteur).**
- `decrire_simulation` donne le genre `portage`, les conditions retenues et la liste des valeurs typiques.
- `simuler` rend l'activité (statut « Portage salarial », résultat conservé = réserve d'un CDI).
- `expliquer_resultat` détaille l'activité pas à pas : enveloppe, masse salariale et son partage, bulletin du salarié porté avec ses lignes propres, net, conservé. Il ajoute les conditions retenues, les valeurs typiques et la réduction générale gardée ; pour la personne, il donne la ligne « Salaire en portage salarial ».
- Une proposition peut ajouter des flux à une activité en portage existante (`ca_services`, `deductible_expense`), mais **pas créer** d'activité en portage tant que l'interface ne sait pas la saisir : le portage est dans `GENRES_D_ACTEUR`, pas dans `GENRES_CREABLES`.

**Outil `proposer_conditions_portage`** (proposition, pas de lecture ; à venir) :

- **Paramètres** (objet strict, clés inconnues refusées) :
  - `acteurId` : un acteur `"portage"` (les conditions vont sur l'acteur) ou une autre activité (elles vont dans les réglages du comparateur, qui s'ouvre sur cette activité) ;
  - `conditions` : `ConditionsPortage`, les mêmes bornes que le fichier ; seuls les champs donnés changent ;
  - `nonModelise` : liste de 0 à 10 textes d'une ligne (120 caractères au plus, sans caractère de contrôle ni de mise en forme bidirectionnelle), les conditions lues que le schéma ne sait pas porter ;
  - `suiteDe` : comme les autres outils de proposition.
- **Opération** : `regler_portage { acteurId, conditions, nonModelise }`, ajoutée à `PropositionSchema`, revalidée en entier à l'application.
- **Validations** : bornes et plancher ≤ plafond ; acteur existant et non verrouillé ; refus d'un acteur qui n'est ni en portage ni une activité. Avertissements calculés par l'outil, jamais fournis par l'IA : taux de frais de gestion au-dessus de 0,15 (« inhabituel, vérifiez qu'il ne comprend pas d'autres frais ») ; frais fixes et taux à la fois ; effectif ou réduction générale laissés à la valeur typique.
- **Conditions non modélisées** : chaque texte de `nonModelise` devient un avertissement de la proposition, préfixé « Non pris en compte : ». Exemples attendus : frais de gestion dégressifs par tranche de chiffre d'affaires (l'IA retient le taux qui s'applique au chiffre d'affaires de la simulation et le dit), part patronale de la mutuelle, avance de trésorerie, assurance facturée à part, frais de dossier ponctuels.
- **Ce que l'IA ne peut pas faire** : écrire une règle (taux de cotisation, minimum, indemnité d'apport d'affaires, réserve : ils viennent des règles de l'année), une formule ou un texte libre qui change un calcul ; changer le statut d'une activité ; appliquer elle-même la proposition. Le résumé de la proposition montre chaque condition, sa valeur avant et après, et l'effet sur le net de chaque année calculé par le moteur.
- **Taille du catalogue** : la marge mesurée le 14 octobre 2026 est d'environ 1 700 caractères (ADR 010, dernier addendum), qu'un outil de plus consomme ; la lecture du portage en a pris environ 150 (descriptions de `simuler` et `expliquer_resultat`). Le même jour que l'outil, une décision écrite en addendum de l'ADR 010 resserre des descriptions ou relève les plafonds ; `comparer_statuts` rendra la colonne sans paramètre nouveau.

### 5. Hors périmètre

| Point | Raison |
| --- | --- |
| Part patronale de la mutuelle, forfait social et CSG sur la prévoyance patronale | Garanties et prix propres à chaque contrat ; quelques dizaines à quelques centaines d'euros par an. La part salariale de la mutuelle est un réglage (décision 5) |
| Prévoyance au-delà du minimum des cadres | Idem ; le minimum de 1,50 % est modélisé |
| Limite de déduction de l'art. 83, 1° quater du CGI | Une mutuelle ordinaire et la prévoyance minimale restent en dessous |
| Indemnités kilométriques et frais de déplacement détaillés | Les frais professionnels sont un montant saisi ; le barème kilométrique existant (`frais-kilometriques.ts`) sert aux frais réels de la personne, pas aux remboursements de la société |
| Jours travaillés, forfait en jours, temps partiel, niveau de classification | Le simulateur raisonne en euros par mois ; le minimum conventionnel ne fait qu'avertir |
| Périodes sans mission, versement de la réserve entre deux missions, report de la réserve d'une année sur l'autre | Un mois sans chiffre d'affaires n'a pas de salaire ; la réserve d'un CDI est montrée conservée chaque année, sans reprise l'année suivante (première version) |
| Fin d'un CDD en cours d'année ou après | L'indemnité de précarité est supposée versée dans l'année |
| ARE et son cumul avec le salaire porté | Calcul de France Travail propre à chaque personne ; une ARE se saisit déjà sur la personne (flux `are`) |
| Frais de gestion dégressifs par tranches | Une condition, un taux ; l'IA ou l'utilisateur retient le taux applicable et le dit |
| Avance de salaire, affacturage, délais de paiement du client | Trésorerie, pas revenu de l'année |
| Plusieurs sociétés de portage pour une même personne | Une personne, un titulaire de chaque acteur ; deux acteurs en portage pour une même personne additionnent deux bulletins (les plafonds ne sont pas partagés), avec un avertissement |
| Contribution supplémentaire à l'apprentissage (250 salariés et plus) | Dépend de la part d'alternants de la société |
| Régime d'Alsace-Moselle, outre-mer | Comme pour les autres salariés du moteur |

### Alternatives écartées

- **Colonne seule, calculée hors du moteur** (option A) : deux chemins de calcul pour un même salaire, et pas de statut dans la grille.
- **Un statut juridique de société** (option C) : le portage n'a ni bénéfice, ni IS, ni dividendes ; chaque table par statut recevrait une ligne fausse.
- **Réutiliser le bulletin `"salarie"` tel quel** : il est non cadre et calculé pour une entreprise de moins de 11 salariés ; il oublierait l'APEC, la prévoyance des cadres et les taux liés à l'effectif, soit plus de 2 % du brut.
- **Un taux global « charges de portage »** (par exemple 45 % du brut), comme les simulateurs commerciaux : simple, mais contraire au principe du moteur (cotisations ligne à ligne, sourcées), et faux près du plafond.
- **Mettre les minima, l'indemnité d'apport d'affaires et la réserve dans les réglages** : ils sont fixés par la convention et identiques partout ; réglables, ils pourraient être changés par une IA.
- **Une clé `portage` dans `STATUTS_FRAIS`** : refuserait les fichiers des versions précédentes et forcerait des frais supposés sans objet.
- **Une nouvelle relation « Salarié porté »** : plus parlante, mais une valeur de plus dans l'énumération des relations, ses règles dans la fenêtre des relations et les outils ; « Titulaire » dit déjà « la personne dont c'est l'activité », l'interface l'affiche « salarié porté ».
- **Étendre `proposer_reglages_comparateur`** au lieu d'un outil dédié : moins de texte au catalogue, mais il ne peut pas viser l'acteur de la grille, et sa description devrait expliquer la traduction des conditions au milieu des autres réglages.
- **Un nouveau numéro de format** : rien à convertir ; un format 4 serait refusé par les versions précédentes (ADR 009).
- **Payer exactement l'enveloppe en résolvant `coutEmployeur(M) = E`** : impossible dans un saut du coût employeur ; le reliquat sur le compte d'activité garde l'identité du bilan au centime.

## Conséquences

- **Positives :**
  - La question « et en portage ? » a sa réponse, au même endroit et avec le même moteur que les autres statuts, calcul à l'envers compris.
  - Une personne déjà portée simule son année à partir de ce qu'elle facture, et voit où passe chaque euro (frais de gestion, cotisations, réserve).
  - Le partage entre règles (convention, loi) et conditions (société) est net : une IA ne peut régler que les secondes, bornées.
  - Les fichiers existants se lisent sans changement.
- **Négatives ou Compromis :**
  - Un type d'acteur de plus à traiter partout ; une version précédente du simulateur écarte l'acteur en portage d'un fichier récent, en le signalant.
  - Le net dépend fortement de conditions mal connues (réduction générale, effectif, versement mobilité : plus de 2 000 € d'écart sur l'exemple) ; les valeurs typiques sont prudentes et l'interface invite à saisir celles de sa société.
  - La mutuelle (part patronale) et la prévoyance réelles manquent : le net est légèrement surestimé (quelques dizaines à quelques centaines d'euros par an).
  - La réserve d'un CDI n'est pas reportée d'une année sur l'autre dans une session de plusieurs années.
  - Le taux conventionnel de formation de 2025 et 2026 est une valeur prudente, non sourcée.

### Effort estimé

| Partie | Contenu | Estimation |
| --- | --- | --- |
| Règles | Bloc `portageSalarial` (2024 à 2026) avec sources, types dans `regles.ts`, tests des règles | 1 jour (fait) |
| Moteur | Bulletin `"porte"`, frais de gestion mensuels, dichotomie sur le coût employeur, partage et réserve, foyer, avertissements | 2 à 3 jours (fait) |
| Format et nettoyage | `PortageSchema`, `ConditionsPortageSchema`, session maximale (fait) ; `ReglagesComparateurSchema.portage`, nettoyage des réglages | 1 jour |
| Comparateur | `"portage"` dans `STATUTS_COMPARES`, conversion, colonne, protection sociale, écart de frais, réglages à l'écran | 2 jours |
| Grille | Carte et fiche de l'acteur, relation affichée « salarié porté », flux permis, glisser-déposer | 2 jours |
| Exports | Markdown, CSV, PDF | 1 jour |
| IA | Lecture (fait) ; `proposer_conditions_portage`, opération `regler_portage`, avertissements, catalogue (addendum ADR 010) | 1 à 2 jours |
| Tests | Cas de référence du moteur (fait), colonne, composants, outils, « rien ne se perd » | 2 jours |

Soit environ deux semaines, en petites branches (règles et moteur ; comparateur ; grille ; exports ; IA).

### Cas de référence (tests datés, `src/backend/logic/references/portage.reference.test.ts`)

1. L'exemple ci-dessus (60 000 €, 7 %, CDD, 50 salariés et plus, sans réduction générale) : enveloppe, masse salariale, net, impôt, à l'euro. **Fait.**
2. Le même en CDI : bruts versés, réserve conservée. **Fait.**
3. Le même avec la réduction générale reversée. **Fait.**
4. Un chiffre d'affaires de 150 000 € : masse salariale au-delà du PASS (tranche 2, contribution d'équilibre technique, sans réduction générale). **Fait** (M = 96 638 €, net 76 918 €, net après impôt 62 303 €).
5. Un plancher mensuel qui joue (petit chiffre d'affaires sur trois mois, avec l'avertissement du minimum conventionnel) et un plafond qui joue (gros chiffre d'affaires, frais fixes en plus). **Fait.**
6. Des frais professionnels : l'enveloppe baisse exactement de leur montant (les frais de gestion portent sur le chiffre d'affaires), et ils n'entrent ni dans le brut ni dans l'imposable. **Fait.** (La version proposée parlait de « même enveloppe qu'un chiffre d'affaires diminué d'autant » : c'est faux, ce chiffre d'affaires diminué aurait aussi des frais de gestion plus bas.)
7. Une mutuelle de 60 € par mois : retirée du net et de l'imposable. **Fait.**
8. La colonne du comparateur pour une micro-entreprise BNC à 60 000 € : même résultat que l'acteur en portage saisi directement. **Avec la colonne.**

Le recoupement avec un simulateur public de portage et avec le simulateur de l'Urssaf pour un cadre (mon-entreprise.urssaf.fr) reste à faire (« À vérifier ») : urssaf.fr n'a pas répondu le 14 octobre 2026.

## À vérifier

1. **Base des minima par niveau** : l'art. 21.3 en vigueur ne précise « base 2017 » que pour le plancher de 69 %. Pour les niveaux (63, 70, 75, 85 %), il ne dit pas si le plafond est celui de 2017 ou celui de l'année. Les règles retiennent 2017 pour le montant du niveau expert, qui ne sert qu'au texte de l'avertissement.
2. **Formation conventionnelle de 2025 et 2026** : l'avenant n° 14 (non étendu) retire le taux de l'art. 36. Un accord du même jour créerait une autre contribution, dénoncée en juillet 2025 selon une source non officielle. Valeur prudente retenue : celle de 2024 (1,05 % ou 0,60 %), « NON SOURCÉ ».
3. **BOSS et urssaf.fr** (injoignables le 14 octobre 2026) : confirmer sur le Bulletin officiel de la sécurité sociale les assiettes de la réduction générale, du FNAL, de la participation à l'effort de construction et de la prévoyance patronale (CSG sans abattement de 1,75 %, forfait social). Faire le recoupement avec le simulateur de l'Urssaf pour un cadre.
4. **Date d'effet de la nouvelle grille des minima** : le 17 ou le 18 juillet 2024 selon la lecture de l'avenant n° 12 (art. 6.1) et de son arrêté d'extension. Sans effet sur les règles, qui gardent la valeur du 1er janvier.
5. **CGI, art. 81, 1°** : la version consultée date de 2019 ; le texte est stable, mais sa version de 2026 n'a pas été affichée.
6. **Fiche F31620** : elle cite encore l'ancien barème (77 %). À signaler à service-public.fr, ou à recontrôler avant la colonne.

## Sources consultées le 2026-10-14

**Code du travail** (Légifrance) :
- art. L1254-1 à L1254-31 ([section du portage salarial](https://www.legifrance.gouv.fr/codes/section_lc/LEGITEXT000006072050/LEGISCTA000030435227/)) ;
- art. [L5422-13](https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000006903835), [L6331-1](https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000044981927), [L6331-3](https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000044981918) ;
- art. L6241-1 ([section](https://www.legifrance.gouv.fr/codes/section_lc/LEGITEXT000006072050/LEGISCTA000006178193/)) et [L6242-1](https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000043701803) ;
- [ordonnance n° 2015-380 du 2 avril 2015](https://www.legifrance.gouv.fr/jorf/id/JORFSCTA000030431097).

**Convention collective de branche des salariés en portage salarial du 22 mars 2017** (IDCC 3219, Légifrance) :
- [texte](https://www.legifrance.gouv.fr/conv_coll/id/KALITEXT000035184768) ;
- art. 21 [en vigueur](https://www.legifrance.gouv.fr/conv_coll/article/KALIARTI000050004613) ;
- [art. 37](https://www.legifrance.gouv.fr/conv_coll/article/KALIARTI000050004610) ;
- art. 36 ([avenant n° 10](https://www.legifrance.gouv.fr/conv_coll/article/KALIARTI000043477274), [avenant n° 14](https://www.legifrance.gouv.fr/conv_coll/article/KALIARTI000051668460)) ;
- [avenant n° 12](https://www.legifrance.gouv.fr/conv_coll/id/KALITEXT000047348883/?idConteneur=KALICONT000035326397) et son [arrêté d'extension du 10 juillet 2024](https://www.legifrance.gouv.fr/jorf/id/JORFTEXT000050002857) ;
- [Conseil d'État, 19 mai 2026, n° 497965](https://www.conseil-etat.fr/fr/arianeweb/CE/decision/2026-05-19/497965).

**Prévoyance des cadres** : [ANI du 17 novembre 2017, art. 1er](https://www.legifrance.gouv.fr/conv_coll/article/KALIARTI000036732016) et [art. 2](https://www.legifrance.gouv.fr/conv_coll/article/KALIARTI000036732018) ; [arrêté d'extension du 27 juillet 2018](https://www.legifrance.gouv.fr/jorf/id/JORFTEXT000037311605/).

**APEC** (Agirc-Arrco) : [circulaire 2024-1-DRJ](https://www.agirc-arrco.fr/wp-content/uploads/2024/09/Circulaire-AgircArrco-2024-1-drj.pdf), [guide DSN 2025](https://www.agirc-arrco.fr/storage/2025/03/Aide-a-la-codification_AA_CT2025_v1.2-3.pdf), [paramètres 2026](https://www.agirc-arrco.fr/storage/CirculaireAgircArrco2025-16sg-drj.pdf).

**Code de la sécurité sociale** (Légifrance) :
- réduction générale : [art. L241-13](https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000042912368) ; art. D241-7 [en 2026](https://www.legifrance.gouv.fr/codes/id/LEGISCTA000006185779/) et [en 2024](https://www.legifrance.gouv.fr/codes/section_lc/LEGITEXT000006073189/LEGISCTA000006185779/2024-06-01/) ; [décret n° 2025-318](https://www.legifrance.gouv.fr/jorf/id/JORFTEXT000051430146) ;
- CSG : [art. L136-1-1](https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000053282440) ;
- forfait social : art. L137-15 et L137-16 ([section](https://www.legifrance.gouv.fr/codes/section_lc/LEGITEXT000006073189/LEGISCTA000019946240/)).

**Code de la construction et de l'habitation** : [art. L813-5](https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000038839912) (FNAL), art. L313-1 ([section](https://www.legifrance.gouv.fr/codes/id/LEGISCTA000006176366), participation à l'effort de construction) ; [BOI-TPS-PEEC-10](https://bofip.impots.gouv.fr/bofip/6360-PGP.html/identifiant=BOI-TPS-PEEC-10-20141218).

**Frais professionnels et impôt** :
- arrêtés du [20 décembre 2002](https://www.legifrance.gouv.fr/loda/id/LEGITEXT000005633729) et du [4 septembre 2025](https://www.legifrance.gouv.fr/jorf/id/JORFTEXT000052198430) ;
- [CGI, art. 81, 1°](https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000038836748/2019-10-01) et [art. 83, 1° quater](https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000053545390) ;
- [BOI-RSA-CHAMP-20-50-10](https://bofip.impots.gouv.fr/bofip/5612-PGP.html/identifiant=BOI-RSA-CHAMP-20-50-10-20200710).

**Versement mobilité** :
- CGCT, art. L2333-64 et suivants ([section](https://www.legifrance.gouv.fr/codes/id/LEGISCTA000039802388)) et [art. L2531-4](https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000048837031) ;
- [table des taux de l'Urssaf](https://open.urssaf.fr/api/explore/v2.1/catalog/datasets/table_taux_vmrr/records) ;
- [fiche F31031](https://entreprendre.service-public.gouv.fr/vosdroits/F31031).

**Fiches et rapports** :
- [Portage salarial, fiche F31620](https://entreprendre.service-public.gouv.fr/vosdroits/F31620) (Entreprendre.Service-Public.gouv.fr ; vérifiée par le site le 28 mai 2026, ancien barème des minima) ;
- [Qui dois-je assurer contre le risque de chômage ?](https://www.unedic.org/l-assurance-chomage-et-vous/employeur-du-secteur-prive/mes-demarches/qui-dois-je-assurer-contre-le-risque-de-chomage) (Unédic) ;
- [rapport de l'IGAS RM2011-128P](https://www.vie-publique.fr/files/rapport/pdf/114000584.pdf) sur le portage salarial (mécanisme des frais de gestion, sans chiffre).

**Règles du simulateur** : `regimeGeneral`, `portageSalarial` et `IR` de `src/backend/regles/2026.json` (et 2024, 2025).

**Injoignables ce jour-là** : boss.gouv.fr, urssaf.fr (hors open.urssaf.fr) et web.archive.org. Rien n'en est cité ; voir « À vérifier ».

**Sources non officielles**, écartées de la décision : les sites d'information et commerciaux sur la convention (fourchette des frais de gestion), le tableau de la CAPEB de l'Hérault et la notice Apicil 2026 que citait la version proposée, et une source sur l'accord de formation du 24 février 2025.
