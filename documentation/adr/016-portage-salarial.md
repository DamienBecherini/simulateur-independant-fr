# ADR-016: Portage salarial

- **Date :** 2026-10-14
- **Statut :** Proposé

## Contexte

« Et en portage salarial ? » est l'une des premières questions d'un indépendant qui hésite entre les statuts : le portage promet la protection d'un salarié (assurance chômage, régime général, mutuelle) sans créer de structure, contre des frais de gestion et des cotisations de salarié. Le comparateur (micro-entreprise avec et sans versement libératoire, EI au réel, SASU, EURL) n'a pas de colonne pour y répondre, et la grille ne sait pas représenter une personne portée : on peut y saisir un salaire, mais pas le chiffre d'affaires facturé dont il découle. La phase 18 de la feuille de route (point 3) demande une colonne du comparateur et un statut de la grille, avec des conditions réglables parce qu'elles varient d'une société de portage à l'autre, et une IA capable de traduire ces conditions en réglages au schéma fixe.

Cette ADR fixe, avant d'écrire du code, le modèle de calcul, la place du portage dans l'application, les réglages, le format de fichier, l'outil pour les IA et ce qui n'est pas modélisé.

### Ce que disent les textes (consultés le 2026-10-14)

**Fixé par la loi ou par la convention de branche, identique dans toutes les sociétés de portage :**

- **Définition et conditions** (code du travail, art. L1254-1 et L1254-2 I ; [fiche Entreprendre F31620](https://entreprendre.service-public.gouv.fr/vosdroits/F31620)) : le salarié porté a l'expertise, la qualification et l'autonomie de trouver ses clients et de négocier ses prix ; niveau bac + 2 ou trois ans d'expérience dans le secteur ; une prestation dure au plus 36 mois chez un même client ; les services à la personne sont exclus. Le portage porte sur des **prestations de services**.
- **Contrat** (fiche F31620) : CDD de portage (18 mois au plus, renouvellement compris) ou CDI de portage. **Les périodes sans prestation ne sont pas rémunérées** (art. L1254-21 II) et l'entreprise de portage n'est pas tenue de fournir du travail (art. L1254-2 III).
- **Rémunération minimale** (art. L1254-2 II) : fixée par accord de branche étendu, à défaut 75 % du plafond mensuel de la sécurité sociale pour un temps plein. La convention collective de branche des salariés en portage salarial du 22 mars 2017 (IDCC 3219, [texte sur Légifrance](https://www.legifrance.gouv.fr/conv_coll/id/KALITEXT000035184768)), art. 21.3 dans sa version en vigueur, fixe un salaire mensuel minimum de 63 % (premier niveau), 70 % (junior), 75 % (senior) ou 85 % (forfait en jours) du plafond de la sécurité sociale **de 2017**, compté à la journée, à la demi-journée ou à l'heure. La fiche F31620 donne les montants en euros (70 % : 2 288,30 € ; 75 % : 2 451,75 € ; 85 % : 2 778,65 € par mois), qui correspondent bien au plafond mensuel de 2017 (3 269 €) : **les minima ne suivent pas le plafond de l'année**.
- **Indemnité d'apport d'affaires : 5 %** de la rémunération brute mensuelle (convention, art. 21.2 ; art. L1254-25 pour son information mensuelle).
- **Réserve financière : 10 %** (convention, art. 21.3 et 21.4) : en CDI, 10 % du salaire de base de la dernière mission, mis sur le compte d'activité pour financer les périodes sans mission ; en CDD, une indemnité de précarité de 10 % versée en fin de contrat.
- **Compte d'activité et relevé mensuel** (art. L1254-25) : chaque mois, le salarié porté reçoit le détail du versement du client, des frais de gestion, des frais professionnels, des prélèvements sociaux et fiscaux, de sa rémunération nette et de l'indemnité d'apport d'affaires. Le calcul de la convention (art. 21.2) est : « prix de la prestation HT encaissé – frais de gestion = montant disponible », qui finance les cotisations, la rémunération, l'indemnité d'apport d'affaires, les congés payés, l'indemnité de fin de CDD et les frais professionnels.
- **Catégorie** : le salarié porté est « technicien – agent de maîtrise ou cadre » selon son expertise (convention, chapitre V). En pratique il est presque toujours cadre (forfait en jours), d'où la cotisation APEC et la prévoyance des cadres (1,50 % de la tranche 1 à la charge de l'employeur, accord national interprofessionnel du 17 novembre 2017).
- **Formation professionnelle conventionnelle** (convention, art. 36, en vigueur étendu) : 1,05 % de la masse salariale sous 11 salariés, 0,60 % à partir de 11, en plus de la contribution légale.
- **Assurance chômage** : le salarié porté en relève ([Unédic](https://www.unedic.org/l-assurance-chomage-et-vous/employeur-du-secteur-prive/mes-demarches/qui-dois-je-assurer-contre-le-risque-de-chomage) ; fiche F31620, qui ajoute qu'il peut cumuler l'ARE avec les revenus d'une activité portée). L'employeur paie donc l'assurance chômage et l'AGS, comme pour tout salarié.
- **Pas d'ACRE** : c'est une aide aux créateurs d'entreprise ; le salarié porté n'en crée pas.

**Variable d'une société de portage à l'autre, donc réglable :**

- **Les frais de gestion** : aucun texte n'en fixe le taux ni la forme (la convention les déduit sans les chiffrer ; la fiche F31620 dit seulement qu'ils rémunèrent la société). Fourchette relevée : 5 à 10 % du chiffre d'affaires HT (sites d'information sur la convention, non officiels) ; une étude de la DARES citée par la recherche web parle d'environ 10 % « pour les frais de gestion et autres services », document non lu (page protégée). Certaines sociétés ajoutent un plancher ou un plafond mensuel, ou des frais fixes par mois.
- **Le contrat proposé** (CDD ou CDI) et donc la forme de la réserve.
- **L'effectif de la société de portage**, dont dépendent plusieurs cotisations patronales (FNAL, formation professionnelle, participation à l'effort de construction, versement mobilité selon la commune), et le taux d'accidents du travail.
- **Ce que la société fait de la réduction générale des cotisations patronales** : la loi l'ouvre pour tout salarié payé moins de 3 SMIC, donc pour la plupart des salariés portés ; aucune source consultée ne dit si les sociétés la reversent au salarié (en salaire) ou la gardent. C'est une condition commerciale.
- **Le contrat de prévoyance et la mutuelle** au-delà des minima (garanties, parts salariale et patronale).

## Décision

**Le portage salarial devient un type d'acteur de la grille, « Activité en portage salarial », et une colonne « Portage salarial » du comparateur, calculée en convertissant l'activité comparée dans ce type d'acteur, comme on la convertit aujourd'hui en micro-entreprise. Les conditions de la société de portage sont un objet au schéma fixe, `ConditionsPortage`, porté par l'acteur et par les réglages du comparateur ; le droit et la convention restent dans les règles de l'année.**

### 1. Modèle de calcul, pas à pas

Pour une année, à partir de la grille de l'acteur (ou de l'activité convertie) :

1. **Chiffre d'affaires facturé** `CA` : les prestations de services HT du mois (`ca_services`), facturées par la société de portage. La vente de marchandises n'est pas permise en portage : une activité qui en a voit, dans la colonne, sa vente écartée avec un avertissement, et la colonne est écartée du meilleur net si elle n'a que de la vente (`statutActuelNonRetenu` de l'ADR 009, avec sa raison).
2. **Frais de gestion**, **mois par mois** (le plancher et le plafond sont mensuels) : pour chaque mois où `CA_mois > 0`,
   `FG_mois = min(plafond, max(plancher, taux × CA_mois)) + fraisFixesMensuels`, borné à `CA_mois`.
   Un mois sans chiffre d'affaires n'a ni frais de gestion ni salaire (période sans mission, art. L1254-21 II).
3. **Frais professionnels remboursés** `FP` : les charges saisies sur l'acteur (`deductible_expense`), remboursées sur justificatifs hors salaire. Elles sont dépensées, donc absentes du net, mais ni cotisées ni imposées. Dans la colonne, les charges de l'activité comparée deviennent ces frais, comme elles deviennent des charges dans les autres statuts au réel.
4. **Enveloppe disponible** : `E = CA − FG − FP` sur l'année (0 si négative, avec un avertissement : les frais dépassent le chiffre d'affaires).
5. **Masse salariale brute** `M` : le brut annuel total tel que `coutEmployeur(M) = E`, trouvé par dichotomie, comme `brutPourUnNet` trouve un brut à partir d'un net (`cotisationsSalarie.ts`) : le coût employeur n'est pas linéaire (tranches du plafond, contribution d'équilibre technique, réduction générale). `coutEmployeur` est `calculerCotisationsSalarie(M, "porte", règles)` : un **troisième statut de bulletin**, `"porte"`, à côté de `"president"` et `"salarie"`, qui reprend toutes les cotisations du salarié et y ajoute celles du cadre en portage (voir plus bas).
6. **Partage de la masse salariale** (information et réserve) : salaire de base `B = M / (1 + 5 % + 10 %)`, indemnité d'apport d'affaires `5 % × B`, réserve ou indemnité de précarité `10 % × B` (taux des règles de l'année). Les congés payés sont dans `B` : sur une année, ils sont du salaire versé comme un autre et ne changent pas les cotisations.
   - **CDD** : l'indemnité de précarité est versée en fin de contrat, supposée dans l'année ; tout `M` est versé.
   - **CDI** : la réserve reste sur le compte d'activité. Elle est montrée comme **« conservé »**, au même titre que le résultat conservé d'une société (ADR 014), et sort du net de l'année ; le reste de `M` est versé. Approximation : les cotisations de la réserve sont prises au prorata de `M`, comme si elle était versée au même taux.
7. **Salaire net** : `net = M_versé − cotisations salariales` (CSG et CRDS comprises), au prorata pour la part versée.
8. **Impôt du foyer** : le net imposable (net + CSG non déductible et CRDS) rejoint les salaires de la personne dans `impot-du-foyer.ts`, avec la déduction de 10 % ou ses frais réels (`FraisReels`, déjà saisis sur la personne). Les frais professionnels remboursés ne sont pas imposables.
9. **Protection sociale** : celle d'un salarié du régime général (`protection-sociale.ts`, statut « salarié ») : trimestres de retraite d'après le brut, indemnités journalières, assurance chômage.
10. **Contrôle du minimum conventionnel** : si le salaire de base mensuel moyen des mois avec chiffre d'affaires est sous le minimum d'un temps plein (montant de la convention, en euros, dans les règles), un avertissement le signale, sans rien changer au calcul (le minimum se compte au jour ou à l'heure, que le simulateur ne connaît pas).

#### Le bulletin `"porte"`

Il part du bulletin `"salarie"` (`calculerCotisationsSalarie`, règles `regimeGeneral` de l'année) et en change, par des règles nouvelles d'un bloc `portageSalarial` du fichier de l'année, chacune avec `description` et `source` :

| Ligne | Salarié actuel du moteur | Salarié porté |
| --- | --- | --- |
| Catégorie | non cadre | cadre |
| APEC | non | 0,024 % salarié, 0,036 % employeur, jusqu'à 4 PASS |
| Prévoyance des cadres | non | 1,50 % employeur sur la tranche 1 (minimum de l'ANI du 17/11/2017) |
| FNAL | 0,10 % jusqu'au PASS (moins de 50 salariés) | selon l'effectif réglé : 0,50 % sur tout le brut à partir de 50 |
| Formation professionnelle | 0,55 % (moins de 11) | selon l'effectif : 0,55 % ou 1 %, plus la contribution conventionnelle (1,05 % ou 0,60 %) |
| Participation à l'effort de construction | non | 0,45 % à partir de 50 salariés |
| Versement mobilité | non | taux réglé (0 par défaut) |
| Réduction générale | appliquée | appliquée seulement si la société la reverse (réglage) ; son paramètre `tDelta` suit l'effectif (FNAL) |

Le reste (maladie, vieillesse, allocations familiales, accidents du travail, retraite complémentaire, CEG, CET, chômage, AGS, dialogue social, taxe d'apprentissage, CSG-CRDS) est celui du salarié, sans changement.

#### Exemple calculé à la main

Une personne seule, sans autre revenu, 60 000 € HT facturés en 2026, répartis sur 12 mois ; frais de gestion de 7 %, sans plancher, plafond ni frais fixes ; aucun frais professionnel ; société de 50 salariés ou plus, sans versement mobilité ; réduction générale non reversée ; CDD (ou réserve versée dans l'année). Règles de 2026 du simulateur (PASS 48 060 €).

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
| Impôt (1 part) | 11 % × (28 416 − 11 600) = 1 850, décote 897 − 45,25 % × 1 850 = 60 | 1 790 € |
| **Net après impôt** | | **28 687 €** |

Variantes, mêmes hypothèses :

- **CDI, réserve conservée** : 35 163 € bruts versés, 27 826 € nets dans l'année, et environ 2 650 € nets (3 349 € bruts) sur le compte d'activité, montrés comme conservés.
- **Réduction générale reversée** : coefficient 0,0808 à ce niveau de brut (2,1 SMIC environ), soit environ 3 100 € de cotisations patronales en moins ; `M` monte à 40 440 € et le net à 32 003 € (+ 1 526 €). C'est l'écart le plus fort entre deux conditions plausibles : il justifie un réglage explicite.

Approximations de cet exemple, toutes dites dans l'interface ou ici : cotisations annuelles au lieu de douze bulletins (identiques pour un salaire régulier, la régularisation progressive des plafonds le garantit à peu près) ; taux d'accidents du travail de 0,64 % (celui des règles actuelles) ; ni mutuelle, ni prévoyance au-delà du minimum des cadres, ni forfait social sur la prévoyance, ni CSG sur la part patronale de prévoyance ; `tDelta` de la réduction générale à 0,3781 (moins de 50 salariés) dans la variante, alors qu'il passe à 0,3821 avec le FNAL à 0,50 % (écart d'une dizaine d'euros). Le cas sera recalculé par le moteur une fois codé, et l'écart expliqué ligne à ligne s'il dépasse quelques euros.

### 2. Où le portage apparaît

Trois options ont été comparées :

| Option | Pour | Contre |
| --- | --- | --- |
| **A. Colonne du comparateur seulement**, calcul à part | Moins de code ; pas de format de fichier touché | Pas de « statut de la grille » (roadmap) ; une personne déjà portée ne peut pas simuler son année ; un calcul qui n'est pas celui du moteur, donc deux chemins à tenir |
| **B. Un nouveau type d'acteur `"portage"`** (« Activité en portage salarial »), relié à sa personne ; la colonne convertit l'activité comparée dans ce type | Un seul calcul, celui du moteur, pour la grille, le comparateur, le calcul à l'envers, les exports et les outils pour les IA ; la conversion suit le modèle de la micro-entreprise (`convertirLActivite`) | Un type d'acteur de plus à traiter partout (cartes, relations, routage des flux, nettoyage, outils) |
| **C. Un `legalStatus: "PORTAGE"`** de la société au réel | Réutilise la fiche de société | Faux : le portage n'est ni à l'IS ni à l'IR, n'a ni capital, ni dividendes, ni réserves (`IMPOSITION_DES_STATUTS` et toutes les tables par statut l'exigeraient) |
| D. Une personne avec des salaires saisis (possible aujourd'hui) | Rien à coder | Pas de chiffre d'affaires, donc pas de comparaison ; c'est le repli actuel |

**Retenu : B**, en deux temps : d'abord le type d'acteur et son calcul dans le moteur, avec la colonne du comparateur ; ensuite la saisie complète dans la grille (carte, fiche des conditions, glisser-déposer).

- **L'acteur** : `PortageSchema = { id, type: "portage", name, conditions?: ConditionsPortage, dateDeCreation?, avatar, locked }`. Flux permis : `ca_services` (prestations facturées HT) et `deductible_expense` (frais professionnels remboursés). Pas de `profession` : la caisse d'un libéral ne s'applique pas à un salarié (l'ADR 015 ne concerne que les non-salariés).
- **La relation** : la relation existante **« Titulaire »**, de la personne vers l'acteur, affichée « salarié porté » sur cette carte. Un seul titulaire ; le salaire calculé est celui de cette personne, et rejoint son foyer.
- **Le comparateur** : `STATUTS_COMPARES` reçoit `"portage"`. Chaque table typée par `StatutCompare` (titres, dirigeant, frais, protection sociale) fait échouer la compilation jusqu'à ce qu'elle ait sa ligne, comme le prévoit le guide du développeur (« Ajouter un statut »). La colonne s'appelle « Portage salarial » ; elle n'a pas de partage du bénéfice ni d'optimiseur.
- **Frais de fonctionnement supposés** (ADR 009) : aucun pour le portage. La société de portage tient la comptabilité, facture et assure le plus souvent la responsabilité civile ; ses frais de gestion en tiennent lieu. `FRAIS_DES_COLONNES` passe donc à `Record<StatutCompare, StatutFrais | null>` : la colonne du portage reçoit un écart de frais égal à moins les frais supposés du statut actuel. **`STATUTS_FRAIS` ne change pas** : chacune de ses clés est obligatoire dans les fichiers enregistrés, et une clé `portage` les rendrait invalides pour les versions précédentes.
- **Calcul à l'envers** (point 1 de la phase 18) : la colonne passe par `colonneDuStatut`, donc « Combien facturer pour un net visé ? » et `chiffre_affaires_pour_net_vise` la calculent sans code de plus.

### 3. Réglages

**Dans les règles de l'année** (`portageSalarial` de `2026.json`, et de 2024 et 2025 pour les sessions qui y remontent, chaque valeur avec `description` et `source`) : indemnité d'apport d'affaires (0,05), réserve financière et indemnité de précarité (0,10), minima mensuels en euros (63 %, 70 %, 75 %, 85 % du plafond de 2017), APEC, prévoyance des cadres, et les taux qui dépendent de l'effectif (FNAL, formation légale et conventionnelle, participation à l'effort de construction, `tDelta`). Ce sont des règles : ni l'utilisateur ni une IA ne les règlent.

**Conditions de la société de portage** (`ConditionsPortageSchema`, objet strict, chaque champ facultatif ; absent, il prend la valeur typique) :

| Nom | Type | Unité | Bornes | Valeur typique (annoncée comme telle) | Source de la valeur typique |
| --- | --- | --- | --- | --- | --- |
| `tauxFraisDeGestion` | nombre | part du CA HT | 0 à 0,30 | 0,07 | Milieu de la fourchette de 5 à 10 % relevée sur des sites d'information (non officiels) ; aucun texte ne fixe le taux |
| `plancherMensuel` | nombre ou absent | € par mois avec CA | 0 à 5 000 | aucun | Pratique de certaines sociétés ; pas de valeur typique sourcée |
| `plafondMensuel` | nombre ou absent | € par mois avec CA | 0 à 50 000, et ≥ plancher | aucun | Idem |
| `fraisFixesMensuels` | nombre | € par mois avec CA | 0 à 2 000 | 0 | Idem |
| `contrat` | `"CDI"` ou `"CDD"` | | | `"CDI"` | Choix de modélisation : le CDI est le seul qui couvre plusieurs clients ; à confirmer (question 2) |
| `effectif` | `"moinsDe11"`, `"de11a49"`, `"50EtPlus"` | salariés de la société de portage | | `"50EtPlus"` | Hypothèse : les salariés portés sont regroupés dans des sociétés qui en emploient beaucoup ; non sourcée (question 3) |
| `tauxVersementMobilite` | nombre | part du brut | 0 à 0,032 | 0 | Dépend de la commune de l'établissement ; 0 avec une note qui dit jusqu'à 3,20 % à Paris (valeur à sourcer avant de coder) |
| `reductionGeneraleReversee` | booléen | | | `false` | Prudence : aucune source ne dit que les sociétés la reversent (question 4) |

Valeurs typiques réunies dans `conditionsPortageParDefaut()` (`options-du-comparateur.ts`), affichées avec la mention « valeur courante, à remplacer par les conditions de votre société ».

**Où elles sont enregistrées :**

- **Sur l'acteur** (`PortageSchema.conditions`) pour une activité en portage dans la grille.
- **Dans les réglages du comparateur** (ADR 009), pour l'activité comparée : `ReglagesComparateurSchema.portage?: ConditionsPortage`. Comme les frais de fonctionnement, ce sont des choix de structure, valables pour toutes les années, et seuls les champs changés sont enregistrés. Quand l'activité comparée est elle-même en portage, sa colonne prend les conditions de l'acteur, et le comparateur n'affiche pas les siennes.
- Comme pour l'ADR 009, ils sont hors de l'historique d'annulation dans le comparateur ; sur l'acteur, ils en font partie, comme toute modification d'un acteur.

**Format de fichier.** Suivant la règle de l'ADR 005 (section « Versionnage du format »), **le numéro de format reste 3** : `conditions` et `portage` sont des champs facultatifs dont l'absence a un sens (valeurs typiques), et `"portage"` est une nouvelle variante de l'union des acteurs, qu'une version précédente écarte en le signalant dans son rapport (avec ses flux et sa relation). Une condition hors bornes est écartée seule (`.catch(undefined)`), comme la part conventionnée de l'ADR 015 ; un plancher supérieur au plafond fait écarter les deux. La session « maximale » (`session-maximale.ts`) reçoit un acteur en portage avec toutes ses conditions, et des réglages du comparateur avec `portage`, pour le test « rien ne se perd ».

**Exports.** Le rapport Markdown décrit l'acteur, ses conditions et le détail de l'étape 1 à 8 (enveloppe, masse salariale, partage, net, conservé) ; le CSV et le PDF du comparateur ont une colonne de plus ; l'export de la grille liste l'acteur comme les autres. Les conditions annoncées typiques y sont marquées comme telles.

### 4. Avec une IA

La personne colle les conditions de sa société de portage (page de tarifs, contrat, courriel) dans son client d'IA. L'IA les traduit en `ConditionsPortage` et les envoie comme une proposition, relue puis appliquée dans l'application (ADR 010 et 011).

**Outil `proposer_conditions_portage`** (proposition, pas de lecture) :

- **Paramètres** (objet strict, clés inconnues refusées) :
  - `acteurId` : un acteur `"portage"` (les conditions vont sur l'acteur) ou une autre activité (elles vont dans les réglages du comparateur, qui s'ouvre sur cette activité) ;
  - `conditions` : `ConditionsPortage`, les mêmes bornes que le fichier ; seuls les champs donnés changent ;
  - `nonModelise` : liste de 0 à 10 textes d'une ligne (120 caractères au plus, sans caractère de contrôle ni de mise en forme bidirectionnelle), les conditions lues que le schéma ne sait pas porter ;
  - `suiteDe` : comme les autres outils de proposition.
- **Opération** : `regler_portage { acteurId, conditions, nonModelise }`, ajoutée à `PropositionSchema`, revalidée en entier à l'application.
- **Validations** : bornes et plancher ≤ plafond ; acteur existant et non verrouillé ; refus d'un acteur qui n'est ni en portage ni une activité. Avertissements calculés par l'outil, jamais fournis par l'IA : taux de frais de gestion au-dessus de 0,15 (« inhabituel, vérifiez qu'il ne comprend pas d'autres frais ») ; frais fixes et taux à la fois ; effectif ou réduction générale laissés à la valeur typique.
- **Conditions non modélisées** : chaque texte de `nonModelise` devient un avertissement de la proposition, préfixé « Non pris en compte : ». Exemples attendus : frais de gestion dégressifs par tranche de chiffre d'affaires (l'IA retient le taux qui s'applique au chiffre d'affaires de la simulation et le dit), mutuelle, avance de trésorerie, assurance facturée à part, frais de dossier ponctuels.
- **Ce que l'IA ne peut pas faire** : écrire une règle (taux de cotisation, minimum, indemnité d'apport d'affaires, réserve : ils viennent des règles de l'année), une formule ou un texte libre qui change un calcul ; changer le statut d'une activité ; appliquer elle-même la proposition. Le résumé de la proposition montre chaque condition, sa valeur avant et après, et l'effet sur le net de chaque année calculé par le moteur.
- **Taille du catalogue** : la marge mesurée le 14 octobre 2026 est d'environ 1 700 caractères (ADR 010, dernier addendum), qu'un outil de plus consomme. Le même jour que l'outil, une décision écrite en addendum de l'ADR 010 resserre des descriptions ou relève les plafonds ; `comparer_statuts`, `simuler` et `expliquer_resultat` rendent la colonne et le détail du portage sans paramètre nouveau.

### 5. Hors périmètre

| Point | Raison |
| --- | --- |
| Mutuelle (parts salariale et patronale, forfait social) | Garanties et prix propres à chaque contrat ; quelques centaines d'euros par an. Dit en note sous la colonne |
| Prévoyance au-delà du minimum des cadres | Idem ; le minimum de 1,50 % est modélisé |
| Indemnités kilométriques et frais de déplacement détaillés | Les frais professionnels sont un montant saisi ; le barème kilométrique existant (`frais-kilometriques.ts`) sert aux frais réels de la personne, pas aux remboursements de la société |
| Jours travaillés, forfait en jours, temps partiel | Le simulateur raisonne en euros par mois ; le minimum conventionnel ne fait qu'avertir |
| Périodes sans mission, versement de la réserve entre deux missions, report de la réserve d'une année sur l'autre | Un mois sans chiffre d'affaires n'a pas de salaire ; la réserve d'un CDI est montrée conservée chaque année, sans reprise l'année suivante (première version) |
| Fin d'un CDD en cours d'année ou après | L'indemnité de précarité est supposée versée dans l'année |
| ARE et son cumul avec le salaire porté | Calcul de France Travail propre à chaque personne ; une ARE se saisit déjà sur la personne (flux `are`) |
| Frais de gestion dégressifs par tranches | Une condition, un taux ; l'IA ou l'utilisateur retient le taux applicable et le dit |
| Avance de salaire, affacturage, délais de paiement du client | Trésorerie, pas revenu de l'année |
| Plusieurs sociétés de portage pour une même personne | Une personne, un titulaire de chaque acteur ; deux acteurs en portage pour une même personne additionnent deux bulletins (les plafonds ne sont pas partagés), avec un avertissement |
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

## Conséquences

- **Positives :**
  - La question « et en portage ? » a sa réponse, au même endroit et avec le même moteur que les autres statuts, calcul à l'envers compris.
  - Une personne déjà portée simule son année à partir de ce qu'elle facture, et voit où passe chaque euro (frais de gestion, cotisations, réserve).
  - Le partage entre règles (convention, loi) et conditions (société) est net : une IA ne peut régler que les secondes, bornées.
  - Les fichiers existants se lisent sans changement.
- **Négatives ou Compromis :**
  - Un type d'acteur de plus à traiter partout ; une version précédente du simulateur écarte l'acteur en portage d'un fichier récent, en le signalant.
  - Le net dépend fortement de conditions mal connues (réduction générale, effectif, versement mobilité : plus de 2 000 € d'écart sur l'exemple) ; les valeurs typiques sont prudentes et l'interface invite à saisir celles de sa société.
  - La mutuelle et la prévoyance réelles manquent : le net est légèrement surestimé (quelques centaines d'euros par an).
  - La réserve d'un CDI n'est pas reportée d'une année sur l'autre dans une session de plusieurs années.

### Effort estimé

| Partie | Contenu | Estimation |
| --- | --- | --- |
| Règles | Bloc `portageSalarial` (2024 à 2026) avec sources, types dans `regles.ts`, tests des règles | 1 jour |
| Moteur | Bulletin `"porte"`, frais de gestion mensuels, dichotomie sur le coût employeur, partage et réserve, foyer, protection sociale, avertissements | 2 à 3 jours |
| Format et nettoyage | `PortageSchema`, `ConditionsPortageSchema`, `ReglagesComparateurSchema.portage`, nettoyage, session maximale | 1 jour |
| Comparateur | `"portage"` dans `STATUTS_COMPARES`, conversion, colonne, écart de frais, réglages à l'écran | 2 jours |
| Grille | Carte et fiche de l'acteur, relation, flux permis, glisser-déposer | 2 jours |
| Exports | Markdown, CSV, PDF | 1 jour |
| IA | `proposer_conditions_portage`, opération `regler_portage`, avertissements, catalogue (addendum ADR 010) | 1 à 2 jours |
| Tests | Cas de référence, composants, outils, « rien ne se perd » | 2 jours |

Soit environ deux semaines, en petites branches (règles et moteur ; comparateur ; grille ; exports ; IA).

### Cas de référence à figer (tests datés, `src/backend/logic/references/`)

1. L'exemple ci-dessus (60 000 €, 7 %, CDD, 50 salariés et plus, sans réduction générale) : enveloppe, masse salariale, net, impôt, à l'euro.
2. Le même en CDI : bruts versés, réserve conservée.
3. Le même avec la réduction générale reversée.
4. Un chiffre d'affaires de 150 000 € : masse salariale au-delà du PASS (tranche 2, contribution d'équilibre technique, sans réduction générale).
5. Un plancher mensuel qui joue (petit chiffre d'affaires sur trois mois) et un plafond qui joue (gros chiffre d'affaires).
6. Des frais professionnels : même enveloppe qu'un chiffre d'affaires diminué d'autant, impôt inchangé par les frais.
7. La colonne du comparateur pour une micro-entreprise BNC à 60 000 € : même résultat que l'acteur en portage saisi directement.

Chaque cas est recoupé, avant d'être figé, avec au moins un simulateur public de portage (en notant ses hypothèses) et, pour le bulletin, avec le simulateur de l'Urssaf pour un cadre (mon-entreprise.urssaf.fr) ; les écarts sont expliqués dans le test.

## À vérifier avant de coder

1. **Minima conventionnels** : la version en vigueur de l'art. 21.3 (Légifrance) cite le premier niveau à 63 % et un revenu minimal de 69 %, la fiche F31620 un total de 77 % ; dater l'avenant n° 12 (20 décembre 2022, étendu, selon des sources secondaires) et retenir les montants en euros en vigueur.
2. **Avenant n° 14 du 24 février 2025** (art. 36, formation) : non étendu, dénoncé en juillet 2025 par deux fédérations patronales ; confirmer le taux conventionnel de formation applicable en 2026.
3. **APEC et prévoyance des cadres** : taux 2026 relevés sur des sources secondaires (0,024 % et 0,036 % ; 1,50 % de la tranche 1) ; les vérifier sur l'Agirc-Arrco, l'APEC ou l'Urssaf.
4. **Réduction générale** : confirmer qu'elle s'applique aux salariés portés (aucun texte ne les exclut) et `tDelta` à partir de 50 salariés.
5. **Versement mobilité** : taux de Paris et d'Île-de-France en 2026, avec sa source, pour la note du réglage.
6. **Frais professionnels remboursés** : non imposables (CGI, art. 81, 1°) et hors assiette des cotisations sur justificatifs ; texte et page de l'Urssaf à citer.
7. **Frais de gestion** : retrouver l'étude de la DARES (environ 10 %) ou une autre source publique pour la fourchette, sinon la dire « relevée sur des sites commerciaux ».

## Sources consultées le 2026-10-14

- Code du travail, art. [L1254-1](https://code.travail.gouv.fr/code-du-travail/l1254-1), [L1254-2](https://code.travail.gouv.fr/code-du-travail/l1254-2), [L1254-21](https://code.travail.gouv.fr/code-du-travail/l1254-21), [L1254-25](https://code.travail.gouv.fr/code-du-travail/l1254-25) (Code du travail numérique, texte de Légifrance) ; [ordonnance n° 2015-380 du 2 avril 2015](https://www.legifrance.gouv.fr/jorf/id/JORFSCTA000030431097) (non relue en entier).
- [Convention collective de branche des salariés en portage salarial du 22 mars 2017](https://www.legifrance.gouv.fr/conv_coll/id/KALITEXT000035184768) (IDCC 3219, Légifrance) : art. 21 (rémunération, en vigueur), art. 36 (formation), chapitre V (catégories), chapitre XI (prévoyance : « une négociation sera engagée ultérieurement »).
- [Portage salarial, fiche F31620](https://entreprendre.service-public.gouv.fr/vosdroits/F31620) (Entreprendre.Service-Public.gouv.fr).
- [Qui dois-je assurer contre le risque de chômage ?](https://www.unedic.org/l-assurance-chomage-et-vous/employeur-du-secteur-prive/mes-demarches/qui-dois-je-assurer-contre-le-risque-de-chomage) (Unédic).
- Règles du simulateur : `regimeGeneral` et `IR` de `src/backend/regles/2026.json` (sources Urssaf, Agirc-Arrco, service-public).
- Sources secondaires, à remplacer par une source officielle avant de coder (voir « À vérifier ») : fourchette des frais de gestion et minima en pourcentage du plafond 2026 ([travail-industrie.com](https://travail-industrie.com/outils/conventions-collectives/portage-salarial-remuneration-frais-droits-idcc-3219)) ; taux APEC 2026 (tableau de la CAPEB de l'Hérault) ; prévoyance des cadres de l'ANI du 17/11/2017 (notice Apicil 2026) ; étude de la DARES (*Travail et emploi* n° 172), citée par la recherche web, non lue.

## Questions au propriétaire

1. **Valeur typique des frais de gestion** : 7 % (milieu de la fourchette) ou 10 % (DARES, si elle se confirme) ?
2. **Contrat par défaut** : CDI (réserve conservée, net de l'année plus bas) ou CDD (tout versé dans l'année, plus simple à lire) ?
3. **Effectif par défaut** : 50 salariés et plus, ou de 11 à 49 ? Environ 0,9 point de cotisations patronales d'écart.
4. **Réduction générale** : « non reversée » par défaut (prudent, environ 1 500 € de net en moins sur l'exemple), ou « reversée » ?
5. **Mutuelle** : la laisser hors périmètre, ou ajouter un seul réglage « mutuelle, coût mensuel total » ?
6. **Ordre des branches** : la colonne du comparateur d'abord (grille ensuite), comme proposé, ou les deux ensemble ?
