# ADR-010: Outils pour les clients d'IA

- **Date :** 2026-10-06
- **Statut :** Accepté

## Contexte

La phase 16 de la feuille de route doit permettre à un client d'IA de remplir une simulation à partir d'un cahier de comptes ou de factures, de l'interroger et d'en analyser les résultats. Deux hôtes sont prévus : un serveur MCP local pour l'application de bureau (étape 2), et un assistant intégré à la démo web et à l'application (étape 3). Il leur faut une seule définition des outils, sinon les deux divergeront.

Cinq contraintes viennent de la feuille de route :

1. **Les chiffres viennent du moteur, jamais du modèle.**
2. **Le modèle propose, l'utilisateur valide** : chaque modification se relit (« Appliquer ces 24 flux ? ») et s'annule en une étape.
3. **Méfiance envers les documents** : une facture peut contenir des instructions piégées. Les outils sont limités, rien ne sort de la simulation, pas de suppression en masse.
4. **Confidentialité** : les résultats ne contiennent que des données de la session.
5. Le code doit tourner dans le process principal d'Electron (Node, modules ES) comme dans la page web.

## Décision

**Un module pur, `src/backend/logic/outils/`, sans transport ni interface : un catalogue de quinze outils, chacun avec un nom, une description écrite pour un modèle, des schémas Zod pour ses paramètres et son résultat, et une fonction `executer(session, paramètres)`.**

```ts
catalogueDesOutils()                    // → { nom, titre, description, inputSchema, outputSchema, lecture }[]
executerOutil(nom, session, arguments)  // → { ok: true, resultat, nouvelleSession? } | { ok: false, erreur }
```

### Le catalogue

| Outil | Rôle |
| --- | --- |
| `decrire_simulation` | Années, acteurs (identifiants, réglages utiles au calcul, sans l'apparence), relations, nombre de flux, empreinte de la session. |
| `lister_flux` | Flux saisis, filtrés par année, acteur, type et mois, regroupés en séries ou un par un ; 500 lignes au plus. |
| `simuler` | Résumé d'une année calculée par le moteur : bilan, foyers, activités, personnes. |
| `synthese_des_annees` | Une ligne par année : net, chiffre d'affaires, prélèvements, impôt, cotisations, résultat conservé. |
| `expliquer_resultat` | Le détail d'un acteur : cotisations ligne à ligne, partage du bénéfice, versement libératoire, ACRE, impôt du foyer. |
| `comparer_statuts` | Le comparateur, avec les réglages enregistrés, ou une variante passée en paramètres sans rien enregistrer. |
| `optimiser_remuneration` | Rémunération au meilleur net, et au meilleur net avec 4 trimestres de retraite ; onze points de la courbe. |
| `regles_de_l_annee` | Les principaux seuils et taux de l'année, avec leur source officielle. |
| `proposer_flux` | Ajouter des séries de flux (une année, des mois) ; ajoute l'année voisine si besoin. |
| `proposer_acteur` | Ajouter une personne ou une activité. |
| `proposer_relation` | Ajouter une relation, selon les règles de la fenêtre des relations. |
| `proposer_modification` | Modifier des séries (montant, brut, libellé, sur certains mois) ou les réglages d'acteurs. |
| `proposer_suppression` | Supprimer une série d'une année, ou une relation. |
| `proposer_reglages_comparateur` | Enregistrer des réglages du comparateur pour une activité. |
| `appliquer_proposition` | Appliquer une proposition acceptée par l'utilisateur. |

Les noms sont en français, comme le reste du code, en minuscules et tirets bas (accepté par MCP et par les fournisseurs). Les mois vont de 1 à 12 dans les paramètres et les résultats (0 à 11 dans la grille) : c'est ce qu'un modèle lit sur une facture. Les montants calculés sont arrondis à l'euro ; les montants saisis gardent leurs centimes, pour qu'une série se désigne sans ambiguïté.

### Proposer, puis appliquer

- **Une proposition est une donnée, pas une action** : `{ empreinteSession, operations }`, où chaque opération est typée (`ajouter_flux`, `modifier_serie`, `ajouter_acteur`…). L'outil de proposition l'applique à une copie pour la valider, et rend avec elle un récapitulatif (« Ajouter 24 flux, ajouter 1 acteur et ajouter 1 relation ? »), une ligne de résumé par opération, les doublons probables (même flux déjà saisi le même mois) et, pour chaque année, le net après impôts et le résultat conservé avant et après, calculés par le moteur. La session reçue n'est jamais modifiée (un test la gèle).
- **Enchaîner** : chaque outil de proposition accepte `suiteDe`, une proposition précédente qu'il complète. Le modèle propose une société, puis sa relation « Président », puis ses flux, et l'utilisateur valide le tout en une fois. Les identifiants des acteurs et relations proposés sont déterministes (préfixe, début de l'empreinte, rang), ceux des flux aussi (début de l'empreinte des opérations, rang) : la même proposition donne toujours la même session.
- **Appliquer** rend une nouvelle session, sans toucher à l'ancienne. Toutes les vérifications sont refaites, car le modèle renvoie la proposition et pourrait l'avoir modifiée : schéma de chaque opération, limites, règles métier, puis schéma de la session et nettoyage (ADR 005), qui ne doit rien trouver à corriger.
- **Proposition périmée** : l'empreinte est un double hachage FNV-1a du JSON aux clés triées du contenu de la session (nom, acteurs, relations, années, comparateur). Si la session a changé depuis la proposition (modification à la main, annulation, autre proposition appliquée), elle est refusée : le modèle doit relire et reproposer. Le hachage repère un changement ; il ne protège aucun secret.

### Limites

| Limite | Valeur |
| --- | --- |
| Opérations par proposition | 200 |
| Suppressions par proposition | 1 (une série de flux d'une année, ou une relation) |
| Acteurs ajoutés par proposition | 10 |
| Montant mensuel d'un flux | de 0 à 10 000 000 € (le sens vient du type, jamais du signe) |
| Libellé, nom | 80 et 60 caractères, une ligne, sans caractère de contrôle ni de mise en forme bidirectionnelle |
| Lignes listées | 500 |

Aucun outil ne supprime un acteur ou une année ; un acteur verrouillé par l'utilisateur n'est jamais modifié ; le statut juridique d'une activité ne se change pas (c'est le rôle du comparateur). Les paramètres refusent les clés inconnues. Les messages d'erreur, en français, disent quoi corriger : identifiants connus, années disponibles, types de flux permis pour l'acteur, relation manquante.

### Isolement

Le module n'importe que Zod, les types et le moteur (`src/backend/logic`, règles comprises), avec des imports `.js` compilables par le process principal. Un test parcourt ses imports de proche en proche et échoue sur tout autre module, ou sur un appel au réseau, au disque, au processus ou à une évaluation de code. Les réglages par défaut du comparateur, qui vivaient dans `src/lib`, sont passés dans `src/backend/logic/options-du-comparateur.ts` pour que l'outil compare avec les mêmes réglages que l'écran.

### Ce que feront les étapes suivantes

- **Serveur MCP local (étape 2)**, finalement décidé autrement par l'[ADR 011](./011-serveur-mcp-local-et-boite-aux-propositions.md) : le serveur n'écrit jamais la session, il dépose la proposition dans une boîte que l'application montre à l'utilisateur. Prévision initiale : `tools/list` publie `catalogueDesOutils()` (`inputSchema`, `outputSchema`, `annotations.readOnlyHint` d'après `lecture`) ; `tools/call` lit la session sur le disque, appelle `executerOutil` et rend `resultat` en JSON. Pour `appliquer_proposition`, il écrit `nouvelleSession` avec la session précédente en copie, pour l'annulation, et l'application la recharge. Les clients d'IA de bureau demandent en général l'accord de l'utilisateur avant un outil qui n'est pas en lecture seule, mais le serveur n'en dépend pas : l'application montre le récapitulatif de ce qui a changé au rechargement.
- **Assistant intégré (étape 3)** : la page passe le catalogue au fournisseur choisi et exécute les outils localement sur la session affichée. Une proposition s'affiche avec son récapitulatif, son résumé, ses avertissements et son aperçu, et deux boutons ; « Appliquer » appelle `appliquer_proposition` et remplace la session par `nouvelleSession` comme toute modification : une seule étape de l'historique, qu'« Annuler » défait. Une proposition affichée devenue périmée (l'utilisateur a modifié la grille entre-temps) est refusée, et l'assistant le dit.

### Alternatives écartées

- **Des outils qui modifient directement la session** : plus simple pour le modèle, mais une instruction piégée dans une facture modifierait la simulation sans relecture.
- **Garder les propositions dans un état côté hôte** (le modèle ne passe qu'un numéro) : moins de texte échangé, mais le module ne serait plus pur et chaque hôte devrait gérer cet état. Comme la proposition est revalidée à l'application, la renvoyer ne donne aucun pouvoir de plus que de la proposer.
- **Un outil générique « modifier la session » prenant un JSON** : impossible à borner et à résumer pour l'utilisateur.
- **Publier le schéma complet des opérations dans chaque outil** : le catalogue passait de 30 à plus de 80 Ko, envoyés au modèle à chaque échange. Le paramètre `suiteDe` et la proposition d'`appliquer_proposition` ont un schéma public sommaire, et sont validés en entier à l'exécution.
- **Des noms d'outils en anglais** : plus habituels pour un modèle, mais le reste du code, les résultats et les descriptions sont en français ; un nom anglais au milieu de descriptions françaises serait une traduction de plus à tenir à jour.

## Conséquences

- **Positives :**
  - Une seule source pour le serveur MCP et l'assistant ; les schémas JSON sont générés depuis Zod et ne peuvent pas diverger de la validation.
  - Les chiffres donnés à l'utilisateur sont ceux de l'écran : les tests comparent chaque outil au moteur sur la simulation d'exemple et sur des montages types.
  - Une proposition se relit, se complète, s'applique en une étape et ne peut pas écraser une session qui a changé.
  - Le module se teste sans interface, sans réseau et sans modèle.
- **Négatives ou Compromis :**
  - Le modèle renvoie la proposition entière pour l'appliquer : jusqu'à 200 opérations de texte. Acceptable pour une année de relevés ; au-delà, il faut plusieurs propositions.
  - Une seule suppression par proposition : corriger une saisie erronée sur plusieurs années demande plusieurs validations, volontairement.
  - Les outils ne couvrent pas tout : frais réels, déplacements professionnels, suppression d'acteurs ou d'années restent dans l'application.
  - Les réglages par défaut du comparateur ont changé de dossier : `src/lib/comparateur-options.ts` les réexporte, les imports existants ne changent pas.

## Addendum (2026-10-06) : situation actuelle, proposition rafraîchie, catalogue allégé

### Contexte

Un essai avec un modèle jouant le client d'IA a montré trois manques. `optimiser_remuneration` donnait le meilleur point de la courbe, mais pas où se situe ce qui est saisi : le modèle ne pouvait pas dire « vous êtes à 2 400 € du meilleur net » sans recalculer, ce que la règle 1 interdit, et ses nets, frais de fonctionnement compris, ne se rapprochaient pas de ceux de `simuler`. Une proposition refusée comme périmée obligeait à tout reproposer, opération par opération. Enfin, le catalogue publié pesait 55 Ko, envoyés au modèle à chaque échange, dont un tiers de schémas de sortie qu'aucun client ne donne au modèle.

### Décision

1. **`optimiser_remuneration` situe la grille actuelle.** `arbitrageDeLAnnee` (`simulation-pluriannuelle.ts`) prépare l'année une fois, ajuste la CFE des frais de fonctionnement avec la fonction du comparateur (`avecLaCFEDeLAnnee`, partagée avec `optimiserRemunerationDeLAnnee`), puis rend l'arbitrage et, en une simulation de plus, `situationActuelle` (`comparateur.ts`) : l'activité dans son statut actuel, avec la rémunération et les dividendes de la grille et les frais de ce statut, comme la colonne « actuel » du comparateur au partage « grille ». L'outil y ajoute `ecartAuMeilleur` et `ecartAuMeilleurAvecRetraite` (net du point moins net actuel), les frais retenus pour le statut étudié (`fraisFonctionnement`) et la note de la CFE (`noteCFE`). Une activité d'un autre statut (EI, micro-entreprise) a une situation actuelle sans rémunération ni dividendes (`null`).
2. **`rafraichir_proposition`**, seizième outil. Il prend une proposition périmée, revérifie ses opérations une à une sur la session actuelle (`operationsApplicables`, `operations.ts` : chacune est essayée sur la session laissée par les précédentes retenues, si bien qu'une opération qui dépend d'une opération refusée l'est aussi), puis reconstruit la proposition avec celles qui s'appliquent encore (`construireProposition` : nouvelle empreinte, résumé, avertissements, aperçu, tout revérifié). Les opérations retirées sont rendues dans `retirees` (numéro, désignation, raison) et rappelées dans le premier avertissement ; si aucune ne s'applique, l'outil échoue en les listant. Il ne modifie ni n'envoie rien. Le refus d'une proposition périmée, `appliquer_proposition` et les consignes du serveur y renvoient.
3. **Un catalogue sans schémas de sortie.** `catalogueDesOutils()` ne rend plus `outputSchema` : le modèle lit les champs dans le JSON du résultat, et les descriptions nomment ceux qui demandent une explication. Le schéma Zod du résultat reste dans chaque outil, pour les tests. Les descriptions et les schémas des paramètres sont resserrés sans retirer de règle (rappel de validation commun plus court, `suiteDe` et la proposition renvoyée décrits en une phrase, frais de fonctionnement en enregistrements par statut et par poste plutôt que quatre objets identiques). Des tests bornent la taille du catalogue (31 Ko) et de la liste publiée par le serveur MCP (33 Ko).

### Conséquences

- **Positives :** le modèle dit l'écart entre la grille et le meilleur net avec les chiffres du moteur, et explique la différence avec `simuler` par les frais affichés ; une proposition périmée se rafraîchit en un appel, et l'utilisateur voit ce qui n'a pas pu être repris ; le catalogue est presque deux fois plus léger, un outil de plus compris.
- **Négatives ou Compromis :** un client qui validerait les résultats avec un schéma de sortie ne le peut plus ; `optimiser_remuneration` fait une simulation de plus ; une proposition rafraîchie peut perdre des opérations dont d'autres dépendaient sans que le moteur le détecte (une suppression d'estimation retirée, des factures gardées) : l'avertissement des séries existantes le signale, et l'utilisateur relit la proposition avant de l'appliquer.
