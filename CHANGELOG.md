# Journal des modifications

Les changements notables de l'application sont consignés ici. Le format suit [Keep a Changelog](https://keepachangelog.com/fr/1.1.0/), et les numéros de version le [versionnage sémantique](https://semver.org/lang/fr/).

Aucune version n'a encore été publiée : la section « Non publié » résume l'état actuel de l'application, qui deviendra la première version publiée. La marche à suivre pour publier est décrite dans [documentation/publication.md](./documentation/publication.md).

## [Non publié]

### Ajouté

- Serveur MCP local : un client d'IA de bureau peut lire et calculer la simulation, et proposer des modifications à valider dans l'application (Paramètres > Utiliser avec une IA).
- Page « Mentions légales et confidentialité », bande des mois au-dessus de la grille, police Inter.

- **Statuts simulés :** SASU, EURL, entreprise individuelle au réel et micro-entreprise (avec ou sans versement libératoire), reliées aux personnes par des relations (président, gérant, salarié, couple, enfant…).
- **Cotisations ligne à ligne :** indépendants selon les règles officielles (assiette unique après abattement de 26 %, cotisations minimales, trimestres de retraite), président de SASU et salariés au régime général, coût employeur porté par l'activité.
- **Impôt du foyer :** calculé une seule fois par foyer fiscal (quotient familial plafonné, décote, dividendes au forfait ou au barème), déficit d'une entreprise individuelle imputé sur les autres revenus du foyer.
- **Plusieurs années :** jusqu'à dix années consécutives par simulation, chacune avec ses propres règles (2024, 2025, 2026) ; revenu fiscal de référence reporté sur le versement libératoire deux ans plus tard ; flux appliqués à plusieurs années à la fois.
- **Comparateur de statuts :** net, taux de prélèvement, frais de fonctionnement détaillés et protection sociale pour chaque statut ; sociétés comparées par défaut à leur meilleure rémunération validant 4 trimestres de retraite, avec le coût de cette exigence en net ; effet d'un mariage ou d'un PACS sur l'impôt d'un couple.
- **Rémunération ou dividendes :** courbe du net du foyer selon la rémunération du dirigeant, partage du bénéfice réglé sur une barre interactive.
- **Frais réels et kilométrage :** trajets domicile-travail au barème kilométrique, comparés à la déduction de 10 % ; déplacements professionnels d'une activité au barème.
- **Grille annuelle :** saisie, modification et suppression d'un flux sur plusieurs mois en une fois, recopie sur les mois suivants, impression sur une page.
- **Affichages au choix (bêta) :** classique, « Résumé », « Panneaux » et « Trois vues ».
- **Sauvegardes et exports :** sauvegardes nommées, export et import de toutes les sauvegardes en un fichier, exports CSV, PDF et rapport Markdown ; réglages du comparateur enregistrés avec la simulation.
- **Pérennité des fichiers :** chaque fichier porte un numéro de format et la version de l'application qui l'a écrit ; les anciens formats sont convertis à la lecture, l'original étant copié à côté.
- **Démo web :** la même interface dans le navigateur, publiée sur GitHub Pages.
- **Exécutables :** installateur et archive zip pour Windows, image disque pour macOS (Apple Silicon et Intel), AppImage et paquet deb pour Linux, construits par l'intégration continue à chaque étiquette de version.

### Modifié

- Préférences retenues d'une ouverture à l'autre : sauvegarde chargée, zoom, affichage, sections repliables ouvertes ou fermées.
- Accessibilité : navigation au clavier, contrastes de niveau AA, zones cliquables agrandies sur écran tactile, contrôles nommés pour les lecteurs d'écran (audit axe-core).
- Affichage sur petit écran et téléphone : grille, synthèse des années et tableau comparatif gardent leur première colonne visible en défilant.

### Corrigé

- Calculs : abattement minimum de la micro-entreprise appliqué séparément à chaque nature d'activité, réduction générale éteinte à exactement 3 SMIC, micro-entreprise au-delà des plafonds jamais désignée meilleur net.
- Sauvegardes : validation avant écriture, rien de perdu à la fermeture, copie importée numérotée au lieu d'empiler « (importée) ».
