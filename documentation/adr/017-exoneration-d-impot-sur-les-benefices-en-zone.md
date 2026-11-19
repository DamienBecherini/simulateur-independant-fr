# ADR-017: Exonération d'impôt sur les bénéfices en zone (ZFU-TE et QPV)

- **Date :** 2026-11-19
- **Statut :** Accepté (2026-11-19)

## Contexte

Un utilisateur dont la société bénéficie de la ZFU-TE a demandé que le simulateur en tienne compte ([issue 1](https://github.com/DamienBecherini/simulateur-independant-fr/issues/1)) : « 50 k€ de bénéfice exonéré d'IS sur les cinq premières années, qui permettent d'arbitrer sur la rémunération finale ». Sans cela, le simulateur lui conseille une rémunération et des dividendes calculés avec un impôt sur les sociétés qu'il ne paie pas : le meilleur net affiché n'est pas le sien.

Le droit a changé au 1er janvier 2026 : la ZFU-TE est fermée aux créations, et un régime en quartiers prioritaires de la politique de la ville (QPV) lui succède. Les deux coexistent pendant des années : une activité créée en 2025 en ZFU-TE garde une exonération, dégressive, jusqu'en 2032 ou 2033.

Cette ADR fixe le modèle de calcul, la place du dispositif dans l'interface, le format de fichier et ce qui n'est pas modélisé. Elle fixe aussi une règle d'interface pour les dispositifs qui ne concernent qu'une petite part des utilisateurs.

### Ce que disent les textes (sources officielles, consultées le 2026-11-19)

| | ZFU-TE, article 44 octies A du CGI | QPV, article 44 octies B du CGI |
|---|---|---|
| Texte | BOI-BIC-CHAMP-80-10-30 du 2 juillet 2025 | article 42 de la loi n° 2026-103 du 19 février 2026, en vigueur depuis le 1er janvier 2026 |
| Activités concernées | créées jusqu'au 31 décembre 2025 (§ 122) ; elles gardent leur exonération jusqu'à son terme | créées ou reprises du 1er janvier 2026 au 31 décembre 2030 dans un QPV |
| Exonération totale | 60 mois à partir du premier jour du mois du début d'activité (§ 130, 150) | jusqu'au terme du 59e mois suivant celui de la création |
| Ensuite | bénéfice imposé à 40 %, 60 % puis 80 % sur les trois périodes de douze mois suivantes (§ 160), soit 60 %, 40 % puis 20 % exonérés | identique (I, C) |
| Plafond | 50 000 € de bénéfice exonéré par période de douze mois (créations depuis 2015, § 200), plus 5 000 € par salarié embauché, domicilié en ZFU-TE ou en QPV, à temps plein depuis six mois (§ 210 à 218) | aucun plafond annuel ; seul joue le plafond européen des aides de minimis (règlement (UE) 2023/2831 : 300 000 € sur trois exercices) |
| Activités | commerciales, artisanales, industrielles, libérales ; exclus : crédit-bail mobilier, location d'immeubles d'habitation, quelques secteurs (automobile, naval, fibres, sidérurgie, transport routier de marchandises) | commerciales, artisanales, professions de santé de la quatrième partie du code de la santé publique ; **les autres professions libérales en sont exclues** |
| Régime d'imposition | réel ou micro | impôt sur le revenu ou sur les sociétés ; bénéfices déclarés selon les articles 50-0 (micro-BIC), 53 A, 96 à 100, 102 ter (micro-BNC), 103 |
| Taille | moins de 50 salariés ; chiffre d'affaires ou bilan de 10 M€ au plus | moins de 50 salariés ; chiffre d'affaires ou bilan sous 10 M€ |
| Emploi | à partir du deuxième salarié, la moitié des salariés en CDI ou en CDD d'au moins douze mois réside en ZFU-TE ou dans un QPV de l'unité urbaine (§ 124) | aucune clause |
| Activité en partie hors zone | bénéfices réalisés hors zone exclus | exonération au prorata du chiffre d'affaires hors taxes réalisé dans le QPV ; activité non sédentaire : exonération entière dès 25 % du chiffre d'affaires dans le QPV |

Trois règles communes aux deux régimes :

- **Les deux calendriers se confondent.** « Soixante mois à partir du premier jour du mois de création » et « jusqu'au terme du 59e mois suivant celui de la création » désignent les mêmes soixante mois.
- **Revenu fiscal de référence** (article 1417, IV, 1°, b du CGI, version en vigueur au 19 novembre 2026) : le bénéfice exonéré au titre des articles 44 octies A et 44 octies B s'y ajoute. Il compte donc pour l'accès au versement libératoire deux ans plus tard (`rfr-n2.ts`).
- **Cotisations sociales :** l'exonération porte sur l'impôt. Les cotisations d'un travailleur indépendant restent calculées sur le bénéfice entier, celles d'une micro-entreprise sur le chiffre d'affaires.

**Versement libératoire** (BOI-BIC-DECLA-10-40-20 du 1er juin 2018, version en vigueur, § 130 à 150) : une micro-entreprise qui a opté pour le versement libératoire n'a pas droit aux exonérations de zone, « déterminées selon le résultat net de l'entreprise », alors que le versement libératoire porte sur le chiffre d'affaires. Qui veut l'exonération reste au régime micro et n'opte pour le versement libératoire qu'à l'issue de la période d'exonération. Le texte cite l'article 44 octies A ; il est appliqué par analogie à l'article 44 octies B, pas encore commenté.

**Calcul du bénéfice exonéré** (BOI-BIC-CHAMP-80-10-20-40 du 5 août 2015, auquel renvoie le § 180 du commentaire de la ZFU-TE) : le bénéfice exonéré s'entend « après déduction des déficits reportables » (§ 100) ; le plafond s'applique au bénéfice « après application des abattements dégressifs » (§ 260) ; pour une micro-entreprise, le bénéfice est le chiffre d'affaires après l'abattement forfaitaire (§ 20). Certains produits n'ouvrent pas droit à l'exonération (dividendes, subventions, produits financiers nets, § 110 à 160).

## Décisions du propriétaire (2026-11-19)

1. **Rien de visible tant que le dispositif n'est pas activé** : une case à cocher, dans une section repliée de la fiche de l'activité ; le régime et le taux se déduisent de la date de création.
2. **Pas de champ pour les salariés qui majorent le plafond de la ZFU-TE** : la majoration n'est pas comptée, et une note le dit.
3. **Professions libérales en QPV : avertir sans bloquer.** Seules les professions de santé ont droit au régime ; le simulateur ne connaît pas toutes les professions de santé (médecins, dentistes et sages-femmes sont absents de la liste de l'ADR 015).
4. **Une seule situation type : « SASU en zone franche urbaine (ZFU-TE) »**, créée en janvier 2024, bénéfice au-delà de 50 000 € : elle répond à l'issue 1 et montre le plafond, donc un vrai arbitrage entre rémunération, dividendes et réserve. Son texte dit qu'une création depuis 2026 relève du régime QPV, sans plafond.
5. **Les hypothèses du calcul sont montrées à qui active le dispositif** : ce qui n'a pas pu être confirmé sur un texte officiel, ou que l'administration n'a pas encore commenté, s'affiche dans la fiche de l'activité, sous la case cochée.

## Décision

**Une activité peut être déclarée « implantée en zone ». Le moteur en déduit, d'après son mois de création et les règles de l'année, le régime (ZFU-TE ou QPV), la part du bénéfice exonérée cette année-là, et retire ce bénéfice exonéré de l'assiette de l'impôt sur les sociétés ou de l'impôt sur le revenu.**

### 1. Format de fichier

Un champ facultatif sur `Company` et `MicroEntreprise` (pas sur `Portage` : c'est un salaire) :

```ts
implantationEnZone?: {
  /** Part du chiffre d'affaires hors taxes réalisée dans la zone, de 0 à 1. Absente : 1. */
  partDuChiffreDAffaires?: number
}
```

Sa présence vaut la case cochée. Le régime n'est pas enregistré : il se déduit de `dateDeCreation`. Champ facultatif, donc pas de nouvelle version du format (ADR 005) ; une session d'avant se lit telle quelle. Une valeur hors bornes est écartée seule, comme les autres réglages.

### 2. Règles de l'année

Dans le fichier de chaque année (`regles/2024.json`, `2025.json`, `2026.json`), une rubrique `exonerationsDeZone`, avec description et source pour chaque régime :

```json
"exonerationsDeZone": {
  "zfuTe": { "creationDepuis": "2015-01", "creationJusquA": "2025-12", "moisExonerationTotale": 60, "partsExonereesEnsuite": [0.6, 0.4, 0.2], "plafondAnnuel": 50000 },
  "qpv":   { "creationDepuis": "2026-01", "creationJusquA": "2030-12", "moisExonerationTotale": 60, "partsExonereesEnsuite": [0.6, 0.4, 0.2], "plafondAnnuel": null }
}
```

Chaque régime porte aussi ses `hypotheses` : la liste des phrases montrées à l'utilisateur (décision 5). Elles vivent avec les règles : une hypothèse confirmée ou démentie se retire ou se corrige là, sans toucher au code.

Les années 2024 et 2025 n'ont que `zfuTe`. Le régime retenu est celui dont la fenêtre contient le mois de création ; aucun : pas d'exonération, et la carte le dit (créée avant 2015, ou après 2030).

### 3. Calcul

Dans `dispositifs.ts`, à côté de l'ACRE et de la CFE, une fonction pure :

1. **Part exonérée de l'année.** Chaque mois d'activité de l'année a son taux, d'après son rang depuis le mois de création : 100 % les soixante premiers mois, puis 60 %, 40 % et 20 % par tranches de douze mois, 0 % ensuite. La part de l'année est la moyenne des taux de ses mois d'activité : le bénéfice est réparti également entre les mois (prorata du temps), pas d'après le chiffre d'affaires de chaque mois. Exemple : créée en mars 2021, l'activité est exonérée en 2026 à (2 × 100 % + 10 × 60 %) / 12 = 66,7 %.
2. **Bénéfice exonéré** = bénéfice imposable positif × part du chiffre d'affaires dans la zone × part exonérée de l'année.
3. **Plafond** (ZFU-TE) : le bénéfice exonéré ne dépasse pas 50 000 € × mois d'activité de l'année / 12. Le plafond porte sur le bénéfice exonéré, donc après le taux dégressif.

Le bénéfice imposable et la suite, par statut :

- **SASU, EURL (impôt sur les sociétés)** : le bénéfice imposable est le bénéfice après imputation du déficit reportable (ADR 014). L'impôt sur les sociétés se calcule sur le bénéfice imposable diminué du bénéfice exonéré, le taux réduit jouant sur ce reste. La réserve légale, le bénéfice distribuable et les réserves suivent : moins d'impôt, plus à distribuer ou à garder. Les dividendes restent imposés comme avant chez l'associé, et rien ne s'ajoute au revenu fiscal de référence (l'article 1417 vise les bénéfices exonérés d'impôt sur le revenu).
- **Entreprise individuelle au réel** : le bénéfice imposable de l'exploitant est diminué du bénéfice exonéré ; les cotisations sociales ne changent pas ; le bénéfice exonéré s'ajoute au revenu fiscal de référence du foyer. Un déficit ne donne aucune exonération.
- **Micro-entreprise** : le bénéfice imposable est le chiffre d'affaires après l'abattement forfaitaire. Même traitement que l'entreprise individuelle. Avec le versement libératoire appliqué cette année : aucune exonération, et une note explique qu'il faut y renoncer pour en bénéficier.

Le résultat de l'activité porte le bénéfice exonéré et le régime (`ActivityResult.exonerationDeZone`), et celui du foyer la part ajoutée à son revenu fiscal de référence.

**Le reste suit sans code propre**, puisqu'il passe par le moteur : comparateur (l'exonération suit l'activité dans les colonnes SASU, EURL, EI et micro ; la colonne « micro avec versement libératoire » et le portage n'en ont pas, et le disent), « Rémunération ou dividendes ? » et meilleur net, « Combien facturer pour un net visé ? », « Sur toutes les années » (la sortie progressive apparaît d'elle-même d'une année à l'autre).

### 4. Interface : la règle des dispositifs de niche

**Un dispositif qui ne concerne qu'une petite part des utilisateurs n'occupe aucune place sur l'écran principal tant qu'il n'est pas activé.** Il s'active dans la fiche de l'activité, dans une section repliée ; ce qui peut se déduire d'une donnée déjà saisie ne se demande pas ; il n'apparaît ailleurs qu'une fois actif, et là où il change un chiffre. Cette règle vaut pour les prochains dispositifs de ce genre (autres zones, aides locales).

Pour celui-ci :

- **Fiche de l'activité** (`ChampsDeLActeur.tsx`), pour une société ou une micro-entreprise : une section repliée « Aides liées au lieu d'implantation », fermée par défaut (`Depliable`), ouverte d'office quand la case est cochée. Dedans : la case « Activité implantée en zone franche urbaine (ZFU-TE) ou en quartier prioritaire (QPV) », et un lien vers la carte officielle des quartiers pour vérifier une adresse.
- **Hypothèses du calcul** (décision 5) : sous la case cochée, une liste courte « Ce que ce calcul suppose », tirée des règles de l'année. Au 19 novembre 2026 : une année à cheval sur deux taux est répartie également entre ses mois (aucune règle officielle explicite) ; les cotisations sociales sont calculées sur le bénéfice entier, exonération comprise (non confirmé sur le texte) ; pour le régime QPV, l'administration n'a pas encore publié son commentaire, et la règle du versement libératoire de la ZFU-TE lui est appliquée par analogie. L'avertissement de l'activité y renvoie (« hypothèses du calcul dans la fiche de l'activité »), l'export Markdown les reprend, et les outils pour l'IA les restituent avec le résultat.
- **Case cochée** : une phrase calculée (« Créée en mars 2024 : ZFU-TE, bénéfice exonéré d'impôt à 100 % jusqu'en février 2029, puis à 60 %, 40 % et 20 % ») et un seul champ, « Part du chiffre d'affaires réalisée dans la zone », à 100 %. Sans date de création, la phrase la demande (le champ est juste au-dessus) et rien n'est exonéré.
- **Carte de l'activité** : une mention parmi les dispositifs de l'année (`ActivityResult.dispositifs`, comme l'ACRE) : « ZFU-TE : bénéfice exonéré d'impôt à 100 % en 2026 (12 400 €) », ou « exonération terminée depuis mars 2032 ».
- **Résultats et exports** (CSV, Markdown) : une ligne « Bénéfice exonéré d'impôt » quand elle n'est pas nulle.
- **Avertissements**, seulement quand le dispositif est actif, en un seul message par activité : les conditions que le simulateur ne vérifie pas (taille, clause d'emploi de la ZFU-TE, aides de minimis, activités exclues) et la majoration par salarié non comptée ; plus, selon le cas : plafond de 50 000 € atteint ; recettes libérales en QPV (« seules les professions de santé y ont droit ») ; versement libératoire.
- **Aucun réglage dans le comparateur**, aucune ligne dans la grille, aucun bouton sur les cartes.

### 5. Pour que les intéressés le trouvent

- **Une situation type**, « SASU en zone franche urbaine (ZFU-TE) » (décision 4), avec son lien public (`#situation=sasu-en-zone-franche-urbaine`, voir `liens-vers-les-situations-types.md`).
- **Avec une IA** : le champ fait partie des réglages d'un acteur, que `proposer_modification` sait déjà changer ; `lire_simulation` et les résultats le restituent. Pas de nouvel outil (dix-sept).
- **Documentation** : guide de l'utilisateur, Roadmap (ligne « Dispositifs limités dans le temps »), CHANGELOG.

### 6. Hors périmètre

- Produits exclus de l'exonération (dividendes reçus, subventions, produits financiers nets) : le simulateur n'a pas ces flux pour une activité.
- Majoration du plafond de la ZFU-TE par salarié embauché ; clause d'emploi local ; seuils de taille ; plafond des aides de minimis ; secteurs exclus : signalés, pas calculés.
- Activité non sédentaire (règle des 25 %) : l'utilisateur saisit lui-même 100 %.
- Reprises d'activité, transferts, restructurations, option entre régimes de zone, reversement en cas de départ du quartier.
- Exercice décalé : l'exercice est l'année civile, comme partout dans le simulateur.
- Exonérations de cotisation foncière et de taxe foncière en QPV : la CFE se règle déjà dans les frais de fonctionnement du comparateur.
- Autres zones (France ruralités revitalisation, bassins d'emploi à redynamiser, zones de restructuration de la défense…) : la section « Aides liées au lieu d'implantation » pourra les accueillir.
- EURL à l'impôt sur le revenu : le statut n'existe pas dans le simulateur.

### Alternatives écartées

- **Choisir le régime dans une liste** (ZFU-TE ou QPV) : la date de création le donne sans erreur possible, et une liste oblige l'utilisateur à connaître le droit.
- **Saisir le taux d'exonération de l'année** : plus simple à coder, mais à refaire chaque année et faux sur une session de plusieurs années, alors que la sortie progressive est précisément ce qui fait bouger l'arbitrage.
- **Un réglage dans le comparateur** : le dispositif tient à l'activité, pas à la comparaison, et il chargerait un écran que tout le monde voit.
- **Refuser le calcul quand une condition semble manquer** (profession libérale hors santé en QPV, par exemple) : le simulateur ne connaît ni toutes les professions de santé ni l'adresse ; il avertit, et l'utilisateur, qui a coché la case, décide.

## Conséquences

- **Positives :**
  - Le meilleur net, l'arbitrage rémunération / dividendes et la comparaison des statuts deviennent justes pour une activité en zone, y compris l'année où l'exonération diminue.
  - Le revenu fiscal de référence reste exact, donc l'accès au versement libératoire aussi.
  - L'interface de tous les autres utilisateurs gagne une ligne repliée dans une fiche, rien de plus.
  - La règle des dispositifs de niche est écrite : les prochains suivront le même chemin.
- **Négatives ou compromis :**
  - Les conditions d'accès ne sont pas vérifiées : une case cochée à tort donne un net trop beau. L'avertissement le rappelle à chaque calcul.
  - Le bénéfice est réparti également entre les mois de l'année, même si le chiffre d'affaires ne l'est pas.
  - Sans la majoration par salarié, une ZFU-TE qui emploie des résidents de la zone et dépasse 50 000 € de bénéfice est exonérée un peu moins qu'en réalité.
  - Le plafond des aides de minimis n'étant pas suivi, un bénéfice très élevé en QPV est exonéré sans limite.

### Effort estimé

| Lot | Contenu | Taille |
|---|---|---|
| 1 | Règles des trois années, schéma, calendrier et plafond (`dispositifs.ts`), tests unitaires | petit |
| 2 | Impôt sur les sociétés, entreprise individuelle, micro-entreprise, revenu fiscal de référence ; cas de référence chiffrés | moyen |
| 3 | Fiche de l'activité, mention sur la carte, ligne des résultats, avertissements ; tests d'interface et d'accessibilité | moyen |
| 4 | Comparateur (notes des colonnes), exports, outils pour l'IA | petit |
| 5 | Situation type et son lien, documentation, CHANGELOG | petit |

### Cas de référence prévus (`references/exoneration-de-zone.reference.test.ts`)

1. SASU en ZFU-TE créée en 2024, bénéfice de 30 000 € en 2026 : aucun impôt sur les sociétés.
2. La même avec 80 000 € : 50 000 € exonérés, impôt sur 30 000 € au taux réduit.
3. SASU en ZFU-TE créée en mars 2021, année 2026 : part exonérée de 66,7 %.
4. SASU en QPV créée en juillet 2026 : exonération entière, sans plafond ; la même avec 60 % du chiffre d'affaires dans le quartier.
5. Entreprise individuelle au réel en ZFU-TE : impôt du foyer réduit, cotisations inchangées, revenu fiscal de référence inchangé.
6. Micro-entreprise en QPV sans versement libératoire, puis avec : exonérée, puis non.
7. Activité créée en 2014, ou cochée sans date de création : aucune exonération, mention sur la carte.

## À vérifier

Confirmé le 19 novembre 2026, après la première rédaction : l'incompatibilité avec le versement libératoire en ZFU-TE, l'imputation du déficit reportable avant l'exonération, le plafond appliqué après le taux dégressif, le bénéfice d'une micro-entreprise après abattement (voir « Ce que disent les textes »).

Restent ouverts ; tant qu'ils le sont, ils figurent dans les `hypotheses` des règles et s'affichent à l'utilisateur :

- **Année à cheval sur deux taux** : le BOFiP raisonne par périodes de douze mois et répartit par douzièmes dans des cas voisins (BOI-BIC-CHAMP-80-10-20-40, § 250 et 340 ; BOI-BIC-CHAMP-80-10-30, § 100), sans règle explicite pour un exercice qui chevauche deux taux. Le prorata des mois, et celui du plafond l'année de création, sont des choix de modélisation.
- **Cotisations sociales de l'entreprise individuelle** : confirmer dans l'article L131-6 du code de la sécurité sociale, ou au BOSS, que le bénéfice exonéré reste dans leur assiette.
- **Commentaire du BOFiP sur le régime QPV**, à sa publication : versement libératoire, professions de santé, micro-entreprise, plafond.

## Sources consultées le 2026-11-19

- [Article 44 octies B du CGI](https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000053521035) (Légifrance, version en vigueur)
- [Article 1417 du CGI](https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000054373249/2026-11-19) (Légifrance, version en vigueur)
- [BOI-BIC-CHAMP-80-10-30, ZFU-TE de troisième génération](https://bofip.impots.gouv.fr/bofip/5903-PGP.html/identifiant=BOI-BIC-CHAMP-80-10-30-20250702) (BOFiP, 2 juillet 2025)
- [Exonération d'impôt sur les bénéfices dans les ZFU-TE](https://bpifrance-creation.fr/encyclopedie/aides-a-creation-a-reprise-dentreprise/aides-fiscales/exoneration-dimpot-benefices-zfu) (Bpifrance Création, avril 2026)
- [Quelles exonérations d'impôt dans les quartiers prioritaires de la ville ?](https://www.economie.gouv.fr/entreprises/trouver-des-aides-et-des-financements/les-aides-limplantation-geographique/quelles-exonerations-dimpot-dans-les-quartiers-prioritaires-de) (economie.gouv.fr)
- [Réforme des exonérations fiscales en QPV](https://anct.gouv.fr/programmes-dispositifs/politique-de-la-ville/reforme-des-exonerations-fiscales-en-quartiers) (ANCT)
- [BOI-BIC-DECLA-10-40-20, versement libératoire](https://bofip.impots.gouv.fr/bofip/4789-PGP.html/identifiant=BOI-BIC-DECLA-10-40-20-20180601) (BOFiP, 1er juin 2018, version en vigueur)
- [BOI-BIC-CHAMP-80-10-20-40, portée et calcul des allègements en ZFU](https://bofip.impots.gouv.fr/bofip/9605-PGP.html/identifiant=BOI-BIC-CHAMP-80-10-20-40-20150805) (BOFiP, 5 août 2015, version en vigueur)
- [Zones franches urbaines : les micro-entrepreneurs au versement libératoire](https://www.bncplus.fr/actualites/zones-franches-urbaines-les-micro-entrepreneurs-ne-peuvent-pas-beneficier-de) (BNC+, sur l'arrêt de la CAA de Douai du 4 mars 2021)
