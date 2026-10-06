# Journal des modifications

Les changements notables de l'application sont consignés ici. Le format suit [Keep a Changelog](https://keepachangelog.com/fr/1.1.0/), et les numéros de version le [versionnage sémantique](https://semver.org/lang/fr/).

La section « Non publié » recueille les changements en attente de la prochaine version. La marche à suivre pour publier est décrite dans [documentation/publication.md](./documentation/publication.md).

## [Non publié]

## [0.9.1] — 2026-10-06

### Ajouté

- **Démo web installable :** dans Edge ou Chrome, la démo s'installe comme une application (icône sur le bureau et dans le menu Démarrer, sa propre fenêtre) et fonctionne hors ligne, sans compte. Une solution sous Windows quand Smart App Control bloque l'exécutable, qui n'est pas encore signé.
- **Aide à l'installation :** une ligne du bandeau de la démo et un bouton des paramètres ouvrent une fenêtre « Comment faire ? », adaptée au navigateur : bouton « Installer maintenant » et étapes en images dans Edge et Chrome, solutions de remplacement dans Firefox et Safari.
- **Version web installée :** une fois installée, la démo porte ce nom, et rappelle que la connexion d'une IA (MCP) demande l'application de bureau.
- **« Utiliser avec une IA (MCP) » dans la démo :** la fenêtre explique ce que permet le serveur MCP et pourquoi il faut l'application de bureau, avec ses liens.
- **Préparation du Microsoft Store :** paquet construit par un workflow dédié, serveur MCP utilisable depuis la version du Store (ADR 013), textes, captures et logos de la fiche.

### Modifié

- Mentions légales : l'éditeur est l'entreprise individuelle de Damien BECHERINI (SIREN et SIRET), pour un projet non commercial et open source.
- Les retours précisent « version web installée » quand ils viennent de la démo installée.
- Guide d'installation : que faire quand Windows bloque l'application.

## [0.9.0] — 2026-10-06

Première version publiée : ces notes décrivent ce que contient l'application.

### Ajouté

- **Statuts simulés :** SASU, EURL, entreprise individuelle au réel et micro-entreprise (avec ou sans versement libératoire), reliées aux personnes par des relations (président, gérant, salarié, couple, enfant…).
- **Cotisations ligne à ligne :** indépendants selon les règles officielles (assiette unique après abattement de 26 %, cotisations minimales, trimestres de retraite), président de SASU et salariés au régime général, coût employeur porté par l'activité.
- **Impôt du foyer :** calculé une seule fois par foyer fiscal (quotient familial plafonné, décote, dividendes au forfait ou au barème), déficit d'une entreprise individuelle imputé sur les autres revenus du foyer.
- **Plusieurs années :** jusqu'à dix années consécutives par simulation, chacune avec ses propres règles (2024, 2025, 2026) ; revenu fiscal de référence reporté sur le versement libératoire deux ans plus tard ; flux appliqués à plusieurs années à la fois.
- **Dispositifs dans le temps :** ACRE mois par mois, CFE de création et sortie du régime micro après deux années au-delà des plafonds, d'après la date de création de l'activité.
- **Comparateur de statuts :** net, taux de prélèvement, frais de fonctionnement détaillés et protection sociale pour chaque statut ; sociétés comparées par défaut à leur meilleure rémunération validant 4 trimestres de retraite, avec le coût de cette exigence en net ; effet d'un mariage ou d'un PACS sur l'impôt d'un couple.
- **Rémunération ou dividendes :** courbe du net du foyer selon la rémunération du dirigeant, partage du bénéfice réglé sur une barre interactive.
- **Frais réels et kilométrage :** trajets domicile-travail au barème kilométrique, comparés à la déduction de 10 % ; déplacements professionnels d'une activité au barème.
- **Montages types :** huit situations courantes préremplies et expliquées, avec leurs sources, pour partir d'un exemple.
- **Grille annuelle :** saisie, modification et suppression d'un flux sur plusieurs mois en une fois, recopie sur les mois suivants, bande des mois quand la grille déborde, impression sur une page.
- **Affichages au choix (bêta) :** « Résumé » (par défaut), classique et « Trois vues ».
- **Sauvegardes et exports :** sauvegardes nommées, export et import de toutes les sauvegardes en un fichier, exports CSV, PDF et rapport Markdown ; réglages du comparateur enregistrés avec la simulation.
- **Pérennité des fichiers :** chaque fichier porte un numéro de format et la version de l'application qui l'a écrit ; les anciens formats sont convertis à la lecture, l'original étant copié à côté.
- **Serveur MCP local :** un client d'IA de bureau peut lire et calculer la simulation, et proposer des modifications que l'on applique ou refuse dans l'application (Paramètres > Utiliser avec une IA).
- **Avis et mentions légales :** fenêtre « Donner mon avis », qui prépare un ticket GitHub ou un e-mail sans aucun montant ni nom de la simulation ; page « Mentions légales et confidentialité ».
- **Démo web :** la même interface dans le navigateur, publiée sur GitHub Pages.
- **Exécutables :** installateur et archive zip pour Windows, image disque pour macOS (Apple Silicon et Intel), AppImage et paquet deb pour Linux, construits par l'intégration continue.

### Modifié

- Préférences retenues d'une ouverture à l'autre : sauvegarde chargée, zoom, affichage, sections repliables ouvertes ou fermées.
- Accessibilité : navigation au clavier, contrastes de niveau AA, zones cliquables agrandies sur écran tactile, contrôles nommés pour les lecteurs d'écran (audit axe-core).
- Affichage sur petit écran et téléphone : grille, synthèse des années et tableau comparatif gardent leur première colonne visible en défilant.
- Police Inter livrée avec l'application, chiffres des tableaux alignés.

### Corrigé

- Calculs : abattement minimum de la micro-entreprise appliqué séparément à chaque nature d'activité, réduction générale éteinte à exactement 3 SMIC, micro-entreprise au-delà des plafonds jamais désignée meilleur net.
- Sauvegardes : validation avant écriture, rien de perdu à la fermeture, copie importée numérotée au lieu d'empiler « (importée) ».

[Non publié]: https://github.com/DamienBecherini/simulateur-independant-fr/compare/v0.9.1...HEAD
[0.9.1]: https://github.com/DamienBecherini/simulateur-independant-fr/compare/v0.9.0...v0.9.1
[0.9.0]: https://github.com/DamienBecherini/simulateur-independant-fr/releases/tag/v0.9.0
