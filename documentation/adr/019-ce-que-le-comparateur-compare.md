# ADR-019: Ce que le comparateur compare : pertes, rémunérations hors de portée, portage à découvert

- **Date :** 2026-11-20
- **Statut :** Accepté (2026-11-20)

## Contexte

Le comparateur désignait le statut au meilleur « net dans la poche » du foyer. Pendant la recette de la version suivante, trois cas ont montré que ce net, seul, peut tromper.

1. **Une rémunération que la société n'a pas.** Avec 80 000 000 € de rémunération choisie pour une société qui en gagne 60 000, la colonne affichait 42 millions de net, et pouvait être désignée meilleur statut. Le calcul était juste, la situation impossible.
2. **Une année de perte.** Avec 10 000 € de chiffre d'affaires et 30 000 € de charges, la SASU et l'EURL affichaient 0 € de net, l'entreprise individuelle −21 500 € : les sociétés étaient désignées, alors que la perte est la même. Elle reste dans la société, où le net du foyer ne la montre pas.
3. **Le portage salarial dans le même cas.** La colonne affichait 0 € de net avec un compte d'activité à −20 700 €. Une société de portage vit de ses frais de gestion : elle ne fait pas crédit.

## Décisions du propriétaire (2026-11-20)

1. **Une société ne verse pas ce qu'elle ne gagne pas : il faut une limite.** « Sinon le comparatif ne veut plus rien dire. »
2. **Les colonnes se comparent sur le net et ce qui reste dans la société**, et cela se voit au moins dans le calcul détaillé.
3. **Une activité en portage dont les frais dépassent le chiffre d'affaires n'est pas retenue.**
4. **Dans la grille, une rémunération supérieure à ce que la société gagne doit être dite plus clairement, avec la limite.**

## Décision

### Rémunération choisie dans les réglages : plafonnée

Dans les partages « Ma rémunération » et « Sur mesure », la rémunération vient des réglages du comparateur. Au-delà de ce que la société peut verser sans déficit, chaque colonne SASU ou EURL retient ce maximum, calculé pour son statut (`simulerLaSociete`, `remunerationPlafonnee`). La colonne le dit dans son en-tête (« rémunération limitée à… »), dans une note, et les réglages sous le champ. Le champ garde la saisie.

Le maximum est celui du curseur et de l'arbitrage : la plus haute rémunération qui laisse un bénéfice positif ou nul **sur l'année**, à 100 € près (`remunerationMaximale`). Les réserves des années précédentes ne comptent pas.

### Rémunération de la grille : reprise telle quelle, dite, et non désignée

Les montants de la grille sont ceux de l'utilisateur : ni le moteur ni le comparateur ne les réécrivent.

- **Dans les résultats**, une alerte vient en tête de celles de la société : « Rémunération du dirigeant supérieure à ce que la société gagne : 200 000 € nets saisis, pour 34 600 € au plus sans déficit cette année. » Si l'activité est déjà déficitaire sans rémunération, elle dit qu'aucune n'est possible (`alerteDeRemuneration`, `simulation-au-reel.ts`).
- **Dans le comparateur**, partage « Selon la grille », la colonne d'une société qui verse une rémunération alors qu'elle est déficitaire n'est jamais désignée meilleur statut (`remunerationNonCouverte` ; « non retenue : rémunération supérieure au bénéfice »).

Une société déficitaire qui ne verse rien reste retenue : une année de perte n'a rien d'impossible.

### Comparaison : le net, moins la perte restée dans la société

`src/backend/logic/net-compare.ts` définit ce sur quoi les colonnes se comparent : le net du foyer, moins la perte de l'année restée dans l'activité comparée (`perteConservee` : la perte d'une société, ou le découvert du compte d'une activité en portage). `netCompare` sert à désigner le meilleur statut, à mesurer les écarts avec la situation saisie, à trier les cartes sur téléphone, et au verdict.

Ce que l'utilisateur voit :

- sous le net d'une colonne en perte : « et 20 000 € de perte restée dans la société » ;
- dans le détail du tableau, la ligne « Net, perte restée dans l'activité déduite », quand une perte est déduite quelque part ;
- au-dessus du tableau et dans le verdict, la même mention pour la situation saisie ;
- dans les exports et les outils pour les IA, la perte et le net comparé.

Sans perte, rien ne change : le net comparé est le net du foyer.

**Seule la perte est déduite. Un bénéfice gardé dans la société n'est pas ajouté au net.** La décision 2 disait « le net et ce qui reste » ; elle a été prise à propos de l'année de perte. Pour un bénéfice gardé, l'ajouter tel quel aurait deux défauts : il n'est pas encore dans la poche du foyer (le distribuer coûte l'impôt des dividendes, ou des cotisations en EURL), et « tout garder dans la société » gagnerait alors toujours. Le compter demanderait de le valoriser après cet impôt. C'est laissé ouvert (voir « À décider »).

Les dividendes pris sur les réserves des années précédentes font baisser ce qui reste dans la société sans être une perte : `perteDeLaSociete` se calcule sur le résultat de l'année avant dividendes.

### Portage salarial à découvert : non retenu

Quand les frais de gestion et les frais professionnels dépassent le chiffre d'affaires, la colonne du portage n'est pas retenue (`portageNonRetenu: "aDecouvert"` ; « non retenue : frais supérieurs au chiffre d'affaires »), et sa note dit pourquoi.

## Conséquences

- **Positives**
  - Une rémunération impossible ne produit plus un net impossible.
  - Une société ne passe plus devant l'entreprise individuelle parce que sa perte ne se voit pas dans le net du foyer.
  - L'alerte de la grille donne la limite, au lieu de constater seulement le déficit.
- **Négatives ou à surveiller**
  - Quand la situation saisie laisse une forte perte dans la société, les écarts des autres colonnes paraissent très grands : ils se mesurent à son net une fois cette perte déduite. La phrase au-dessus du tableau et la ligne du détail le disent.
  - La mention « meilleur net » reste le nom de la colonne désignée, y compris quand une perte a été déduite pour la désigner.
  - Le plafond d'une rémunération choisie ajoute, dans ce seul cas, une recherche par dichotomie (une trentaine de simulations de la colonne).

## Non modélisé

- La trésorerie de la société : la limite est un bénéfice positif ou nul sur l'année, pas un solde de banque.
- Le report du déficit d'une société sur ses bénéfices futurs, qui en réduit le coût réel : la perte est déduite pour sa valeur.
- L'imputation du déficit d'une entreprise individuelle sur les autres revenus du foyer est calculée par le moteur ; son report sur les années suivantes ne l'est pas.

## À décider

- Faut-il compter, dans la comparaison, un bénéfice gardé dans la société ? Si oui, valorisé après l'impôt de sa distribution.
- Faut-il compter les réserves des années précédentes dans ce qu'une société peut verser à son dirigeant ?
