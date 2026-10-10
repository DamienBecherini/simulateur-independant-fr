# ADR-015: Professions libérales réglementées et leurs caisses

- **Date :** 2026-10-08
- **Statut :** Accepté

## Contexte

Toute activité BNC est aujourd'hui calculée comme celle d'un libéral non réglementé relevant de la Sécurité sociale des indépendants (`cotisationsTNS.ts`, taux micro `servicesBnc`). Pour un affilié d'une caisse de la CNAVPL, plusieurs lignes diffèrent : les indemnités journalières, la retraite de base, la retraite complémentaire, l'invalidité-décès, le taux de la micro-entreprise et, pour les auxiliaires médicaux conventionnés, la prise en charge d'une partie des cotisations par l'Assurance maladie. Sur les cas calculés à la main du [dossier de recherche](../recherche/caisses-des-liberaux.md) (§9), l'écart va d'environ 2 900 € de cotisations oubliées (architecte CIPAV à 120 000 €) à 4 800 € de trop (kinésithérapeute conventionné à 60 000 €) par an.

Les règles, vérifiées sur les textes et les pages officielles (dossier de recherche, consulté le 2026-10-08) :

- **Complémentaire CIPAV.** Pour 2025, le décret n° 2025-1076 du 10/11/2025, art. 12, fixe 11 % jusqu'à 1 PASS et 21 % de 1 à 4 PASS (bornes : décret n° 79-262, art. 2-I). Pour 2026, seule l'Urssaf écrit ces taux (page des taux CIPAV, page de la réforme) ; aucun décret n'a été trouvé, et la fiche 2026 de la CIPAV, qui dit encore 9 % et 22 %, est périmée.
- **CARPIMKO.** La caisse appelle elle-même ses cotisations, sur l'assiette sociale de l'année précédente (bulletin d'avril 2026). Seule la retraite de base est régularisée sur le revenu de l'année (page « Adapter mes cotisations ») ; aucune source ne parle d'une régularisation de la complémentaire ou de l'ASV. L'ASV est assise sur les revenus conventionnés de l'année précédente, l'invalidité-décès est un forfait de 1 022 €.
- **Auxiliaires médicaux conventionnés.** Sur les revenus conventionnés nets de dépassements, l'Assurance maladie prend en charge la maladie, sauf 0,10 point ; les pages de l'Urssaf se contredisent, la lecture retenue est expliquée au §5.2 du dossier. La CURPS est de 0,10 % du revenu d'activité non salarié, plafonnée à 240 € en 2026 (0,5 % du PASS, article L4031-4 du code de la santé publique).
- **Micro-entreprise.** Ouverte aux affiliés de la CIPAV (23,2 % en 2025 et 2026), interdite aux praticiens et auxiliaires médicaux (Urssaf).
- **Sociétés d'exercice libéral.** La rémunération technique d'un associé de SEL relève des BNC depuis l'imposition des revenus 2024 (BOFiP BOI-RES-BNC-000136-20240424, fiche F38455) et de la caisse de sa profession, y compris pour un président de SELAS, dont seul le mandat social relève du régime général (Conseil d'État, 27/05/2011, n° 328905 ; fiche F31233).

Six questions ont été posées au propriétaire du produit (dossier, §11).

## Décision

**Chaque activité BNC peut porter une profession, dont les règles de l'année déduisent la caisse et ses particularités.**

1. **Complémentaire CIPAV : 11 % puis 21 %**, de 1 à 4 PASS, en 2025 et en 2026. La `description` de 2025 cite le décret ; celle de 2026 dit que le taux vient de l'Urssaf seule.

2. **CARPIMKO, cotisation par cotisation**, selon l'année de revenu qui la fonde réellement (ADR 007 : l'année d'une règle est l'année des revenus) :
   - la **retraite de base** est calculée sur le revenu de l'année simulée, puisqu'elle est régularisée ;
   - la **complémentaire** et l'**ASV** sont calculées sur le revenu de l'année précédente quand cette année est dans la session (ADR 008), sinon sur celui de l'année simulée. L'interface l'indique à côté de la ligne (« calculée sur le revenu 2025 ») ;
   - l'invalidité-décès est un forfait.

   En année de hausse, les cotisations sont donc plus basses qu'avec le revenu de l'année, ce qui est la réalité de la trésorerie : l'effet est assumé. Option future : un champ facultatif « revenu de l'année précédente » sur l'activité, comme `rfrN2` en micro-entreprise, pour la première année d'une session.

3. **La saisie se fait par profession, jamais par caisse.**
   - La liste n'est proposée que pour une activité BNC : micro-entreprise, entreprise individuelle au réel, gérant d'EURL.
   - Ordre de la liste : « Non réglementée » en premier et par défaut (calcul inchangé) ; puis **Santé (CARPIMKO)** : infirmier, masseur-kinésithérapeute, orthophoniste, orthoptiste, pédicure-podologue ; puis **CIPAV** : les professions du dossier (§5.1 : architecte, architecte d'intérieur, économiste de la construction, maître d'œuvre, géomètre expert, ingénieur conseil, moniteur de ski, guide de haute montagne, accompagnateur de moyenne montagne, ostéopathe, psychologue, psychothérapeute, ergothérapeute, diététicien, chiropracteur, psychomotricien, artiste non affilié à la Maison des artistes, expert en automobile, expert devant les tribunaux, mandataire judiciaire à la protection des majeurs, guide-conférencier) ; enfin « **Autre profession réglementée** », calculée comme une profession non réglementée, avec l'avertissement « pas encore pris en compte ».
   - La caisse se déduit de la profession par les **règles de l'année** (une table profession → caisse dans chaque fichier de règles, avec ses sources). Chaque profession y porte ses particularités : micro-entreprise permise ou non, conventionnement possible, CURPS, avertissement sur les sociétés d'exercice libéral.
   - Le fichier enregistre la **profession**. Une profession qui changerait de caisse d'une année à l'autre suivrait les règles de chaque année sans toucher aux fichiers.

4. **Sociétés d'exercice libéral : un avertissement dans cette phase.** Quand une profession concernée est simulée ou comparée en SASU ou en EURL, un avertissement dit que la profession exerce en principe en société d'exercice libéral et que la rémunération de son activité relève alors des BNC et de sa caisse. La modélisation de cette rémunération technique (BNC, caisse) et du mandat social du président de SELAS est un chantier ultérieur, inscrit dans la roadmap.

5. **Formation professionnelle en micro-entreprise : hors de cette décision.** Le moteur ne la calcule pour aucun micro-entrepreneur (0,1 % pour les commerçants, 0,2 % pour les libéraux, 0,3 % pour les artisans, article L6331-48 du code du travail). Elle est corrigée à part, pour tous.

6. **CARPIMKO complète dès la première version :**
   - la **CURPS** (0,10 %, plafonnée à 0,5 % du PASS), calculée sur l'assiette du moteur, sans boucle sur le revenu imposable ;
   - la **part conventionnée** des recettes, nettes de dépassements : un champ affiché seulement pour les professions conventionnables, 100 % par défaut ;
   - la **prise en charge** de la maladie et de l'ASV par l'Assurance maladie, sur la part conventionnée seulement ; le reste des revenus suit le barème des revenus non conventionnés.

**Format de fichier.** La profession et la part conventionnée sont des **champs facultatifs** de l'activité : une activité qui ne les a pas est non réglementée, conventionnée à 100 % si sa profession le permet. Comme pour l'ADR 009 et l'ADR 014, et suivant l'ADR 005 (valeurs par défaut des schémas Zod, pas de script de migration), **le numéro de format ne change pas** : il reste 3. Un fichier d'avant se lit tel quel, sans conversion ni point à vérifier ; une version précédente du simulateur ignore les deux champs et ouvre le reste. Une profession inconnue des règles (fichier abîmé, profession retirée) est écartée par le nettoyage de l'ADR 005 et signalée dans son rapport : l'activité redevient non réglementée.

### Alternatives écartées

- **Saisir la caisse** : la plupart des utilisateurs connaissent leur profession, pas leur caisse ; et la caisse ne suffit pas (micro-entreprise permise, conventionnement, CURPS dépendent de la profession).
- **Toute la CARPIMKO sur le revenu de l'année simulée** (la convention de la SSI) : plus simple, mais faux pour la complémentaire et l'ASV, qui ne sont pas régularisées ; l'écart est le plus fort l'année d'une hausse ou d'une baisse, quand l'utilisateur en a le plus besoin.
- **Toute la CARPIMKO sur l'année précédente** : faux pour la retraite de base, régularisée.
- **Attendre un décret pour la complémentaire CIPAV 2026** : l'Urssaf recouvre la cotisation à ces taux ; la `description` dit d'où vient le chiffre.
- **Modéliser tout de suite la rémunération technique des associés de SEL** : elle touche les colonnes SASU et EURL du comparateur, l'optimiseur et les dividendes ; c'est un chantier à part entière, qui ne doit pas retarder des cotisations justes en entreprise individuelle et en micro-entreprise.
- **Approcher la CARPIMKO (100 % conventionné, CURPS ignorée)** : la prise en charge pèse plusieurs milliers d'euros par an pour un conventionné ; la retirer d'un non-conventionné fausserait autant le résultat.
- **Un nouveau numéro de format avec migration** : rien à convertir, et un fichier au format 4 serait refusé à tort par les versions précédentes (ADR 009).

## Conséquences

- **Positives :**
  - Des cotisations justes pour les professions libérales réglementées les plus nombreuses (CIPAV et CARPIMKO), en micro-entreprise comme au réel, et des trimestres en micro-entreprise CIPAV qui retombent sur les seuils publiés.
  - Une saisie dans le vocabulaire de l'utilisateur ; les autres caisses s'ajouteront profession par profession, sans changer le fichier.
  - Les sessions existantes ne changent pas : « Non réglementée » par défaut garde le calcul actuel, sans message.
  - Le décalage de trésorerie de la CARPIMKO apparaît dans une session sur plusieurs années, ligne par ligne.
- **Négatives ou Compromis :**
  - Le schéma des règles grossit : table des professions, barèmes propres à chaque caisse (forfaits, minimum de la complémentaire, plafond de l'invalidité-décès), ASV, CURPS, prise en charge.
  - Deux saisies de plus (profession, part conventionnée), affichées seulement quand elles ont un sens.
  - La première année d'une session calcule la complémentaire et l'ASV de la CARPIMKO sur son propre revenu, faute de l'année précédente, tant que le champ facultatif n'existe pas.
  - Une version précédente du simulateur qui ouvre un fichier récent calcule l'activité comme non réglementée, sans le dire.
  - « Autre profession réglementée » ne fait qu'avertir : ces professions restent approchées tant que leur caisse n'est pas codée.
  - En SASU, le président d'une profession réglementée reste calculé comme un assimilé salarié ; en EURL, le gérant majoritaire cotise à la caisse de sa profession (comme le gérant majoritaire d'une SELARL). Dans les deux cas, l'avertissement signale que la rémunération d'une société d'exercice libéral n'est pas modélisée, sans chiffrer l'écart.
  - Pour une profession qui exerce en principe en société d'exercice libéral, le comparateur ne désigne jamais la SASU ni l'EURL classiques comme meilleur statut : leurs colonnes restent, indicatives, et le meilleur net se choisit parmi les autres.
  - La complémentaire CIPAV 2026 repose sur l'Urssaf seule ; la prise en charge maladie repose sur une lecture de pages contradictoires, et n'est écrite nulle part au-delà de 3 PASS.

## À vérifier

À la mise en œuvre, avant de coder la ligne concernée :

1. Prise en charge maladie au-delà de 3 PASS : la règle à appliquer, ou à défaut celle retenue et dite dans la `description`.
2. Les professions qui reçoivent l'avertissement sur les sociétés d'exercice libéral, chacune avec sa source (le dossier n'a trouvé aucun texte qui autorise ou interdise en toutes lettres l'EURL ou la SASU classique).
3. Les décrets n° 2026-418 du 29/05/2026 et n° 2026-239, pour un barème CIPAV 2026 éventuel, et les règlements de la CARPIMKO approuvés par l'arrêté du 10/07/2026.

## Complément (2026-10-10) : ajouter une caisse

Depuis la relecture d'octobre 2026 (branche `caisses-exhaustives`), chaque particularité d'une caisse vit dans une table typée par `CaisseLiberale` (`CAISSES_LIBERALES`, `src/types.ts`) : ajouter une caisse à la liste fait échouer la compilation à chaque endroit à compléter, au lieu de la calculer comme une autre. La marche à suivre, avec les erreurs obtenues en ajoutant la CARMF à l'essai et ce que le compilateur ne voit pas (textes des outils pour les IA, limites de l'export Markdown), est dans le [guide du développeur](../GUIDE_DEVELOPPEUR.md#33-ajouter-une-caisse-de-libéraux-exemple--carmf).
