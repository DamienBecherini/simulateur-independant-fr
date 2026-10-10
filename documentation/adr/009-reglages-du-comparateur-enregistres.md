# ADR-009: Réglages du comparateur enregistrés avec la session

- **Date :** 2026-10-05
- **Statut :** Accepté

## Contexte

Les réglages du comparateur de statuts (activité comparée, partage du bénéfice des sociétés, rémunération saisie, part BNC des prestations, frais de fonctionnement par statut, statut étudié dans « Rémunération ou dividendes ? ») ne vivaient que dans l'état React du panneau. Ils étaient perdus au rechargement, au chargement d'une sauvegarde, absents des sauvegardes et des exports, et le rapport Markdown comparait toujours avec les réglages proposés par défaut, quels que soient ceux choisis à l'écran.

Quatre questions se posent :

1. **Où les ranger, et faut-il changer le numéro de format des fichiers ?**
2. **Que garder d'une année à l'autre ?** Depuis l'ADR 008, le comparateur porte sur l'année affichée, et ses réglages proposés par défaut se lisent dans la grille de cette année (rémunération et dividendes saisis).
3. **Font-ils partie de l'historique d'annulation ?**
4. **Que faire de réglages invalides ou qui ne désignent plus rien** (activité supprimée, année retirée) ?

## Décision

**Un champ facultatif `comparateur` dans la session, qui ne retient que les choix de l'utilisateur, activité par activité.**

```ts
SessionState = {
  // … nom, acteurs, relations, années (ADR 008)
  comparateur?: {
    activiteComparee?: string
    reglagesParActivite: Record<string, {   // par identifiant d'activité
      repartition?: { mode; partDistribuee; avecRetraite? }
      remunerationParAnnee?: Record<"2026", number>
      partBncPrestations?: number
      fraisFonctionnement?: Record<statut, Record<poste, number>>
      statutEtudie?: "SASU" | "EURL"
    }>
  }
}
```

1. **Pas de nouveau format de fichier.** Le champ est facultatif : un fichier qui ne l'a pas se lit tel quel, sans conversion ni point à vérifier, et la session relue n'en reçoit pas. Une version précédente du simulateur ignore le champ (Zod écarte les clés inconnues) et ouvre le reste du fichier. Le numéro de format reste 3.
2. **Seuls les réglages changés sont enregistrés.** Un réglage jamais touché reste absent et suit les valeurs proposées par défaut, tirées de la grille de l'année affichée : sans dividendes saisis, chaque statut de société au meilleur net ; avec des dividendes saisis, les montants de la grille. Le comportement d'ouverture du comparateur ne change donc pas tant que l'utilisateur ne règle rien. Au meilleur net, « avec 4 trimestres de retraite » est cochée par défaut : seule la case décochée est un choix enregistré (`avecRetraite: false`), et des réglages enregistrés avant ce défaut, sans la case, le reçoivent. En changeant de mode, la case ne suit que décochée.
3. **D'une année à l'autre.** Le mode de partage (avec la part distribuée et « avec 4 trimestres de retraite »), la part BNC, les frais de fonctionnement et le statut étudié sont des choix de structure : ils valent pour toutes les années. La rémunération saisie, elle, est un montant annuel comme ceux de la grille : elle est retenue pour son année (`remunerationParAnnee`). Une autre année repart de sa grille, et retrouve sa propre rémunération si l'utilisateur en a saisi une. Dans les modes qui lisent la grille (« Dividendes saisis dans la grille »), la grille de l'année fait foi.
4. **Réglages propres à chaque activité.** Chaque activité garde ses frais et son partage : changer d'activité comparée ne recopie plus les frais de l'une sur l'autre, la CFE ou l'expert-comptable de deux activités n'ayant pas de raison d'être les mêmes.
5. **Hors de l'historique d'annulation.** Modifier un réglage remplace la session affichée sans créer d'étape ; annuler ou rétablir une modification de la simulation garde les réglages actuels. Un champ de frais saisi chiffre par chiffre ferait sinon une étape par touche, et ces réglages ne changent pas la simulation elle-même, comme l'année affichée (ADR 008). Ils sont enregistrés comme le reste : sauvegarde automatique, sauvegardes nommées, export et import d'une simulation ou de toutes les sauvegardes.
6. **Nettoyage.** Avant la validation Zod, chaque réglage invalide (hors limites, mal formé) est écarté un par un et compté (`reglagesRemoved`), comme les entités, relations et flux invalides (ADR 005) : un réglage abîmé ne fait perdre ni les autres, ni la session. Après la validation, les réglages d'une activité ou d'une année absentes de la session, et l'activité comparée disparue, sont retirés **sans être signalés** : l'usage normal en laisse (une activité supprimée, que l'annulation peut encore rétablir), ce n'est pas une corruption.
7. **Exports.** Le rapport Markdown compare l'activité choisie avec ses réglages enregistrés, comme le comparateur l'affiche ; le CSV du comparateur et le PDF reprenaient déjà l'écran.

### Alternatives écartées

- **Les réglages dans les préférences de l'utilisateur** (`userPreferences.json`) : ils ne suivraient ni les sauvegardes nommées ni les exports, alors qu'ils dépendent des activités de chaque simulation.
- **Enregistrer toutes les options affichées**, choisies ou non : à la première modification, le mode et la rémunération proposés par la grille seraient figés, et changer de dividendes dans la grille n'aurait plus d'effet sur le comparateur.
- **Une rémunération saisie valable pour toutes les années** : elle masquerait la rémunération propre à chaque grille, que le comparateur reprenait jusqu'ici en changeant d'année.
- **Une étape d'annulation par réglage, ou différée** : différer complique l'historique pour des choix qui ne modifient pas la simulation ; annuler un ajout d'acteur ne doit pas défaire un réglage fait depuis.
- **Un nouveau numéro de format** : rien à convertir, et un fichier au format 4 serait refusé à tort par les versions précédentes comme venant d'une version plus récente.

## Conséquences

- **Positives :**
  - Les réglages survivent au rechargement, au lancement suivant, aux sauvegardes, aux exports et aux imports ; le rapport Markdown décrit la comparaison que l'utilisateur voit.
  - Les fichiers existants se lisent sans changement ni message.
  - Une suite « rien ne se perd » fait passer une session qui remplit chaque champ du schéma par chaque enregistrement et chaque relecture ; un garde-fou parcourt les schémas Zod et échoue si un champ, une variante ou une valeur n'y est pas rempli, pour qu'un champ ajouté plus tard ne soit pas oublié.
- **Négatives ou Compromis :**
  - Annuler ne défait pas un réglage du comparateur : il faut le remettre à la main.
  - Des réglages d'activités supprimées restent dans la session tant qu'elle n'est pas relue (ils sont retirés au chargement suivant) : quelques octets, sans effet sur les calculs.
  - Un réglage changé puis remis à sa valeur proposée reste enregistré : il ne suit plus la grille.

## Addendum (2026-10-10) : les frais de fonctionnement ne servent plus qu'à l'écart entre statuts

### Contexte

Le comparateur ajoutait à chaque colonne, celle du statut actuel comprise, les frais de fonctionnement réglés pour son statut. Le net de la colonne actuelle différait donc de celui des résultats (39 597 € dans les résultats, 38 747 € dans le comparateur pour le même montage, constat P-04 du [parcours utilisateur d'octobre 2026](../parcours-utilisateur-2026-10.md)) : l'utilisateur ne savait plus quel était son vrai net. Et en SASU ou en EURL, hors partage « Selon la grille », la colonne « actuel » n'était pas la situation saisie.

### Décision

1. **Les frais réels sont ceux de la grille.** La colonne du statut actuel est la situation saisie, telle quelle : le rapport de l'année lui-même (`colonneTelleQueSaisie`, `comparateur.ts`), sans aucun frais supposé. Son net est, par construction, le « Net du foyer » des résultats (`ScenarioStatut.telleQueSaisie`).
2. **Les autres colonnes reçoivent l'écart.** Frais supposés de leur statut moins ceux du statut actuel, poste par poste (`ecartDeFrais`, `frais-de-fonctionnement.ts`), positif ou négatif, en charge déductible au réel et en simple dépense en micro ; la CFE de l'année (création, année suivante) entre dans les deux termes. L'écart est rendu par colonne (`ScenarioStatut.ecartDeFrais` : total et postes) et écrit sous son net, le détail des postes à déplier.
3. **Société hors partage « grille ».** La colonne du statut actuel suit le partage choisi : son titre le dit (« SASU, rémunération optimisée », « …, rémunération choisie », « …, tout en rémunération », « …, répartition sur mesure ») et elle n'est plus marquée « actuel ». `ComparaisonResult.situationSaisie` garde le net de la situation saisie : c'est la référence des écarts, du verdict et de la barre de résumé, rappelée au-dessus du tableau.
4. **Sans chiffre d'affaires**, aucun statut n'est désigné (`meilleur: null`, `sansChiffreDAffaires`) ; un message invite à en saisir un (constat P-13).
5. Les réglages enregistrés ne changent pas : mêmes postes, même schéma, même format de fichier. Seul leur usage change : ils estiment l'écart entre statuts.

### Conséquences

- Un seul net pour la situation saisie, partout : résultats, barre de résumé, comparateur, exports, outils pour les IA, arbitrage rémunération / dividendes.
- Les nets des autres colonnes changent : chacune gagne à peu près les frais supposés du statut actuel (850 € pour une micro-entreprise avec les frais par défaut). Les frais communs à tous les statuts ne jouent plus.
- Des frais supposés du statut actuel plus élevés que ceux réellement saisis dans la grille avantagent les autres statuts d'autant : la page rappelle de saisir ses frais réels (CFE, assurance, banque) dans la grille.
