# Moins d'informations à l'écran (phase 13 ter)

Étude préalable à la refonte de l'affichage : inventaire de ce que montre l'écran, parcours types mesurés, trois propositions comparées, et plan de mise en œuvre de celle retenue. Aucun code n'est modifié à ce stade.

## Mesures de départ

Démo web, simulation d'exemple (« Famille Martin, simulation 2026 » : Camille en micro-entreprise avec versement libératoire, Julien président de « Conseil SASU », Léa à charge), thème clair, au chargement de la page.

| | Ordinateur 1 440 × 900 | Téléphone 375 × 812 |
| --- | --- | --- |
| Hauteur de la page | **5 830 px** (6,5 écrans) | **9 033 px** (11,1 écrans) |
| Hauteur, toutes sections repliables ouvertes | 6 907 px | 10 184 px |
| Début des acteurs | 306 px (0,3 écran) | 434 px (0,5) |
| Début de la grille | 1 353 px (1,5) | 2 609 px (3,2) |
| Net dans la poche (bilan) | 2 340 px (2,6) | 3 961 px (4,9) |
| Début du comparateur | 3 576 px (4,0) | 5 953 px (7,3) |
| Tableau de comparaison | 4 498 px (5,0) | 7 273 px (9,0), 768 px de large |
| « Rémunération ou dividendes ? » | 5 010 px (5,6) | 7 861 px (9,7) |

Hauteur des blocs à 1 440 px : en-tête et bandeau 306 px, acteurs 1 047 px, grille 679 px, légende 215 px, résultats 1 329 px, comparateur 2 129 px (dont réglages 422 px, partage du bénéfice 501 px, tableau 512 px, optimiseur 695 px).

**Méthode des parcours.** Un clic est une activation à la souris, au doigt ou au clavier ; la frappe d'un montant ou d'un libellé n'est pas comptée. Le défilement est la distance entre le haut de la page et le haut de l'élément cherché, moins la barre d'outils (80 px), en hauteurs d'écran : « 4,9 / 8,9 » se lit 4,9 écrans sur ordinateur, 8,9 sur téléphone. Les valeurs actuelles sont mesurées ; celles des propositions sont estimées d'après les maquettes.

## Inventaire

Classement : **essentielle** (répond à la question de presque toutes les visites), **fréquente** (utile à chaque séance de travail), **occasionnelle** (une fois par simulation ou moins), **experte** (pour qui veut vérifier le calcul).

Propositions : garder visible, replier (section dépliable), au survol (ou au focus, jamais seul porteur d'une information), panneau contextuel (à la sélection d'un acteur), vue dédiée, déplacer, supprimer.

### Barre d'outils et en-tête

| Bloc ou commande | Où | Répond à | Classe | Doublons | Proposition |
| --- | --- | --- | --- | --- | --- |
| Paramètres (nom, sauvegardes, import, réinitialisation) | Barre d'outils | Gérer mes simulations | occasionnelle | — | Garder visible |
| Annuler, Rétablir | Barre d'outils | Revenir sur une saisie | fréquente | Ctrl+Z, Ctrl+Y | Garder visible |
| Exporter (JSON, PDF, CSV, Markdown) | Barre d'outils | Transmettre les chiffres | occasionnelle | Boutons CSV du comparateur et de la courbe | Garder ; y regrouper les exports CSV du comparateur et de la courbe |
| Zoom arrière, zoom avant | Barre d'outils | Agrandir le texte | experte | Zoom du navigateur, Ctrl+plus et Ctrl+moins | Déplacer dans les paramètres (raccourcis gardés) |
| Thème clair / sombre | Barre d'outils | Confort | occasionnelle | Préférence du système | Garder (petit) ou déplacer dans les paramètres |
| Lien « Aller au contenu » | Invisible sans focus | Accessibilité | — | — | Garder |
| Titre (nom de la simulation) | En-tête | Quelle simulation ? | fréquente | Paramètres | Garder, en une ligne dans la barre de résumé |
| Sous-titre « Votre bac à sable… » | En-tête | — | — | — | Supprimer à l'écran |
| Bandeau de la démo web | En-tête | C'est une démo, réinitialiser | occasionnelle | Pied de page | Une ligne, refermable |

### Acteurs

| Bloc ou commande | Où | Répond à | Classe | Doublons | Proposition |
| --- | --- | --- | --- | --- | --- |
| Ajouter une personne, ajouter une activité | Haut du bloc | Mettre en place | occasionnelle | — | Garder, plus petits |
| Poignée de tri | Chaque carte | Ordonner | experte | Tri au clavier | Garder (discrète, visible au focus) |
| Avatar, nom modifiable sur place | Chaque carte | Qui ? | essentielle | Grille (première colonne) | Garder |
| Type (« Personne physique », « Activité - SASU ») | Sous le nom | Quel statut ? | essentielle | Fenêtre « Modifier » | Garder, en pastille |
| Parts propres | Personnes | Quotient familial | occasionnelle | Fenêtre « Modifier » | Panneau contextuel ou fenêtre « Modifier » |
| ACRE, versement libératoire | Micro-entreprises | Options de la micro | fréquente | Fenêtre « Modifier » | Pastille d'état, bascule dans le panneau contextuel |
| Modifier les autres réglages (crayon) | Chaque carte | Statut, couleur, icône, RFR, capital, frais réels | occasionnelle | — | Garder (menu de l'acteur) |
| Verrouiller | Chaque carte | Éviter une suppression | experte | — | Menu « ⋯ » |
| Supprimer | Chaque carte | Retirer | occasionnelle | — | Menu « ⋯ » |
| Relations (pastilles), retirer une relation | Bas de chaque carte | Qui est lié à qui ? | fréquente | Fenêtre « Modifier » (relations) ; chaque relation apparaît sur les deux acteurs | Garder en pastilles sur une ligne ; retrait dans le panneau ou au survol / focus (toujours visible au toucher) |
| + Relation | Bas de chaque carte | Lier deux acteurs | occasionnelle | Fenêtre « Modifier » | Garder (lien discret) |
| Frais réels, trajets, déplacements | Fenêtre « Modifier » | Frais déductibles | experte | — | Inchangé (déjà dans une fenêtre) |

### Grille et légende

| Bloc ou commande | Où | Répond à | Classe | Doublons | Proposition |
| --- | --- | --- | --- | --- | --- |
| Titre « Grille de Saisie Annuelle » | Grille | — | — | — | Raccourcir (« Grille 2026 ») |
| Sélecteur d'année | En-tête de la grille | Quelle année ? | fréquente | Barre de résumé (proposée) | Garder, et le reprendre dans le résumé |
| Ajouter une année | En-tête de la grille | Prévoir la suite | occasionnelle | — | Garder (lien) |
| Supprimer l'année | En-tête de la grille | — | occasionnelle | — | Menu de l'année |
| Colonne « Total annuel » | Grille | Combien sur l'année ? | fréquente | Cartes « Par activité » (chiffre d'affaires) | Garder |
| Cases des mois (barres, montants, numéros de type) | Grille | Quels flux, quand ? | essentielle | — | Garder |
| « + Ajouter » des cases vides | Grille (36 cases dans l'exemple) | Où cliquer ? | fréquente | Le libellé accessible de la case | Au survol / focus sur ordinateur ; visible au toucher |
| Lignes des personnes sans flux | Grille | — | occasionnelle | — | Regrouper en une ligne « Ajouter un flux à… » |
| Fenêtre d'un mois : texte d'aide | Fenêtre modale | Comment saisir ? | occasionnelle | — | Replier (« Aide ») |
| Fenêtre d'un mois : « Appliquer à », « Aussi en » | Fenêtre modale | Récurrence | fréquente | — | Garder |
| Fenêtre d'un mois : effet de la saisie | absent | Qu'est-ce que ça change ? | essentielle | — | **Ajouter** le net du foyer avant / après en pied de fenêtre |
| Légende des flux (gains, dépenses, numéros, couleurs) | Sous la grille | Que signifie ce numéro ? | occasionnelle | Infobulles des segments | Replier, ou au survol d'une barre |
| Gérer les couleurs | Légende | Personnaliser | experte | — | Déplacer dans les paramètres |

### Résultats du foyer et synthèse des années

| Bloc ou commande | Où | Répond à | Classe | Doublons | Proposition |
| --- | --- | --- | --- | --- | --- |
| Titre et « Recalculés à chaque modification… estimations simplifiées » | Haut des résultats | Que valent ces chiffres ? | occasionnelle | Pied de page (avertissement) | Une ligne courte |
| Avertissements de l'année (règles reprises d'une autre année) | Haut des résultats | Puis-je me fier aux chiffres ? | essentielle quand présents | — | Garder, et un compteur d'alertes dans le résumé |
| Net dans la poche et part des revenus | Bilan | Combien me reste-t-il ? | essentielle | Carte du foyer (« Net après impôts » avec un seul foyer), colonne « actuel » du comparateur (68 725 € au lieu de 69 575 €, frais de fonctionnement supposés compris) | Garder, et dans le résumé collant |
| Taux global de prélèvement | Bilan | Combien part en prélèvements ? | essentielle | Ligne du comparateur | Garder, et dans le résumé |
| Barre de répartition | Bilan | Où va l'argent ? | fréquente | Liste des destinations | Garder |
| Lignes des prélèvements (cotisations, IS, IR, prélèvements sociaux) | Bilan | Quels prélèvements ? | fréquente | Cartes par activité et par foyer | Replier (« Détail du calcul ») |
| Lignes des destinations (net, conservé, prélèvements, non rattaché) | Bilan | — | occasionnelle | Barre et chiffres clés | Replier |
| Deux paragraphes d'explication | Bilan | Comment est-ce calculé ? | experte | — | Replier |
| Carte du foyer : revenus par personne | Par foyer fiscal | D'où viennent les revenus ? | fréquente | Grille | Replier (garder le titre et l'IR) |
| Carte du foyer : total encaissé, IR, prélèvements sociaux | Par foyer fiscal | Combien d'impôt ? | fréquente | Bilan | IR visible, le reste replié |
| Carte du foyer : net après impôts | Par foyer fiscal | — | — | Bilan (un seul foyer) | Supprimer quand il n'y a qu'un foyer |
| Revenu fiscal de référence | Carte du foyer | Accès au versement libératoire dans deux ans | occasionnelle | Note du versement libératoire | Visible en petit |
| Option dividendes (barème ou PFU) | Carte du foyer | Pourquoi ce montant d'IR ? | experte | — | Replier |
| Taux et net par foyer | Plusieurs foyers seulement | Comparer les foyers | fréquente | — | Garder |
| Cartes par activité (CA, charges, cotisations, coût du président, IS, conservé, versé) | Par activité | Que rapporte chaque activité ? | fréquente | Total annuel de la grille, bilan | « Versé » visible, le reste replié ; dans le panneau de l'acteur (proposition C) |
| Note du versement libératoire (seuil, RFR) | Carte de la micro | Ai-je droit au versement libératoire ? | occasionnelle | RFR du foyer, fenêtre « Modifier » | Replier, avec une pastille d'état |
| Note « partagés à parts égales entre les associés » | Par foyer fiscal | Limite du modèle | experte | — | Replier |
| Toutes les années (tableau) | Après les résultats, à partir de deux années | Que donnent les années suivantes ? | fréquente | Résultats de l'année affichée | Garder, plus haut ; mini-évolution dans le résumé |

### Comparateur et optimiseur

| Bloc ou commande | Où | Répond à | Classe | Doublons | Proposition |
| --- | --- | --- | --- | --- | --- |
| Titre et paragraphe d'explication | Haut du comparateur | Que compare-t-on ? | occasionnelle | — | Une ligne, le reste replié |
| Verdict (« le meilleur statut est… ») | absent | Ai-je intérêt à changer ? | essentielle | Mention « meilleur net » des colonnes | **Ajouter**, en une phrase |
| Activité comparée | Réglages | Quelle activité ? | fréquente | — | Garder visible |
| Bénéfice de la société (quatre modes) | Réglages | Comment partager le bénéfice ? | occasionnelle | Raccourcis du partage, « Appliquer au comparateur » | Résumé en une ligne, détail replié (« Réglages de la comparaison ») |
| Rémunération nette annuelle | Réglages | Combien je me verse ? | fréquente | Poignée de la barre, « Appliquer » de l'optimiseur | Dans les réglages repliés ; valeur rappelée dans la ligne de résumé |
| Part BNC en micro (curseur) | Réglages | Hypothèse de la micro | experte | — | Replier |
| Frais de fonctionnement par statut | Déjà replié | Frais propres à chaque statut | experte | — | Garder replié |
| Avertissements de la comparaison | Sous les réglages | — | fréquente quand présents | — | Garder |
| Partage du bénéfice : titre, explication, choix SASU / EURL | Bloc dédié | Où va le bénéfice en société ? | occasionnelle | Choix SASU / EURL de l'optimiseur (même réglage) | Un seul choix SASU / EURL ; bloc replié hors répartition personnalisée |
| Partage : phrase de lecture, barre, poignées | Bloc dédié | — | fréquente en répartition personnalisée | Légende-tableau | Garder la phrase et la barre |
| Partage : raccourcis (tout en dividendes, meilleur net…) | Bloc dédié | — | occasionnelle | Boutons « Appliquer » de l'optimiseur | Garder en répartition personnalisée seulement |
| Partage : légende-tableau des postes | Bloc dédié | Montant exact de chaque poste | experte | Barre, phrase de lecture | Replier |
| Exporter en CSV (comparaison) | Au-dessus du tableau | — | occasionnelle | Fenêtre Exporter | Déplacer dans la fenêtre Exporter |
| En-têtes de colonne (statut, actuel, meilleur net, hors plafond, renvois aux notes) | Tableau | Lequel est le mien, lequel est le meilleur ? | essentielle | — | Garder |
| Ligne « Net dans la poche » | Tableau | Combien dans chaque statut ? | essentielle | Bilan (colonne actuelle) | Garder |
| Ligne « Écart avec le statut actuel » | Tableau | Combien je gagne ou perds ? | essentielle | Différence des nets | Garder, juste sous le net |
| Ligne « Protection sociale » | Tableau | Qu'est-ce que je perds en protection ? | fréquente | Détail replié | Garder |
| Lignes taux, frais, cotisations, IS, IR, prélèvements sociaux, conservé | Tableau | Pourquoi cette différence ? | occasionnelle | Bilan | Replier (« Toutes les lignes ») |
| Notes numérotées sous le tableau | Sous le tableau | Conditions, risques | fréquente quand présentes | Pastilles des en-têtes | Garder (elles sont courtes et rares) |
| Ce que recouvre la note de protection sociale | Déjà replié | — | experte | Infobulle de la ligne | Garder replié |
| « Rémunération ou dividendes ? » : choix SASU / EURL | Optimiseur | — | — | Partage du bénéfice | Fusionner avec celui du partage |
| Optimiseur : meilleur net, meilleur avec 4 trimestres, « Appliquer » | Optimiseur | Quelle rémunération me verser ? | essentielle pour une société | Raccourcis du partage | Garder |
| Optimiseur : courbe | Optimiseur | Comment le net varie-t-il ? | fréquente | Tableau des valeurs | Garder |
| Optimiseur : valeurs de la courbe, export | Déjà replié | — | experte | — | Garder replié ; export dans la fenêtre Exporter |
| « Et si vous étiez mariés ou pacsés ? » | Fin du comparateur (couples en union libre) | Faut-il se pacser ? | occasionnelle | — | Garder (n'apparaît que si utile) |
| Avertissement du pied de page | Pied de page | Valeur juridique | occasionnelle | Sous-titre des résultats | Garder (texte légal), plus court |

### Doublons principaux

1. **Le net du foyer** apparaît trois fois avec deux valeurs : 69 575 € (bilan et carte du foyer) et 68 725 € (colonne « actuel » du comparateur, qui ajoute 850 € de frais de fonctionnement supposés). Le résumé proposé affichera le premier, et le comparateur dira « dont 850 € de frais supposés » sous la colonne actuelle.
2. **Le choix SASU / EURL** existe deux fois pour le même réglage (partage du bénéfice et optimiseur).
3. **Fixer la rémunération** se fait de quatre façons : champ des réglages, poignée de la barre, raccourcis du partage, boutons « Appliquer » de l'optimiseur.
4. **Le chiffre d'affaires** d'une activité figure dans le total annuel de la grille et dans sa carte de résultats.
5. **Les relations** sont affichées sur les deux acteurs concernés, puis encore dans la fenêtre « Modifier ».
6. **Les exports CSV** sont à trois endroits (fenêtre Exporter, comparateur, courbe).

## Parcours types

### 1. « Je suis en micro, ai-je intérêt à passer en société ? »

**Aujourd'hui.** L'activité comparée par défaut est la première activité, ici la micro-entreprise : 0 clic. Il faut descendre jusqu'au tableau de comparaison (4,9 / 8,9 écrans), lire les lignes « Net dans la poche » et « Écart avec le statut actuel » (la dernière, sous neuf autres), et sur téléphone faire glisser le tableau de 768 px horizontalement pour voir les cinq colonnes. Comprendre la note de protection sociale : 1 clic. Si la micro n'est pas la première activité : 2 clics de plus.

- **A** : 1 clic sur « Meilleur statut » dans le résumé, puis la phrase de verdict et le tableau réduit au net, à l'écart et à la protection : 1 clic, 0 / 0 écran. Sur téléphone, une carte par statut, sans glissement horizontal.
- **B** : 1 clic sur l'onglet « Comparer et optimiser », verdict en haut : 1 clic, 0 / 0.
- **C** : comme A ; ou depuis le panneau de la micro, « Comparer ses statuts » : 2 clics, 0 / 0.

### 2. « Quelle rémunération me verser en SASU ? »

**Aujourd'hui.** Choisir « Conseil SASU » dans « Activité comparée » (2 clics), descendre jusqu'à « Rémunération ou dividendes ? » (5,5 / 9,6 écrans), lire le meilleur net et le meilleur net avec 4 trimestres, « Appliquer au comparateur » (1 clic), remonter au tableau pour voir l'effet (0,6 / 0,8 écran) : **3 clics, 6,1 / 10,4 écrans**.

- **A** : lien du résumé vers le comparateur (1), activité (2), « Appliquer » placé juste sous le tableau réduit (1), effet visible dans le résumé : 4 clics, 0,6 / 1,5.
- **B** : onglet (1), activité (2), « Appliquer » (1) : 4 clics, 0,5 / 1,2.
- **C** : « Conseil SASU » dans la liste (1), « Comparer ses statuts » (1, l'activité est déjà choisie), « Appliquer » (1) : 3 clics, 0,3 / 1,0.

### 3. « Que donnent les prochaines années ? »

**Aujourd'hui.** Descendre à la grille (1,4 / 3,1), « + Ajouter une année » puis « Ajouter » (par défaut l'année suivante, flux recopiés) deux fois : 4 clics. Puis descendre à « Toutes les années », sous les résultats (≈ 3,8 / 7,2 écrans). Revoir le comparateur d'une autre année : 1 clic sur l'année et 2 à 3 écrans de plus. **4 clics, 3,8 / 7,2 écrans.**

- **A** : grille plus haute, synthèse remontée sous le chiffre clé : 4 clics, 2,0 / 3,5. Le résumé garde le sélecteur d'année : changer d'année sans remonter.
- **B** : 4 clics dans « Ma situation », 1 sur « Mes résultats », la synthèse y est en tête : 5 clics, 0,7 / 1,5.
- **C** : comme A, avec des acteurs plus courts : 4 clics, 1,8 / 3,2.

### 4. « Je prépare mon rendez-vous avec l'expert-comptable »

**Aujourd'hui.** Relire la simulation de haut en bas (5,5 / 10,1 écrans), ouvrir les frais de fonctionnement et la note de protection sociale (2 clics) pour vérifier les hypothèses, puis Exporter et Document PDF (2 clics ; le PDF déplie tout) : **5 clics, 5,5 / 10,1 écrans**. Le rapport Markdown est une alternative au PDF, sans changement de nombre de clics.

- **A** : un bouton « Tout déplier » (1), relecture de la page dépliée mais plus courte (3,1 / 6,3), export (2) : 3 clics.
- **B** : trois onglets (3), relecture d'environ 1 écran chacun (3,0 / 5,0), export (2) : 5 clics.
- **C** : comme A, avec les acteurs en liste : 3 clics, 2,3 / 4,8.

### 5. « Je saisis une charge récurrente »

Exemple : un loyer de bureau de 600 € par mois pour « Conseil SASU ».

**Aujourd'hui.** Descendre à la grille (1,4 / 3,1 ; sur téléphone, janvier est visible sans glissement), clic sur la case de janvier (1), type de flux (2), libellé et montant au clavier, « Appliquer à » sur « ce mois et les suivants » (2), Entrée ou bouton d'ajout (1), « Terminé » (1) : 7 clics. Pendant la saisie, la fenêtre modale cache tout résultat ; pour voir l'effet, descendre aux résultats puis au comparateur (2,3 / 4,5 écrans en tout). **7 clics, 2,3 / 4,5 écrans, effet invisible pendant la saisie.**

- **A** : grille plus haute (1,0 / 2,0), mêmes 7 clics ; le pied de la fenêtre affiche le net du foyer avant et après, le résumé collant se met à jour à la fermeture : effet visible sans défiler.
- **B** : « Ma situation » est la vue par défaut (0,3 / 1,0), 7 clics, effet dans la fenêtre puis dans le résumé.
- **C** : comme B (0,3 / 1,0), 7 clics.

### Récapitulatif

Clics · défilement ordinateur / téléphone (écrans).

| Parcours | Aujourd'hui | A | B | C (avec A) |
| --- | --- | --- | --- | --- |
| 1. Micro ou société ? | 0 · 4,9 / 8,9 + glissement horizontal | 1 · 0 / 0 | 1 · 0 / 0 | 1 · 0 / 0 |
| 2. Rémunération en SASU | 3 · 6,1 / 10,4 | 4 · 0,6 / 1,5 | 4 · 0,5 / 1,2 | 3 · 0,3 / 1,0 |
| 3. Prochaines années | 4 · 3,8 / 7,2 | 4 · 2,0 / 3,5 | 5 · 0,7 / 1,5 | 4 · 1,8 / 3,2 |
| 4. Rendez-vous expert-comptable | 5 · 5,5 / 10,1 | 3 · 3,1 / 6,3 | 5 · 3,0 / 5,0 | 3 · 2,3 / 4,8 |
| 5. Charge récurrente et son effet | 7 · 2,3 / 4,5 | 7 · 1,0 / 2,0 | 7 · 0,3 / 1,0 | 7 · 0,3 / 1,0 |
| Hauteur par défaut (px) | 5 830 / 9 033 | ≈ 3 700 / 5 900 | ≈ 1 750 / 3 000 par vue | ≈ 2 800 / 4 600 |

Le gain tient surtout au défilement (divisé par 2 à 10) ; le nombre de clics change peu, parce que la plupart des parcours n'en demandaient pas : il fallait descendre.

## Propositions

Les trois propositions partagent une **barre de résumé collante** sous la barre d'outils : année (sélecteur), net du foyer, taux global de prélèvement, meilleur statut de l'activité comparée, nombre d'alertes. Chaque chiffre est un lien vers son détail. Elle est recalculée en direct ; sur téléphone, elle tient en une ligne et se replie au défilement vers le bas. Elle répond à la contrainte « ne pas perdre le lien entre une saisie et son effet ».

### A. Résumé collant et divulgation progressive, sur la page unique

La page garde son ordre et son unité. Chaque bloc montre d'abord le chiffre qui compte ; le détail est replié avec le composant `Depliable` déjà en place (élément `details`, que la feuille d'impression déplie).

- Acteurs en lignes de 40 px : nom, type et relations en pastilles ; parts, verrouillage et suppression dans le menu de l'acteur.
- Légende de la grille repliée ; « + Ajouter » des cases vides au survol ou au focus (toujours visible au toucher) ; net du foyer avant / après en pied de la fenêtre d'un mois.
- Résultats : net, taux et barre ; lignes du bilan, explications et cartes détaillées repliées ; synthèse des années remontée.
- Comparateur : verdict en une phrase, réglages résumés en une ligne, tableau réduit au net, à l'écart et à la protection, le reste à un clic ; sur téléphone, une carte par statut triée par net.
- Optimiseur : un seul choix SASU / EURL ; partage du bénéfice replié hors répartition personnalisée.

| | |
| --- | --- |
| Avantages | Changement le plus petit ; livrable bloc par bloc ; impression déjà réglée par `details` ; pas de nouvelle navigation à apprendre ; les ancres et le lien d'évitement restent valables. |
| Inconvénients | La page reste longue sur téléphone (≈ 7 écrans) ; ce qui est replié se découvre moins ; plus de clics pour qui veut tout voir. |
| Accessibilité | `details` / `summary` sont accessibles au clavier et annoncés « réduit / développé » ; la barre collante ne doit pas masquer l'élément qui a le focus (critère 2.4.11 des WCAG 2.2 : `scroll-padding-top` égal à sa hauteur) ; cibles de 24 px, 44 px au toucher ; les liens du résumé ont un libellé complet (« Net du foyer : 69 575 €, voir le détail »). |
| Impression | Déjà couverte pour `details` (`impression.css` et `deplierPourImpression`). La barre de résumé est masquée à l'impression, ou imprimée une fois en tête comme encadré de synthèse. |
| Coût | Faible à moyen : environ 5 à 8 petites livraisons, chacune avec ses tests unitaires ; quelques tests de bout en bout à adapter (ceux qui lisent des lignes désormais repliées). |
| Risques | Replier ce qu'un utilisateur cherche (à vérifier par les essais) ; les tests axe et ceux du comparateur qui lisent toutes les lignes ; barre collante trop haute sur un petit écran en paysage. |

### B. Trois vues : « Ma situation », « Mes résultats », « Comparer et optimiser »

Le résumé collant, puis des onglets ; chaque vue a son adresse (#situation, #resultats, #comparer). Sur téléphone, les onglets sont en bas de l'écran.

| | |
| --- | --- |
| Avantages | Pages les plus courtes (≈ 1 750 / 3 000 px pour la plus longue) ; chaque vue répond à une question ; prépare la place des montages types (phase 14). |
| Inconvénients | La saisie et le comparateur ne sont plus visibles ensemble : on alterne entre onglets ; le résumé ne montre que quelques chiffres ; une navigation à apprendre ; parcours 3 et 4 un peu plus longs en clics. |
| Accessibilité | Motif « onglets » (tablist, flèches, Début / Fin) ou liens de navigation avec `aria-current` ; titre de page et focus à déplacer à chaque changement de vue ; les tests axe doivent parcourir les trois vues. |
| Impression | À reprendre : les vues masquées doivent s'imprimer (`print:block`), dans l'ordre, avec des sauts de page ; le PDF exporté passe par le même chemin. |
| Coût | Moyen à élevé : nouvelle structure de `App.tsx`, adresse et historique, impression, une grande partie des tests de bout en bout (ils supposent une page unique). |
| Risques | Perte du lien saisie / effet pour le comparateur ; régressions d'impression ; retour arrière du navigateur dans l'application de bureau (Electron) à gérer. |

### C. Inspecteur : les acteurs dans un panneau latéral

S'ajoute à A. Les acteurs deviennent une liste courte (avatar et nom). En choisir un ouvre un panneau non modal (à droite sur ordinateur, en bas d'écran sur téléphone) avec ses réglages, ses relations, ses frais et sa carte de résultats, et un bouton « Comparer ses statuts ».

| | |
| --- | --- |
| Avantages | Supprime le plus gros bloc du haut de page (1 047 px) ; réunit réglages et résultats d'un acteur (plus de section « Par activité » séparée) ; on change une option et le résumé réagit aussitôt ; mène directement au comparateur de l'activité. |
| Inconvénients | Une colonne de plus sur ordinateur (la grille perd de la largeur) ; vue d'ensemble des relations moins immédiate ; deux endroits pour régler un acteur tant que la fenêtre « Modifier » existe. |
| Accessibilité | Panneau non modal : région nommée, focus déplacé à l'ouverture et rendu à l'acteur à la fermeture (Échap) ; en bas d'écran sur téléphone, attention au défilement de fond et à la taille des cibles. |
| Impression | Le panneau ne s'imprime pas ; les réglages des acteurs s'impriment dans une section « Acteurs » dédiée (comme aujourd'hui les cartes). |
| Coût | Le plus élevé : nouveau composant, fusion avec `EditEntityModal`, état de sélection, tests de focus, adaptation des tests d'acteurs. |
| Risques | Complexité du panneau sur téléphone ; double saisie possible avec la fenêtre « Modifier » pendant la transition. |

### Recommandation

**A d'abord, puis l'inspecteur de C ; B en réserve.**

- A traite les plus gros défauts mesurés : aucun chiffre avant le 3e écran, comparateur au 5e (9e sur téléphone), tableau à glisser sur téléphone, effet d'une saisie invisible. Le parcours le plus courant (« micro ou société ? ») passe de 4,9 écrans à un clic.
- A se livre en petites étapes indépendantes, sans toucher à la structure de la page : l'impression, les ancres, le lecteur d'écran et la plupart des tests de bout en bout restent valables.
- C retire ensuite le bloc des acteurs, le plus haut restant, et rapproche réglages et résultats ; il vaut mieux le faire sur une page déjà allégée.
- B réduit le plus la longueur, mais sépare la saisie du comparateur, ce que le résumé ne compense qu'en partie, et demande de reprendre l'impression et beaucoup de tests. À reconsidérer si les essais montrent que la page de A reste trop longue sur téléphone, ou quand les montages types (phase 14) demanderont une vue d'accueil.

## Plan de mise en œuvre (A, puis C)

Chaque étape est livrable seule, avec ses tests unitaires, les tests axe et clavier, et une vérification de l'impression.

1. **Mesures automatisées.** Un test de bout en bout de la démo web qui mesure la hauteur de la page et la position du net du foyer et du tableau de comparaison à 1 440 et 375 px, en référence (aujourd'hui 5 830 / 9 033 px).
2. **Barre de résumé collante.** Net du foyer, taux, meilleur statut, alertes, sélecteur d'année ; liens vers les sections ; `scroll-padding-top` pour que le focus ne passe pas dessous ; masquée ou réduite à un encadré à l'impression.
3. **Verdict et tableau réduit du comparateur.** Phrase de verdict ; lignes net, écart et protection visibles, les autres dans « Toutes les lignes » ; « dont 850 € de frais supposés » sous la colonne actuelle ; cartes par statut sous 640 px de large.
4. **Réglages du comparateur résumés.** Une ligne (activité, mode, rémunération) ; le reste replié ; un seul choix SASU / EURL partagé par le partage et l'optimiseur ; partage du bénéfice replié hors répartition personnalisée ; exports CSV déplacés dans la fenêtre Exporter.
5. **Résultats en divulgation progressive.** Net, taux et barre visibles ; lignes et explications repliées ; cartes réduites à leur chiffre clé ; net du foyer non répété avec un seul foyer ; synthèse des années remontée.
6. **Grille et légende.** Légende repliée, « Gérer les couleurs » dans les paramètres, « + Ajouter » au survol ou au focus (visible au toucher), net du foyer avant / après dans la fenêtre d'un mois.
7. **Acteurs en lignes.** Pastilles de type, d'options et de relations ; parts, verrouillage, suppression dans un menu ; zoom déplacé dans les paramètres.
8. **Mémoire de l'affichage.** Sections ouvertes ou fermées retenues dans les préférences ; bouton « Tout déplier » ; raccourcis clavier vers les sections.
9. **Inspecteur d'acteur (C).** Panneau non modal à la sélection, réunissant la carte actuelle, la fenêtre « Modifier » et la carte de résultats de l'acteur ; « Comparer ses statuts » ; puis retrait de la section « Par activité ».

### Vérifier que cela a marché

- **Hauteur de page** par défaut : ≤ 3 800 px à 1 440 px et ≤ 6 000 px à 375 px après l'étape 7 ; ≤ 3 000 / 4 800 px après l'étape 9 (test de l'étape 1).
- **Premier chiffre** : le net du foyer visible sans défiler, à toutes les largeurs, dès l'étape 2.
- **Parcours** : rejouer les cinq parcours avec les mesures du récapitulatif ; aucun parcours ne doit demander plus de 2 écrans de défilement sur ordinateur.
- **Essais** : trois à cinq personnes (dont au moins une au téléphone et une au clavier seul) sur les parcours 1, 2 et 5, avant et après ; noter le temps, les hésitations et ce qu'elles n'ont pas trouvé.
- **Garde-fous** : tests axe sans nouvelle violation, en thème clair et sombre ; cibles de 24 px (44 px au toucher) ; texte de 12 px au moins (14 px pour le courant) ; pas de défilement horizontal de la page à 320 px ; impression et PDF identiques en contenu à aujourd'hui (tout déplié) ; tests de bout en bout adaptés aux nouveaux chemins.

Les maquettes basse fidélité des trois propositions (un fichier HTML autonome, ordinateur et téléphone côte à côte, avec les chiffres de la simulation d'exemple) accompagnent cette étude.
