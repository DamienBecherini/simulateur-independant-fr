# ADR-008: Une session sur plusieurs années

- **Date :** 2026-10-05
- **Statut :** Accepté

## Contexte

Jusqu'ici, une session (`SessionState`, `src/types.ts`) décrit une seule année : des acteurs (`entities`), des relations (`relationships`) et une grille de douze mois (`monthlyData`). Le moteur l'évalue avec les règles d'une seule année (`config.json`, 2026).

La phase 13 (« Plusieurs années ») doit enchaîner des années consécutives :

- chaque année se simule avec ses propres règles (ADR 007 : l'année N d'un fichier de règles est celle de l'activité et des revenus) ;
- le versement libératoire de l'année N dépend du revenu fiscal de référence de N-2, que le simulateur peut calculer si N-2 est dans la session ;
- plus tard : bénéfice mis en réserve puis distribué, ACRE la première année, exonération de CFE l'année de création.

Il faut donc un modèle de données qui porte plusieurs grilles, un nouveau format de fichier, et une migration des sessions existantes (format 2), des sauvegardes et des exports.

Trois questions se posent :

1. **Qu'est-ce qui change d'une année à l'autre ?** Les flux, sûrement. Les acteurs et les relations parfois (création d'une société, mariage, naissance), mais la plupart des simulations gardent la même structure sur quelques années.
2. **Comment repérer une année ?** Par son numéro (2025), qui choisit les règles, ou par sa position (« année 1 »).
3. **Où garder l'année affichée ?** Dans la session (et donc le fichier et l'historique d'annulation) ou dans l'interface seulement.

## Décision

**Une liste d'années, chacune avec sa grille ; acteurs et relations communs à toutes les années.**

```ts
SessionState = {
  name: string
  entities: Entity[]           // communs à toutes les années
  relationships: Relationship[] // communes à toutes les années
  annees: { annee: number; monthlyData: MonthlyGridData }[]
}
```

1. **Années repérées par leur numéro.** `annee` est l'année civile simulée : elle choisit le fichier de règles (ADR 007) et se lit telle quelle dans l'interface, les exports et les fichiers. La liste est triée de la plus ancienne à la plus récente, sans doublon (le nettoyage des données trie et écarte les doublons), et contient au moins une année.
2. **Années consécutives.** L'interface n'ajoute une année qu'avant la plus ancienne ou après la plus récente, et ne supprime que l'une des deux extrémités. Le schéma n'impose pas la continuité (un fichier modifié à la main peut avoir un trou) : le moteur n'en a pas besoin, il cherche simplement l'année N-2 dans la session. *Remplacé par l'addendum ci-dessous : un fichier aux années non consécutives est désormais refusé.*
3. **Acteurs et relations communs, à ce stade.** Une société créée en cours de période, un mariage ou une naissance s'appliquent à toutes les années de la session. Des acteurs ou des relations propres à une année sont reportés à plus tard (voir Conséquences).
4. **Année affichée hors de la session.** L'année que l'utilisateur consulte et modifie est un état de l'interface (`App.tsx`), ni enregistré ni annulable : changer d'année n'est pas une modification de la simulation. Par défaut, c'est la plus récente ; si elle disparaît (suppression, annulation), l'interface revient à la plus récente.
5. **Une année vue comme une simulation d'un an.** Le moteur, le comparateur, l'optimiseur et les exports CSV et Markdown travaillent sur une seule année : `DonneesDeLAnnee` (acteurs, relations, grille de l'année) et `SimulationAnnuelle` (avec le nom de la session et le numéro de l'année), construites par `src/backend/logic/annees.ts`. Leur code change peu : il reçoit la même forme qu'avant.
6. **Format de fichier 3.** Le numéro de format passe à 3. La migration 2 → 3 place la grille existante dans l'année 2026, la seule dont le simulateur connaissait les règles, garde l'original à côté et prévient l'utilisateur. Un fichier au format 1 est converti en chaîne (1 → 2 → 3).

### Alternatives écartées

- **Une session par année, reliées entre elles** (une sauvegarde « 2025 » et une sauvegarde « 2026 ») : chaque fichier reste simple, mais le revenu fiscal de référence et, plus tard, le bénéfice mis en réserve exigent de retrouver les autres années ; les acteurs seraient dupliqués et divergeraient à la première modification.
- **Acteurs et relations par année dès maintenant** (`annees: { annee, entities, relationships, monthlyData }[]`) : le modèle le plus général, mais chaque modification d'un acteur devrait être reportée sur toutes les années, les identifiants partagés entre années (le foyer de N-2 doit être celui de N) deviennent une contrainte à vérifier, et l'interface doit dire sur quelles années porte une modification. C'est une étape à part entière, qu'un modèle commun n'empêche pas : il suffira d'ajouter des exceptions par année.
- **Une grille de 12 × n mois** : la notion d'année (et donc de règles) disparaîtrait de la grille, et toutes les fonctions mensuelles (recopie de flux, totaux annuels, exports) devraient découper la grille elles-mêmes.
- **Années repérées par leur position** (« année 1, année 2 ») : utile pour des projections sans date, mais les règles, le revenu fiscal de référence de N-2 et les dispositifs datés (ACRE de juillet 2026) ont besoin de l'année civile.
- **Année affichée dans la session** : elle serait enregistrée et ferait une étape d'annulation à chaque changement d'onglet, sans rien changer aux résultats.

## Conséquences

- **Positives :**
  - Chaque année a ses règles, ses résultats et son revenu fiscal de référence ; le versement libératoire de N peut vérifier celui de N-2 sans saisie quand N-2 est simulé.
  - Le moteur, le comparateur, l'optimiseur et les exports d'une année gardent leur forme : ils reçoivent une année comme avant ils recevaient la session.
  - Les sessions, sauvegardes et exports existants restent lisibles : ils deviennent des sessions d'une seule année, 2026.
- **Négatives ou Compromis :**
  - Les acteurs et les relations ne changent pas d'une année à l'autre : une création de société, un mariage ou une naissance en cours de période ne se représentent pas encore. Supprimer un acteur supprime ses flux de toutes les années.
  - Ajouter une année recopie (ou non) la grille voisine : les copies sont indépendantes, comme les flux recopiés d'un mois à l'autre ; les flux définis une fois pour plusieurs années restent à faire (phase 13, point 5).
  - Le comparateur et l'optimiseur travaillent sur l'année affichée seulement : pas encore d'arbitrage entre les années (dividendes versés plus tard, bénéfice mis en réserve). Depuis l'ADR 014, les réserves des sociétés passent d'une année à l'autre, et le comparateur compare des stratégies de distribution sur toutes les années.
  - Les fichiers au format 3 ne se relisent pas correctement dans une version précédente du simulateur : elle préviendrait que le fichier vient d'une version plus récente, puis l'ouvrirait avec ses acteurs et ses relations, mais sans aucun flux.

## Addendum (2026-10-05) : dix années consécutives au plus

### Contexte

Rien ne bornait le nombre d'années d'une session, et un fichier modifié à la main pouvait sauter des années sans que personne ne le dise. Or les règles ne sont connues que jusqu'à la dernière année publiée (2026) : au-delà, une année est simulée avec ces règles-là (ADR 007), barèmes, plafonds et taux figés. Deux ou trois ans plus loin, les chiffres ne sont plus qu'une projection. Une longue liste d'années rend aussi le sélecteur, la synthèse et les cases « Aussi en » de la fenêtre des flux difficiles à lire, surtout sur téléphone.

### Décision

1. **Dix années au plus** (`NOMBRE_MAX_ANNEES`, `src/backend/logic/annees.ts`, une seule constante). Dix années couvrent largement un projet de création, de transmission ou de départ à la retraite. Une fois la limite atteinte, « Ajouter une année » est désactivé et une phrase visible, associée au bouton (`aria-describedby`), dit pourquoi et comment en ajouter une autre (supprimer une extrémité). `ajouterAnnee` renvoie la session telle quelle au-delà de la limite.
2. **Années consécutives, garanties aussi à la lecture.** Le nettoyage (`data-sanitizer.ts`) trie les années et écarte les doublons comme avant, puis refuse la session si elle compte plus de dix années ou s'il manque une année entre la plus ancienne et la plus récente (`erreurDesAnnees`). Le message dit ce qui ne va pas : le nombre d'années et leur étendue, ou les années manquantes (leur nombre au-delà de cinq).
3. **Refuser plutôt que corriger.** Garder les dix premières années, ou combler un trou par des grilles vides, ferait perdre ou inventer des années sans que l'utilisateur le voie. Le fichier n'est pas corrompu : il est refusé avec le motif, et l'utilisateur le corrige lui-même.
   - Import d'une simulation (application de bureau et démo web) : « Import impossible » et le motif ; la simulation en cours n'est pas remplacée.
   - Session ou sauvegardes relues au démarrage de l'application de bureau : une copie du fichier est gardée à côté (`*.refuse-AAAAMMJJ-HHMMSS.json`, voir l'ADR 005) avant qu'il ne soit réécrit, et une fenêtre nomme ce qui a été refusé.
   - Import de sauvegardes groupées : chaque sauvegarde refusée est nommée dans le bilan, avec son motif ; les autres sont importées.
4. **Une année en double est signalée même vide.** Jusqu'ici, seuls ses flux étaient comptés parmi les flux supprimés : une année en double sans flux disparaissait sans un mot. Le rapport de nettoyage liste désormais les années écartées (`anneesEcartees`), et l'import demande confirmation comme pour toute autre correction.

### Conséquences

- **Positives :** la session reste lisible (sélecteur, synthèse, cases à cocher) ; un fichier aux années incohérentes ne s'ouvre plus en silence ; le moteur peut compter sur des années consécutives.
- **Négatives ou Compromis :** une simulation sur plus de dix ans demande plusieurs sessions ; un fichier modifié à la main avec un trou doit être corrigé avant de s'ouvrir.
- Dans la fenêtre des flux, au-delà de quatre autres années, des raccourcis cochent toutes les années, aucune, les précédentes ou les suivantes : dix années restent rapides à cocher.
