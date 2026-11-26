# Audit de qualité et de cohérence du code

- **Date :** 2026-11-26. **Branche :** `epargne-retraite` (commit `f08b22b`), dont le code est celui de `main`.
- **Périmètre :** le moteur (`src/backend/logic/`, 55 fichiers au premier niveau, plus `outils/`), puis une passe légère sur `src/lib/`, `src/backend/mcp/`, le process principal et les plus gros composants.
- **Nature :** audit en lecture seule. Aucun fichier du dépôt n'a été modifié, aucun test n'a été lancé (un autre travail occupait le processeur avec Stryker).

Chaque constat porte une marque qui dit comment il est établi :

- **[exécuté]** : j'ai fait tourner le moteur réel, empaqueté hors du dépôt, et j'ai lu le résultat ;
- **[mesuré]** : chiffre produit par un outil (ESLint, jscpd, knip, script de comptage) ;
- **[lu]** : constat tiré de la lecture du code, avec son emplacement ;
- **[rapporté]** : constat d'une des trois passes secondaires (bibliothèque, interface et serveur MCP, tests), que je n'ai pas relu moi-même ;
- **[supposé]** : hypothèse que rien n'a confirmé.

---

## 1. Verdict

Le moteur est sain : ni cycle d'import, ni `any`, ni fonction démesurée, des calculs purs et documentés. La dette de sept semaines de croissance est ailleurs : dans des règles **recopiées à plusieurs endroits**, dont trois ont déjà divergé.

1. **Cohérence :** bonne dans les calculs, faible là où une règle vit en double : colonne « non retenue » du comparateur (bogue visible, confirmé), lignes des exports (deux champs oubliés), relations après un changement de statut (26 désaccords sur 252 essais).
2. **Optimisation :** un seul endroit, mesuré. Mémoriser la recherche du brut pour un net divise le temps du comparateur par 3 à 5, à résultats identiques. Le calcul à l'envers prend 0,5 à 4,6 secondes et fige l'affichage.
3. **Patrons :** les tables par statut existent déjà et sont bonnes, ne pas les fusionner. Deux ajouts utiles : un type marqué pour les règles réduites à une période, et séparer le calcul d'une activité de l'inscription de ses versements.
4. **Modules :** aucun fichier trop gros. `dispositifs.ts` mêle sept sujets : trois déplacements sans risque.
5. **Code spaghetti :** presque aucun. Une seule fonction vraiment emmêlée : `relationsApres` (`changement-de-statut.ts:68`).
6. **TypeScript et tests :** très bon niveau. Il manque un test large qui fige les résultats complets avant une refonte.

---

## 2. Mesures

### 2.1 Taille

Le moteur compte 55 fichiers au premier niveau, 7 727 lignes et environ 460 000 caractères, plus 10 fichiers dans `outils/` (2 468 lignes). **[mesuré]**

Les lignes sont longues : 274 lignes dépassent 160 caractères, la plus longue en fait 591 (`professions.ts`). Compter en lignes sous-estime donc la taille : les tableaux ci-dessous comptent aussi en caractères.

| Fichier | Lignes | Caractères |
|---|---:|---:|
| `dispositifs.ts` | 353 | 21 185 |
| `simulation-au-reel.ts` | 312 | 20 846 |
| `comparateur.ts` | 267 | 20 239 |
| `regles.ts` (surtout des types) | 387 | 20 169 |
| `regles-de-structure.ts` | 272 | 17 052 |
| `colonne-du-comparateur.ts` | 259 | 16 574 |
| `exoneration-de-zone.ts` | 228 | 15 111 |
| `data-sanitizer.ts` | 327 | 14 965 |
| `annee-de-creation.ts` | 240 | 14 526 |
| `routage-des-flux.ts` | 254 | 14 511 |

Au premier niveau, aucun fichier ne dépasse 400 lignes. Dans `outils/`, deux dépassent 440 lignes (`operations.ts`, `propositions.ts`). Les plus gros fichiers de `src` sont ailleurs : `types.ts` (1 409 lignes de schémas et de types), `ComparatorPanel.tsx` (807), `ResultsPanel.tsx` (685).

### 2.2 Complexité, longueur, imbrication

La **complexité cyclomatique** compte les chemins possibles dans une fonction (chaque `if`, chaque `? :`, chaque `&&` en ajoute un). La **complexité cognitive** pondère en plus l'imbrication : elle mesure mieux ce qui est difficile à lire. La règle ESLint du projet plafonne la première à 12.

Sur les quelque 1 190 fonctions du moteur (`outils/` compris), mesurées par ESLint avec des seuils à zéro et par un script sur l'arbre syntaxique : **[mesuré]**

| Complexité cyclomatique | 1 | 2 à 3 | 4 à 5 | 6 à 8 | 9 à 10 | 11 à 12 | plus de 12 |
|---|---:|---:|---:|---:|---:|---:|---:|
| Fonctions | 616 | 344 | 137 | 65 | 14 | 13 | 0 |

| Mesure | Résultat |
|---|---|
| Fonctions au plafond de 12 | 5 : `buildFoyers` (`foyers.ts:69`), `simulerSocieteIS` (`simulation-au-reel.ts:137`), `detailDispositifsMicro` (`simulation-micro.ts:21`), une fonction anonyme de `changement-de-statut.ts:98`, `informationsDeLActivite` (`outils/resultats.ts:225`) |
| Complexité cognitive la plus haute | 16 : `buildFoyers`. Puis 14 : `resserrer` (`chiffre-d-affaires-pour-un-net.ts:128`), `anomaliesDeStructure` (`regles-de-structure.ts:232`), `informationsDeLActivite` |
| Imbrication des blocs | 3 au plus, dans 9 blocs. 758 fonctions sur 1 188 n'ont aucune structure de contrôle (ni `if`, ni boucle, ni ternaire) |
| Ternaires imbriqués | 7 fonctions à 2 niveaux, 1 à 3 niveaux (`phraseDesRetraits`, `outils/propositions.ts:281`) |
| Fonctions de plus de 50 lignes | 5. La plus longue : `simulerMicroEntreprise`, 63 lignes de code |
| Fonctions de 5 paramètres ou plus | 16. Une seule à 6 : `convertirLActivite` (`conversion-de-statut.ts:208`) |

Les plus longues en caractères (lignes comptées avec les commentaires et les lignes vides) :

| Fonction | Emplacement | Lignes | Caractères | Cyclomatique |
|---|---|---:|---:|---:|
| `simulerMicroEntreprise` | `simulation-micro.ts:97` | 72 | 4 305 | 8 |
| `simulerSocieteIS` | `simulation-au-reel.ts:137` | 57 | 4 239 | 11 |
| `relationsApres` | `changement-de-statut.ts:68` | 53 | 4 068 | 2 (hors ses fonctions internes) |
| `simulerEntrepriseIndividuelle` | `simulation-au-reel.ts:236` | 59 | 3 588 | 7 |
| `sanitizeSession` | `data-sanitizer.ts:136` | 71 | 3 564 | 5 |
| `calculerResultatSociete` | `calculsSociete.ts:101` | 59 | 3 179 | 7 |
| `calculerFoyer` | `impot-du-foyer.ts:128` | 40 | 3 056 | 9 |

Ces fonctions sont longues parce qu'elles assemblent un résultat champ par champ, pas parce qu'elles décident beaucoup. Elles se lisent de haut en bas.

### 2.3 Types

| Mesure sur le moteur | Résultat |
|---|---|
| `any` | 0 |
| Assertions `as` (hors `as const`) | 32, dont 7 dans `outils/operations.ts` |
| Assertions `!` | 7 |
| `@ts-ignore`, `@ts-expect-error` | 0 |
| `let` contre `const` | 53 contre 1 337 |
| `throw` | 49, dont 43 dans `outils/` et 6 dans la lecture des fichiers et des règles : aucun calcul ne lève d'erreur |
| Classes | 6 (erreurs typées, `UnionFind`) |

### 2.4 Duplication et code mort

- `npm run duplication` (jscpd, 70 jetons) : **2 clones**, tous deux dans l'interface, soit 0,06 % des lignes. Aucun dans le moteur. Le guide annonce « attendu : 0 clone » : `MonthlyFlowsModal.tsx:71` contre `useExtensionDeLaModification.tsx:15`, et `useDefilementDeLaGrille.ts:63` contre `useDefilementHorizontal.ts:40`. Le seuil de 5 % ne les bloque pas. **[mesuré]**
- `npx knip` : rien. **[mesuré]**
- jscpd ne voit que le texte copié. Les duplications qui comptent dans ce dépôt sont des **règles redites avec d'autres mots** (constats C1, C2, C7, C9) : aucun outil ne les signale.

### 2.5 Graphe des dépendances du moteur

Mesuré par un script qui lit les `import` et `export … from` des 65 modules (55 et `outils/`). **[mesuré]**

- **Aucun cycle**, ni en comptant les imports de types, ni sans eux.
- 18 niveaux de profondeur. En bas : `regles`, `format`, `annees`, `statuts`, `regles-de-structure`, `net-compare`, `options-du-comparateur`. En haut : `outils/catalogue`.
- Les plus importés : `regles` (36 modules), `format` (17), `dispositifs` (10), `conversion-de-statut` (9), `professions` (9).
- Ceux qui importent le plus : `simulation-au-reel` (15), `colonne-du-comparateur` (14), `comparateur` (11), `simulation-engine` (10).
- Hors du moteur, il n'importe que `src/types.ts` (54 modules), `src/backend/regles` (1) et Zod (12). La règle du guide est tenue.

La chaîne principale va bien dans un seul sens : calculs par statut, puis `simulation-au-reel` et `simulation-micro`, puis `simulation-engine`, `colonne-du-comparateur`, `simulation-d-un-statut`, `optimisation-remuneration`, `comparateur`, `chiffre-d-affaires-pour-un-net`, `simulation-pluriannuelle`, enfin `strategies-de-distribution` et `outils/`.

Trois arêtes vont dans un sens discutable, sans gravité :

| Arête | Pourquoi elle surprend |
|---|---|
| `simulation-portage` → `options-du-comparateur` | le calcul d'une année dépend d'un module de réglages du comparateur, pour `conditionsPortageRetenues` |
| `cotisationsSalarie` → `cotisationsTNS` | le régime général importe `parTranches` par un réexport du module des indépendants (`cotisationsTNS.ts:9`), alors que la fonction est dans `baremes.ts` |
| `dispositifs` → `calculsAE` et `regles-de-structure` | un module importé par dix autres en tire lui-même deux |

### 2.6 Coût des calculs

Mesuré en empaquetant le moteur réel hors du dépôt, avec des compteurs ajoutés en mémoire à l'empaquetage. Une « simulation » est un appel de `runMetaSimulation`, c'est-à-dire une année entière. Les nombres d'appels sont exacts ; les temps sont ceux d'un poste de 16 cœurs occupé par un autre travail, à lire comme des ordres de grandeur. **[exécuté]**

| Appel | Session | Temps | Simulations | Bulletins de paie calculés |
|---|---|---:|---:|---:|
| `simulerLesAnnees` | exemple de la démo, 1 an | 3 ms | 1 | 945 |
| `simulerLesAnnees` | la même, sur 10 ans | 18 ms | 10 | 9 452 |
| `comparerStatutsDeLAnnee`, partage « grille » | exemple | 4 ms | 7 | 1 379 |
| `comparerStatutsDeLAnnee`, « rémunération choisie » | exemple | 4 ms | 9 | 1 504 |
| `comparerStatutsDeLAnnee`, « tout en rémunération » | exemple | 23 ms | 37 | 8 956 |
| `comparerStatutsDeLAnnee`, au meilleur net | exemple | 86 ms | 271 | 31 092 |
| `comparerStatutsDeLAnnee`, au meilleur net | 11 situations types | 25 à 77 ms | 216 à 370 | 8 445 à 30 596 |
| `comparerStatutsDeLAnnee`, au meilleur net | session maximale des tests (10 acteurs) | 202 ms | 287 | 33 648 |
| `arbitrageDeLAnnee` (une société) | exemple | 37 à 52 ms | 141 à 172 | 16 627 à 22 847 |
| `comparerStrategiesDeDistribution` | exemple sur 10 ans | 27 à 34 ms | 90 | 11 932 à 14 452 |
| Calcul à l'envers, au meilleur net, net visé = net actuel + 30 000 € | exemple et 5 situations types | 455 à 834 ms | 2 917 à 4 614 | 162 371 à 336 678 |
| Calcul à l'envers, mêmes réglages | session maximale | 2 710 et 4 626 ms | 3 988 et 6 755 | 497 691 et 957 149 |

Trois lectures :

1. La simulation des années et le comparateur hors « meilleur net » sont instantanés.
2. Au meilleur net, une comparaison relance l'année entière 216 à 370 fois. C'est voulu (« aucune formule à part, le moteur seul dit le net ») et cela reste sous les 300 ms d'attente du calcul différé.
3. Le calcul à l'envers est le seul appel que l'utilisateur peut sentir. Il n'y a aucun `Worker` dans `src/web` ni dans `src/ui` : dans la démo, le calcul tourne dans la page et fige l'affichage ; dans l'application, il occupe le process principal.

Le commentaire de `optimisation-remuneration.ts:17` (« une simulation coûte moins d'une milliseconde ») n'est plus vrai pour une session qui contient une SASU : la simulation des résultats y coûte environ 3 ms, à cause de la recherche de la limite de rémunération (17 calculs de société, 945 bulletins).

### 2.7 Tests

Mesures de la passe sur les tests, par comptage. **[rapporté]**

| Mesure | Résultat |
|---|---|
| Tests unitaires du moteur | 37 fichiers, 661 `it`, 1 608 `expect` |
| Cas de référence | 19 fichiers, 220 `it`, 538 `expect` |
| `skip`, `only`, `todo` | 0 |
| Simulacres | `vi.fn` : 0. `vi.mock` : 1 (une année 2027 fictive). `vi.spyOn` : 14, dont 13 sur la console |
| Instantanés (`toMatchSnapshot`) | 0 |
| Assertions lâches (`>`, `<`, `toBeDefined`) | 76 sur 2 146, soit 3,5 % |
| Égalités sur une phrase entière de plus de 80 caractères | 44 |
| Couverture (rapport du 25/11, non régénéré) | lignes 99,9 %, branches 96,7 %. Les plus faibles en branches : `strategies-de-distribution.ts` 76,5 %, `simulation-pluriannuelle.ts` 84,1 %, `simulation-d-un-statut.ts` 89,4 % |
| Rapport de mutation | du 4 octobre, 10 fichiers sur 57 : trop ancien pour décrire l'état actuel |

---

## 3. Constats, par gravité

### Gravité élevée : à traiter avant la prochaine fonctionnalité

#### C1. La règle « colonne jamais retenue » est recopiée hors du moteur, et la copie a divergé

- **Emplacements.** Le moteur décide dans `comparateur.ts:86-87` : quatre drapeaux de la colonne, plus un cinquième motif calculé à part (profession qui exerce en principe en société d'exercice libéral). `src/lib/resume.ts:128` recopie la ligne 86 mot pour mot, sans la ligne 87.
- **Preuve [exécuté].** Un ostéopathe en entreprise individuelle, 10 000 € de recettes par mois, règles de 2026, partage au meilleur net. Le moteur désigne l'entreprise individuelle, puisque la SASU et l'EURL classiques sont écartées. La phrase du verdict (`resume.ts:185`) écrit pourtant : « le statut actuel, EI au réel, donne le meilleur net : 63 137 €. Juste derrière : SASU, +5 091 €. » La même situation (entreprise individuelle désignée, SASU au net supérieur et non marquée) se retrouve à 15 000 € par mois ; la passe sur la bibliothèque la signale aussi à 25 000 €.
- **Pourquoi c'est un problème.** L'utilisateur lit qu'un statut « juste derrière » rapporte 5 091 € de plus que le meilleur. Et la cause est structurelle : ces motifs sont énumérés à huit endroits dans six fichiers (`comparateur.ts:86` et `:107-112`, `lib/resume.ts:128` et `:138-143`, `lib/export-csv.ts:158-164`, `lib/export-markdown.ts:343`, `ComparatorPanel.tsx:165-166`, `outils/comparaison.ts:62-79`). Un sixième motif demandera jusqu'à huit modifications, dont aucune n'est réclamée par le compilateur : ce sont des champs facultatifs.
- **Proposition.** Le moteur calcule une seule fois, pour chaque colonne, la raison pour laquelle elle n'est pas retenue (une valeur parmi une liste fermée, ou rien), société d'exercice libéral comprise, et la pose sur la colonne. `resume.ts`, les exports et l'écran lisent ce champ, avec une table `Record<Raison, string>` pour les libellés. Les quatre drapeaux actuels peuvent rester pour le format des outils d'IA.
- **Effort :** S. **Risque pour les calculs :** nul, le meilleur statut ne change pas.
- **Tests.** `comparateur.test.ts` et `lib/resume.test.ts` protègent l'existant. Il manque le cas ci-dessus pour `phraseDuVerdict`. Une décision reste à prendre : griser ou non ces colonnes à l'écran (`ComparatorPanel.tsx:234` et `:253`).

#### C2. Les lignes de résultat sont tenues à la main dans trois à cinq listes, qui ont déjà dérivé

- **Emplacements [rapporté, relu pour les foyers].** Pour les foyers : l'écran (`ResultsPanel.tsx:249-293`), le CSV (`lib/export-csv.ts:65-66`), le Markdown (`lib/export-markdown.ts:189-190`), la ligne de commande (`lib/simuler-en-ligne-de-commande.ts:97-111`) et l'outil pour les IA (`outils/resultats.ts:33-41`). Même schéma pour le bilan (`ResultsPanel.tsx:84-94`, `export-csv.ts:32-46`, `export-markdown.ts:160-175`) et pour le comparateur (`ComparatorPanel.tsx:108-128`, `export-csv.ts:153-182`, `export-markdown.ts:346-361`).
- **Preuve [lu].** `versementLiberatoire` et `beneficesExoneres` du foyer sont affichés à l'écran et n'apparaissent dans aucun des deux exports : la recherche de ces deux noms dans `export-csv.ts`, `export-markdown.ts` et `export-commun.ts` ne trouve que le versement libératoire de l'activité. L'écran sépare l'impôt payé avec les cotisations de l'impôt au barème (`ResultsPanel.tsx:261-272`), et son commentaire dit pourquoi : « 792 € sur 0 € imposables au barème laissait croire à une erreur ». Les exports donnent encore l'impôt entier sous « Impôt sur le revenu », à côté d'un revenu imposable qui peut être nul.
- **Pourquoi c'est un problème.** Le plan d'épargne retraite ajoute des lignes par personne et par foyer (ADR 021 : le déduit, le montant rajouté au revenu fiscal de référence, l'économie d'impôt, « dont épargne retraite »). Chaque ligne de foyer se pose aujourd'hui à six positions dans trois fichiers, plus deux sorties annexes, sans rien qui signale un oubli. Seul le détail des cotisations a une source commune et un test d'alignement (`export-aligne-ecran.test.ts`).
- **Proposition.** Dans `src/lib`, une table de descripteurs par tableau (libellé, accès au champ, condition d'affichage), lue par le CSV et le Markdown ; l'écran garde sa mise en page et y prend ses libellés et ses calculs (`auBareme` sort du composant). Ajouter un test : « chaque champ numérique de `FoyerFiscalResult` et de `SimulationBilan` figure dans les deux exports, ou dans une liste d'exclusions nommées ». Commencer par les foyers.
- **Effort :** M. **Risque pour les calculs :** nul. Risque sur le format : les libellés du CSV sont publics ; les égalités exactes de `export-csv.test.ts` et de `export-markdown.test.ts` les protègent.

#### C3. Il manque un filet large pour une refonte « à résultats inchangés »

- **Constat [rapporté, vérifié sur le fichier].** Le seul test qui passe des situations entières dans le moteur est `src/lib/montages/montages.reference.test.ts` : 12 situations, une année. Il fige le net total, cinq champs par foyer, trois champs par activité, le début des avertissements et le meilleur statut. Il ne fige ni le chiffre d'affaires, ni les charges, ni le revenu versé, ni le revenu fiscal de référence, ni le bilan, ni les lignes de cotisations, ni les nets par colonne. `scenarios-de-test.test.ts` vérifie surtout que rien ne lève d'erreur.
- **Pourquoi c'est un problème.** Les cas de référence protègent chaque règle, pas l'assemblage. Les chantiers C4, C5 et C7 touchent l'assemblage : sans filet, une régression sur un champ secondaire passe.
- **Proposition.** Un **test de caractérisation**, c'est-à-dire un test qui fige ce que le code produit aujourd'hui, sans juger si c'est juste : le `SimulationReport` entier et le résultat de `comparerStatutsDeLAnnee` pour les 12 situations types, les scénarios de test et `sessionMaximale()` (3 années, elle existe déjà), montants arrondis au centime, années publiées seulement. Le nommer « caractérisation », à part des références : il se régénère à chaque changement voulu d'une règle.
- **Effort :** M. **Risque :** nul.

### Gravité moyenne

#### C4. Le calcul d'une activité inscrit ses versements par effet de bord, ce qui interdit de le réutiliser

Un **effet de bord** est une modification faite ailleurs que dans la valeur rendue.

- **Emplacements [lu].** `Contexte` porte deux champs que les activités modifient en cours de calcul : `revenus` et `nonRattache` (`routage-des-flux.ts:61` et `:65`). Chaque simulation d'activité rend son résultat **et** écrit sur le compte des personnes : sociétés par `verserRemuneration`, `attribuerResultatSociete`, `verserDividendes` (`routage-des-flux.ts:158-212`), entreprise individuelle (`simulation-au-reel.ts:259-270`), micro-entreprise (`simulation-micro.ts:132-143`), portage (`simulation-portage.ts:160-176`). Le compte d'une personne est un objet de 14 champs mis à zéro à la main (`routage-des-flux.ts:151`).
- **Preuve.** Trois blocs presque identiques : « s'il y a un titulaire, ajouter à ses revenus ; sinon, un avertissement et `ctx.nonRattache += …` ». Et une conséquence mesurée : on ne peut pas calculer une société seule sans inscrire ses versements. Le comparateur relance donc toute l'année pour lire un champ d'une activité : `beneficeAvantDividendes` (`simulation-d-un-statut.ts:88-91`) simule la session entière et n'en lit que `resultatConserve`. Chaque point de la courbe coûte deux simulations (`simulation-d-un-statut.ts:124` puis `:141`), la première pour connaître le bénéfice distribuable. Il existe ainsi deux façons de chercher la plus haute rémunération sans déficit : sur le calcul de la société (`simulation-au-reel.ts:158`) et sur l'année entière (`simulation-d-un-statut.ts:105` et `:128`, `optimisation-remuneration.ts:66`).
- **Pourquoi c'est un problème.** Le résultat dépend de l'ordre des appels, ce que le type ne dit pas. La livraison 2 du PER (déduction sur le bénéfice de l'entreprise individuelle et sur la rémunération du gérant) passera par ces blocs. Et toute réduction du nombre de simulations bute dessus.
- **Proposition.** Un enchaînement en deux temps. Chaque simulation d'activité rend `{ resultat, versements, avertissements }`, où `versements` est une liste typée (à qui, combien, sous quel traitement fiscal). Le moteur inscrit ensuite tous les versements en un seul endroit, qui porte aussi le cas « aucune personne reliée ». Le `Contexte` devient en lecture seule.
- **Effort :** L. **Risque pour les calculs :** moyen, c'est le cœur. À faire après C3.
- **Tests.** `simulation-engine.test.ts`, tous les cas de référence et `lib/regles-de-structure.exhaustif.test.ts` passent par `runMetaSimulation` et ne dépendent pas de la forme interne : ils protègent bien. Il manque C3.

#### C5. La recherche du brut pour un net est refaite des dizaines de milliers de fois à l'identique

Une **dichotomie** cherche une valeur en coupant un intervalle en deux à chaque tour.

- **Emplacements [lu].** `brutPourUnNet` (`cotisationsSalarie.ts:143`) et `revenuAvantCotisationsPourUnNet` (`cotisationsTNS.ts:101`) font chacune 60 tours, et chaque tour calcule un bulletin ou des cotisations entières.
- **Preuve [exécuté].** Sur une comparaison au meilleur net de la session d'exemple : 271 simulations, 31 092 bulletins et 14 697 calculs de cotisations d'indépendant. La société du conjoint, qui ne change pas d'une simulation à l'autre, est recalculée 271 fois ; chaque point de la courbe est simulé deux fois à la même rémunération. J'ai ajouté en mémoire, à l'empaquetage, une **mémoïsation** de ces deux fonctions (garder le résultat d'un appel pour le rendre tel quel au prochain appel identique), par objet de règles, statut et net :

| Calcul | Sans | Avec | Bulletins sans / avec |
|---|---:|---:|---|
| Comparateur au meilleur net, exemple (micro) | 86 ms | 24 ms | 31 092 / 579 |
| Comparateur au meilleur net, « micro BNC seule » | 38 ms | 7 ms | 13 035 / 286 |
| Calcul à l'envers, exemple (micro) | 827 ms | 221 ms | 328 143 / 32 865 |
| Calcul à l'envers, « SASU sans salaire » | 591 ms | 150 ms | 219 812 / 30 766 |
| Calcul à l'envers, session maximale (SASU) | 2 710 ms | 2 060 ms | 497 691 / 278 611 |
| Calcul à l'envers, session maximale (EURL) | 4 626 ms | 3 246 ms | 957 149 / 438 111 |

  L'empreinte du résultat complet est identique avec et sans mémoïsation dans les 20 calculs comparés (10 activités, comparateur et calcul à l'envers).
- **Pourquoi c'est un problème.** Le calcul à l'envers fige l'affichage 0,5 à 0,8 seconde sur une session ordinaire et plusieurs secondes sur une session chargée. La livraison 3 du PER (« maximum déductible, statut par statut ») ajoutera une recherche par colonne.
- **Proposition, en deux marches.** D'abord mémoriser les deux dichotomies : une table par objet de règles (`WeakMap`), bornée en taille, vidée quand elle est pleine. Le gain est faible sur la session maximale parce que les règles réduites sont des objets recréés à chaque appel (`reglesDeLAnneeDeCreation`, `avecUnePartDuPlafond`) et que le calcul avec une caisse de libéraux n'était pas mémorisé dans mon essai : construire ces règles une fois par activité et par année rendrait le cache efficace partout. Ensuite seulement, si le calcul à l'envers reste lent, le sortir du fil de l'interface (un `Worker` dans la démo), ou réduire le nombre de simulations, ce qui demande C4.
- **Ce que je ne recommande pas.** Baisser les 60 tours : cela change les résultats à la dixième décimale et casserait des égalités exactes pour un gain moindre. Remplacer les simulations par des formules : cela trahirait le principe du comparateur.
- **Effort :** S pour la première marche. **Risque pour les calculs :** nul si la clé du cache est juste ; une clé fausse rendrait un résultat faux en silence.
- **Tests.** `cotisationsSalarie.test.ts` et `cotisationsTNS.test.ts` protègent les deux fonctions. Il manque un test « avec et sans cache, mêmes résultats » sur les situations types, et C3.

#### C6. Les règles réduites à une période ont le même type que les règles de l'année

- **Emplacements [lu].** Cinq fonctions fabriquent des règles modifiées par copie : `reglesDeLAnneeDeCreation` et `reglesAvantLaCreation` (`annee-de-creation.ts:60` et `:91`), `reglesDeLaMicro` (`professions.ts:94`), `avecUnePartDuPlafond` (`plafond-entre-mandats.ts:11`), `parametresDuBulletinDuPorte` (`simulation-portage.ts:34`). Toutes rendent un `ReglesFiscales` ou un `ReglesRegimeGeneral` ordinaire.
- **Preuve.** Dans `simulerSocieteIS` (`simulation-au-reel.ts:138-192`), deux jeux de règles du même type cohabitent : `regles` (réduites à la période) sert quatre fois, `ctx.regles` (l'année entière) sept fois. Se tromper de l'un à l'autre compile. Le piège a déjà obligé à ajouter un champ fantôme : `formationProfessionnelle.plafondEntier` (`regles.ts:56`), « jamais dans un fichier de règles », créé parce que le plafond de la sécurité sociale réduit avait écrasé le plafond entier dont un forfait avait besoin (`annee-de-creation.ts:68`, `cotisationsTNS.ts:75`).
- **Pourquoi c'est un problème.** L'idée est bonne : les calculs ne changent pas, ils reçoivent d'autres règles. Mais le PER lit le plafond de la sécurité sociale entier (10 % du plafond de N-1, huit plafonds pour l'article 154 bis). La livraison 2 passe par l'entreprise individuelle et l'EURL, dont les règles sont réduites l'année de création : lire `regles.TNS.plafondSecuriteSociale` au mauvais endroit donnerait un plafond de déduction faux, sans erreur.
- **Proposition.** Un **type marqué** : un type que TypeScript distingue d'un autre de même forme grâce à une étiquette qui n'existe qu'à la compilation. `ReglesDeLaPeriode` pour ce que rendent les cinq fonctions ; les calculs de cotisations l'acceptent ; les fonctions qui veulent l'année entière (PER, notes, profession, zone) exigent `ReglesFiscales` et refusent l'autre. `reglesDeLActivite` rend déjà `{ periode, regles }` : y ajouter les règles de l'année sous un nom explicite. Le champ `plafondEntier` peut alors disparaître.
- **Effort :** S à M. **Risque pour les calculs :** nul, ce ne sont que des types.
- **Tests.** `references/creation-en-cours-d-annee.reference.test.ts` protège les montants. Aucun test à ajouter : c'est le compilateur qui garde.
- **Réalisé le 26 novembre 2026.** `ReglesDeLaPeriode` marque ce que rendent `reglesDeLAnneeDeCreation`, `reglesAvantLaCreation` et `reglesDeLaPeriode` ; ces règles gardent celles de l'année (`anneeEntiere`, lues par `reglesDeLAnneeEntiere`), ce qui a permis de supprimer `plafondEntier`. Les calculs de cotisations, de société et de protection sociale acceptent les deux (`ReglesApplicables`). Les trois autres fabriques ne sont pas marquées, à dessein : `reglesDeLaMicro` rend des règles de l'année entière, où seul le taux de la profession change ; `avecUnePartDuPlafond` rend un bloc du régime général qui ne sort pas de `calculerSASU` et de la répartition entre mandats ; `parametresDuBulletinDuPorte` rend déjà un type à part (`BulletinDuPorte`). `annee-de-creation.test.ts` ajouté, avec deux lignes que le compilateur doit refuser.

#### C7. Deux mises en œuvre décident des relations après un changement de statut, et elles ne s'accordent pas toujours

- **Emplacements [lu].** Le comparateur reconstruit les relations d'une colonne dans `relationsCibles` (`conversion-de-statut.ts:185-201`, 17 lignes). Le changement de statut de la fiche les modifie sur place dans `relationsApres` (`changement-de-statut.ts:68-120`, 53 lignes), dont le commentaire dit « comme dans le comparateur ».
- **Preuve [exécuté].** Pour toutes les structures régulières à deux personnes de chaque forme, j'ai comparé les relations données par `changerLeStatut` et par `convertirLActivite` : **26 désaccords sur 252 conversions**, en deux familles.
  - Société sans dirigeant, qui n'a que des associés, passée de SASU en EURL ou l'inverse : la fiche laisse les associés tels quels, donc une société sans dirigeant ; la colonne du comparateur fait du premier associé le gérant ou le président. La colonne lui verse une rémunération que la session modifiée ne route vers aucun foyer.
  - EURL à deux gérants passée en SASU : la fiche garde le second gérant comme associé ; la colonne du comparateur le fait disparaître, et tous les dividendes vont au premier.
- **Pourquoi c'est un problème.** Le comparateur annonce un net, et appliquer le changement en donne un autre dans ces cas. Ils sont rares, mais ils montrent que la règle est écrite deux fois. `lib/regles-de-structure.exhaustif.test.ts:185-208` vérifie que chacune rend une structure régulière, pas qu'elles s'accordent.
- **Lisibilité.** `relationsApres` est la fonction la plus emmêlée du moteur : un drapeau `reprise` déclaré ligne 74 et modifié ligne 106 depuis un rappel de `flatMap`, et cinq `push` dans des tableaux extérieurs depuis des rappels de `flatMap` et de `filter` (lignes 89, 92, 102, 108, 116). Le résultat dépend de l'ordre de parcours.
- **Proposition.** Décider d'abord le comportement voulu dans les deux familles. Puis écrire une seule fonction pure : pour chaque personne reliée, son rôle d'arrivée ou son retrait, avec le motif. Le comparateur en tire ses relations, la fiche en tire ses relations et ses listes « changées, retirées, ajoutées ». Ajouter au test exhaustif l'accord des deux, exceptions nommées.
- **Effort :** M. **Risque pour les calculs :** faible, limité aux colonnes de structures irrégulières ou sans dirigeant.
- **Tests.** `changement-de-statut.test.ts`, le test exhaustif et `references/comparateur.reference.test.ts`.

#### C8. Les avertissements sont du texte libre, que le code reconnaît à leur libellé

- **Emplacements [lu].**
  - `strategies-de-distribution.ts:94` filtre les avertissements d'une société par `startsWith("Dividendes saisis")`, phrase écrite dans `calculsSociete.ts:127`.
  - `lib/alerte-courte.ts:29-33` reconnaît trois alertes par expression régulière sur leur début, écrites dans `simulation-portage.ts:153`, `regles-de-structure.ts:271` et `lib/changement-de-statut.ts:107`.
  - `lib/resume.ts:149` et `SyntheseDuComparateur.tsx:52` reconnaissent deux notes par égalité avec une constante.
  - `exoneration-de-zone.ts:168` a déjà dû rendre un objet à trois champs (`resume`, `avertissement`, `source`), parce que la carte ne montre que le début.
- **Pourquoi c'est un problème.** Reformuler la phrase de `calculsSociete.ts:127` vide en silence les avertissements des stratégies, et les tests des stratégies n'ont que des cas sans avertissement (`strategies-de-distribution.test.ts:53` et `:79` attendent une liste vide). 44 assertions comparent des phrases entières : chaque reformulation coûte. Le PER ajoute des avertissements.
- **Proposition bornée.** Ne pas tout refondre. Trois gestes : détecter par les montants ce que les stratégies lisent dans le texte (dividendes versés inférieurs au plan : les deux nombres sont déjà là) ; pour les trois alertes à ligne courte écrite, exporter le début de la phrase depuis le module qui l'écrit et le réutiliser des deux côtés ; pour les nouveaux avertissements, tester un fragment et le montant. Un avertissement structuré (`{ code, texte }`) ne se justifierait que si l'interface devait un jour les trier ou les regrouper.
- **Effort :** S. **Risque pour les calculs :** nul.

#### C9. La table des types de flux permis par genre d'acteur existe deux fois

- **Emplacements [lu].** `lib/flow-constants.ts:96-110` (`flowTypesByEntityType`, plus une liste à part pour l'entreprise individuelle), dans un fichier qui se déclare « source unique ». Et `outils/commun.ts:95-102` (`TYPES_PERMIS`), qui redit la même règle pour les propositions des IA, parce que le moteur ne peut pas importer `src/lib`.
- **Pourquoi c'est un problème.** L'ADR 021 crée un type de flux « Versement PER » sur la personne. Il faudra l'ajouter aux deux tables, et à plusieurs listes que le compilateur ne réclame pas : `TYPES_DE_FLUX` (`outils/commun.ts:70`), `outgoingFlowTypes` (`flow-constants.ts:83`), `natureDuFlux` (`annee-de-creation.ts:184`), les sommes de `impot-du-foyer.ts:18` et `:114`. Je n'ai trouvé aucun test qui compare les deux tables.
- **Proposition.** Une seule table dans le moteur, à côté de `REGLES_DE_STRUCTURE`, par genre d'acteur ; `flow-constants.ts` et `outils/commun.ts` la lisent. C'est le geste déjà fait pour `libelles-des-cotisations.ts`.
- **Effort :** S. **Risque pour les calculs :** nul.

#### C10. `dispositifs.ts` mêle sept sujets, dont un objet-valeur que tout le monde vient y chercher

Un **objet-valeur** est un petit type sans identité, défini par son contenu, avec ses propres opérations.

- **Preuve [mesuré, lu].** 353 lignes, 30 exports, importé par 10 modules. Il contient : le mois civil (`MoisCivil`, `lireMois`, `ecrireMois`, `libelleDuMois`, rang d'un mois, jours d'activité), le prorata des plafonds de la micro-entreprise, les sommes de chiffre d'affaires par nature, l'ACRE, la CFE, le calendrier de l'exonération de zone (alors que `exoneration-de-zone.ts` existe), et la sortie du régime micro sur plusieurs années. Ce dernier bloc est le seul calcul du moteur, avec `simulation-pluriannuelle.ts`, à appeler lui-même `reglesDeLAnnee` (`dispositifs.ts:308-309`).
- **Pourquoi c'est un problème.** `simulation-engine` et `annee-de-creation` n'en veulent que le mois civil, `frais-de-fonctionnement` que le mois civil et la CFE : ils tirent tout le reste avec eux. Le calendrier de la zone est à cheval sur deux fichiers.
- **Proposition.** Trois déplacements sans changement de code : `mois-civil.ts` pour l'objet-valeur ; le bloc de zone vers `exoneration-de-zone.ts` ; la sortie du régime micro vers un fichier à elle. Dans le même esprit, sortir `conditionsPortageRetenues` de `options-du-comparateur.ts` vers un petit module du portage, pour que `simulation-portage.ts` ne dépende plus des réglages du comparateur.
- **Effort :** S. **Risque pour les calculs :** nul. `dispositifs.test.ts` suit.

### Gravité faible

#### C11. Sept vocabulaires pour dire « quel genre d'activité »

`StatutJuridique` (`types.ts:30`), `StatutSociete` (`:41`), `StatutFrais` (`:369`), `StatutCompare` (`:1016`), `StatutDActivite` (`regles.ts:239`), `GenreDeStructure` (`regles-de-structure.ts:17`), `StatutJuridique | "micro"` (`professions.ts:131`), plus `ActivityResult.statut`, un texte d'affichage (`types.ts:525`). La micro-entreprise s'y appelle `"micro"`, `"micro-vfl"`, `"micro-entreprise"` ou `"Micro-entreprise"` selon l'endroit. Cinq petites fonctions passent de l'un à l'autre, dont deux portent le même nom, `statutDeLActivite`, dans deux fichiers avec deux types de retour (`exoneration-de-zone.ts:33`, `changement-de-statut.ts:21`). **[lu]**

Chaque union a sa raison d'être et le compilateur les tient : je ne propose pas de les fusionner. Proposition : un paragraphe du glossaire qui les dresse avec leurs conversions, et renommer l'un des deux `statutDeLActivite`. Effort S.

#### C12. La somme des flux d'une entité par type est écrite sept fois

`routage-des-flux.ts:69-79` et `:124` (la bonne, calculée une fois par année), `dispositifs.ts:70-74`, `comparateur.ts:95-97` et `:231-232`, `options-du-comparateur.ts:132-134`, `simulation-portage.ts:77-79`, `annee-de-creation.ts:206`. De même, `economieACRE` (`dispositifs.ts:150-154`) refait `appliquerTaux` (`calculsAE.ts:64-66`), et `reunir` (`simulation-micro.ts:84-93`) refait `chiffreAffairesReuni` (`dispositifs.ts:86-90`). Le test « services au-delà du plafond ou total au-delà du plafond » est écrit trois fois dans `calculsAE.ts` (lignes 74-78, 89-97, 112-118). **[lu]**

Ce sont des répétitions de cinq lignes, sans divergence constatée. Le risque apparaît le jour où une quatrième nature de chiffre d'affaires de micro-entreprise arrive. Proposition : une fonction `totalDeLaGrille(grille, entité, ...types)` dans un module sans dépendance, et `appliquerTaux` exportée. Effort S.

#### C13. `buildFoyers` fait trois choses en une fonction

`foyers.ts:69` : complexité cyclomatique 12 (le plafond), cognitive 16 (la plus haute du moteur), trois phases (grouper les couples, rattacher les enfants, compter les parts et avertir), et un `!` ligne 95 dont la validité repose sur une autre fonction. Elle fonctionne et `foyers.test.ts` la couvre. Proposition : trois fonctions nommées, à l'occasion. Effort S. **[mesuré, lu]**

#### C14. Les appels du comparateur resimulent toutes les années pour hériter d'une seule

`preparerOuEchouer` (`simulation-pluriannuelle.ts:139-145`) appelle `parcourirLesAnnees(session)`, qui simule chaque année de la session, années suivantes et recherche de la limite de rémunération comprises, pour n'en garder que l'héritage d'une année. **[exécuté]** Sur dix années : une comparaison en partage « grille » passe de 4 à 19 ms, dont environ 15 ms de pré-passe. C'est invisible aujourd'hui. À corriger en passant (s'arrêter à l'année demandée, sans la limite de rémunération) si le PER y ajoute des héritages. Effort S.

#### C15. Petits écarts aux règles écrites du projet

Aucun n'est un bogue. **[lu]**

| Emplacement | Écart |
|---|---|
| `routage-des-flux.ts:199` | `legalStatus === "SASU" ? … : …EURL` au lieu d'une table par `StatutSociete` : un troisième statut de société prendrait le message de l'EURL (règle « tables exhaustives plutôt que sinon ») |
| `annee-de-creation.ts:184-190` | `natureDuFlux` : chaîne de `if`, `startsWith("ca_")`, et un défaut « d'autres montants » ; les cinq libellés sont recopiés ligne 192 |
| `simulation-engine.ts:38-41` et `simulation-au-reel.ts:57-59` | le champ `anneeDeCreation` du résultat est écrit à deux endroits |
| `conversion-de-statut.ts:208`, `annee-de-creation.ts:142` | booléens passés par position (`…, dividendes === null, options.portage`, `…, true)` ou `false)`) : une inversion compile |
| onze endroits dans huit fichiers | `contexte.annee ?? regles.annee`, parce que `ContexteDeLAnnee` a une valeur par défaut `{}` dans quatre fonctions publiques ; une fonction existe (`anneeSimulee`) mais ne prend que le `Contexte` interne |
| `data-sanitizer.ts:140`, `:161`, `:312`, `calculs-du-pont.ts:19`, `entrees-ipc.ts` | `console.warn` ou `console.error` dans le moteur dit pur |
| `routage-des-flux.ts:129` | commentaire de documentation orphelin, resté au-dessus d'un autre |
| `optimisation-remuneration.ts:17` | commentaire de coût périmé (voir § 2.6) |
| `ResultsPanel.tsx`, `ComparatorPanel.tsx`, `resume.ts`, les deux exports | le taux global de prélèvement est calculé à six endroits, avec deux arrondis différents **[rapporté]** |

#### C16. Tests : quatre manques ciblés [rapporté]

- Les entrées pluriannuelles (`simulerLesAnnees`, `comparerStatutsDeLAnnee`, `comparerStrategiesDeDistribution`) lisent les règles réelles et n'acceptent pas de règles fictives. Dix fichiers de tests unitaires en dépendent, d'où les bornes lâches (`simulation-pluriannuelle.test.ts:87-88`, `strategies-de-distribution.test.ts:64-65`, `comparateur.test.ts:418` et `:638`).
- L'arrondi n'est jamais testé au demi-euro : tous les attendus de `calculsIR` sont entiers avant `Math.round`.
- `references/annee-suivante.test.ts:28-42` tient une liste à la main des cas rejoués, où manquent `creation-en-cours-d-annee` et `exoneration-de-zone`.
- 25 fonctions internes ne sont exportées que pour leurs tests (`impotPourUnePart`, `calculerIS`, `assietteSociale`, `periodeACRE`…) : les fusionner casserait des tests sans changer un résultat.

#### C17. Interface et process principal : deux erreurs avalées

- `canaux-de-la-session.ts:21-25` : quand `sessionAEcrire` refuse une session, le canal n'écrit rien et ne prévient que la console du process principal. **[lu]** L'interface ne le sait pas : l'utilisateur continue, rien n'est enregistré. Il faut pour cela un désaccord entre l'interface et le nettoyage, ce qu'une évolution du schéma peut créer. Proposition : signaler comme un échec d'écriture. Effort S.
- `useSessionManager.ts:53-67` : un chargement initial qui échoue n'est dit qu'à la console, et la sauvegarde automatique reste coupée. **[rapporté]**
- `MonthlyGrid.tsx:203` : 251 lignes, dix gestionnaires, et une comparaison à la main des quatre champs d'un changement de flux (ligne 307) : un cinquième champ serait ignoré. **[rapporté]**

---

## 4. Ce qui est bien et qu'il ne faut pas toucher

- **Les tables par statut.** `SIMULATION_PAR_STATUT`, `CALCUL_DES_SOCIETES`, `CALCUL_PAR_CAISSE`, `PROTECTION_PAR_STATUT`, `REGLES_DE_STRUCTURE`, `FRAIS_DES_COLONNES`, `PARTICULARITES_DES_CAISSES` sont déjà le patron « table de stratégies » : une entrée par cas, typée par `Record<Union, …>`, et le compilateur réclame chaque nouveau cas. Elles vivent près de leur calcul. Les réunir dans un seul objet par statut lierait des modules qui n'ont pas à se connaître.
- **Les calculs par statut.** `calculsSociete`, `calculsEURL`, `calculsSASU`, `calculsEI`, `calculsAE`, `calculsIR`, `cotisationsTNS`, `cotisationsSalarie`, `cotisations-liberales`, `baremes` : des fonctions pures, des entrées et des résultats nommés, la règle et sa source en commentaire. Rien à refondre.
- **« Les calculs ne changent pas, ils reçoivent d'autres règles. »** L'année de création, la part du plafond entre mandats, le taux propre d'une caisse passent par des règles transformées, sans un `if` de plus dans les calculs. À garder, en y ajoutant le type de C6.
- **Les règles toujours passées en paramètre.** Aucune fonction de calcul ne va chercher les règles de l'année en cours par défaut.
- **Les unions discriminées**, c'est-à-dire des types à plusieurs formes qu'un champ distingue : `ZoneDeLActivite`, `PeriodeDeLActivite`, `ObstacleAuRole`, `ReglesDeLAnnee`, `ResultatLecture`. Elles rendent les cas impossibles à oublier.
- **Le principe du comparateur.** Convertir l'activité puis relancer le moteur, sans formule à part. Les optimisations doivent se glisser dessous (C5), pas le remplacer.
- **Les recherches.** La fausse position avec dichotomie de secours et son plafond de 80 essais, la grille de 60 points affinée à 100 € : elles sont bornées, documentées, et testées par propriétés.
- **L'arrondi.** Les calculs ne s'arrondissent pas ; le moteur arrondit à la sortie ; le bilan additionne des montants arrondis ; les identités sont vérifiées à 2 € près. C'est cohérent et assumé.
- **La persistance.** Conversions de format en chaîne, nettoyage élément par élément, erreurs typées, écriture atomique.
- **Le graphe.** Aucun cycle, et le sens des dépendances entre dossiers est vérifié par ESLint.
- **Les tests.** Ils vérifient des résultats, sans simulacre ni instantané ; les règles fictives aux chiffres ronds et les cas de référence dérivés à la main sont le bon partage.
- **Le serveur MCP et l'écriture des fichiers.** Tout ce qui est lu est revalidé, chaque canal vérifie son émetteur et ses paramètres. **[rapporté]**

Deux choses que je ne recommande pas, pour les avoir pesées :

- **un objet « Montant » ou « Euros »** : les montants sont des nombres partout, sans confusion d'unités constatée, et le coût de conversion serait élevé ;
- **des avertissements entièrement structurés** : voir C8, trois gestes bornés suffisent aujourd'hui.

---

## 5. Plan proposé

Chaque chantier tient sur une branche, avec la vérification complète verte. L'ordre va du plus rentable et du moins risqué au plus lourd.

### À faire avant le PER

| N° | Chantier | Constat | Effort | Risque sur les calculs | Pourquoi avant |
|---|---|---|---|---|---|
| 1 | Une seule raison de non-retenue, posée par le moteur ; corriger la phrase du verdict | C1 | S | nul | bogue visible aujourd'hui |
| 2 | Test de caractérisation : rapports entiers figés pour les situations types, les scénarios et la session maximale | C3 | M | nul | filet de tout ce qui suit, et du PER lui-même |
| 3 | Type marqué pour les règles d'une période ; accès nommé aux règles de l'année entière ; suppression de `plafondEntier` | C6 | S à M | nul | le PER lit le plafond de la sécurité sociale entier (livraisons 1 et 2) |
| 4 | Une seule table des types de flux permis, dans le moteur | C9 | S | nul | la livraison 1 crée le flux « Versement PER » |
| 5 | Lignes du foyer, puis du bilan et du comparateur : table commune aux exports, test d'alignement ; rattraper les deux champs oubliés | C2 | M | nul | la livraison 1 ajoute des lignes par personne et par foyer |

### À faire avant la livraison 3 du PER (comparateur et optimiseur)

| N° | Chantier | Constat | Effort | Risque sur les calculs | Pourquoi à ce moment |
|---|---|---|---|---|---|
| 6 | Mémoriser les deux dichotomies ; test « avec et sans cache » ; remesurer | C5 | S | nul si la clé est juste | la livraison 3 ajoute une recherche par colonne |

### Peuvent attendre

| N° | Chantier | Constat | Effort | Risque sur les calculs |
|---|---|---|---|---|
| 7 | Rangement : `mois-civil.ts`, la zone et la sortie du régime micro hors de `dispositifs.ts`, les conditions du portage hors des réglages du comparateur, `totalDeLaGrille`, les petits écarts | C10, C12, C15 | S | nul |
| 8 | Avertissements : plus aucune reconnaissance par le texte | C8 | S | nul |
| 9 | Relations après un changement de statut : trancher les deux familles, une seule règle, test d'accord | C7 | M | faible |
| 10 | Séparer le calcul d'une activité de l'inscription de ses versements ; contexte en lecture seule | C4 | L | moyen |

Le chantier 10 est le seul qui touche le cœur. Il n'est pas nécessaire au PER. Il le devient avant un nouveau statut, ou si le calcul à l'envers reste trop lent après le chantier 6. Les chantiers 2 et 3 doivent le précéder.

---

## 6. Limites de cet audit

- **Aucun test n'a été lancé**, ni Stryker, ni la vérification complète. Aucune des propositions n'a été essayée contre la série de tests. L'essai de mémoïsation a été validé sur 20 calculs, par comparaison d'empreintes, pas par les tests.
- **Les temps** ont été pris sur un seul poste, pendant qu'un autre travail occupait le processeur. Les nombres d'appels sont exacts.
- **Lecture du moteur.** 46 fichiers lus en entier, commentaires compris. Sept lus sans leurs commentaires (`annees`, `frais-kilometriques`, `entrees-ipc`, `migrations`, `fichiers-de-donnees`, `sauvegardes-groupees`, `messages-des-fichiers`). Deux lus en partie (`regles.ts`, dont les types ont été parcourus, et `nettoyage-comparateur.ts`). `outils/` a été mesuré et lu par endroits, pas ligne à ligne. De `src/types.ts`, j'ai lu les types de résultats, pas les schémas Zod.
- **Les passes secondaires** (bibliothèque, interface et serveur MCP, tests) sont marquées **[rapporté]**. J'ai rejoué le bogue du verdict, relu l'écart entre l'écran et les exports sur l'impôt du foyer, relu le canal d'enregistrement de la session et le test des situations types. Le reste n'a pas été relu.
- **L'application n'a pas été lancée.** Le bogue du verdict est confirmé sur les fonctions de `src/lib`, pas à l'écran.
- **Les 26 désaccords de C7** sont constatés ; je ne sais pas laquelle des deux mises en œuvre exprime l'intention.
- **La couverture** vient du rapport du 25 novembre, non régénéré. Le rapport de mutation date du 4 octobre. Les résultats de SonarQube n'ont pas été consultés.

Les scripts de mesure sont hors du dépôt, dans un dossier temporaire qu'un redémarrage peut vider : `C:/Users/damie/AppData/Local/Temp/claude/9b145e8d734f4b2c/50b19129-530e-4502-83ec-4cea5ac03a77/scratchpad/audit/` (`agreger-eslint.cjs`, `mesures-ast.cjs`, `graphe-imports.cjs`, `construire-mesures.cjs` et `mesures-moteur.ts`, `construire-envers.cjs` et `mesures-envers.ts`), et `…/scratchpad/audit-lib-verif/verdict-sel.ts` pour le bogue du verdict. Ils empaquettent le moteur avec l'esbuild du dépôt et n'y écrivent rien.

---

## 7. Relecture du rapport (2026-11-26)

Relecture faite dans le code, sans rien exécuter, par la session qui a commandé l'audit.

**Constats relus et confirmés à la lecture :**

- **C1.** `estNonRetenue` (`src/lib/resume.ts:128`) n'a pas le critère de la société d'exercice libéral que porte `meilleurStatut` (`comparateur.ts:87`), et `phraseDuVerdict` choisit le « juste derrière » avec ce prédicat. L'ostéopathe porte bien `societeExerciceLiberal: true` dans les règles.
- **C2.** La ligne des foyers du CSV (`export-csv.ts:65-66`) n'a ni le versement libératoire ni le bénéfice exonéré du foyer, que l'écran affiche (`ResultsPanel.tsx:262-292`).
- **C6.** `plafondEntier` existe bien pour contourner le plafond réduit (`annee-de-creation.ts:68`, `cotisationsTNS.ts:75`).
- **C7.** Les deux fonctions existent et sont écrites séparément ; le drapeau `reprise` est modifié depuis un rappel de `flatMap`.
- **C9.** Les deux tables sont identiques aujourd'hui, et écrites deux fois.

**Non rejoué :** les 26 désaccords de C7, les temps et les gains de C5, les mesures de la section 2.

**Un ajustement à l'ordre du plan.** Le chantier 3 (type marqué pour les règles d'une période) peut attendre la livraison 2 du PER. La livraison 1 calcule dans le foyer, avec les règles de l'année entière, et lit le plafond de la sécurité sociale de N-1 dans un bloc `IR.epargneRetraite`, que `reglesDeLAnneeDeCreation` ne réduit pas (elle ne touche qu'aux blocs `TNS`, `liberauxReglementes`, `regimeGeneral` et `IS`). Le risque décrit par C6 ne naît qu'avec la déduction sur le bénéfice ou la rémunération.

Ordre retenu pour la proposition faite au propriétaire :

| Moment | Chantiers |
|---|---|
| Avant la livraison 1 du PER | 1 (verdict), 2 (test de caractérisation), 4 (table des types de flux), 5 (lignes des exports, foyers d'abord) |
| Avant la livraison 2 | 3 (type marqué) |
| Avant la livraison 3 | 6 (mémoïsation) |
| Plus tard | 7, 8, 9, 10 |
