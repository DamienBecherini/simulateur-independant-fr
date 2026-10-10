# Journal des modifications

Les changements notables de l'application sont consignés ici. Le format suit [Keep a Changelog](https://keepachangelog.com/fr/1.1.0/), et les numéros de version le [versionnage sémantique](https://semver.org/lang/fr/).

La section « Non publié » recueille les changements en attente de la prochaine version. La marche à suivre pour publier est décrite dans [documentation/publication.md](./documentation/publication.md).

## [Non publié]

### Modifié

- **Brut d'un salaire calculé avec les cotisations de l'année.** Saisi sans brut ni pourcentage, un salaire reçoit le brut que donnent les cotisations salariales du régime général de l'année affichée (salarié non cadre, même salaire chaque mois), et non plus 78 % du net ; un brut saisi seul donne le net de la même façon. Le pourcentage saisi garde la priorité.
- Les taux et seuils cités par les textes (aides de la fiche d'un acteur, frais réels, montages types, exports CSV et Markdown, avertissement des cotisations minimales) viennent des règles de l'année concernée au lieu d'être recopiés : ils suivront les années à venir. Le capital social par défaut d'une société (1 000 €) n'est plus écrit qu'à un endroit.
- Maintenance : les cas de référence et les montages types sont liés explicitement aux règles de 2026, et non plus à l'année en cours ; l'ajout des règles de 2027 ne les désactivera plus (un test le vérifie avec une année fictive).
- Maintenance : les règles de 2026 passent de `src/backend/config.json` à `src/backend/regles/2026.json`, comme les autres années ; l'année en cours du simulateur (nouvelle session, démo) est la plus récente des fichiers de règles et n'est plus écrite en dur (ADR 007 mise à jour).
- Maintenance : les fonctions du moteur reçoivent toujours les règles de l'année calculée ; il n'y a plus de « règles de l'année en cours » par défaut, qu'un appel pouvait utiliser sans le dire.
- Maintenance : chaque caisse de libéraux (CIPAV, CARPIMKO) a son calcul, ses particularités et ses textes dans des tables typées par caisse ; une caisse ajoutée sans ses règles est refusée à la compilation au lieu d'être calculée comme la CARPIMKO.
- Maintenance : les tests qui portent sur l'année en cours (session vierge, « dernières règles connues », année future) la calculent au lieu d'attendre 2026 ; la simulation d'exemple de la démo web est figée sur 2026, comme les montages types. Ajouter les règles de 2027 ne fait plus échouer que les tests de ces règles (essai : 82 échecs avant, 1 après).
- Maintenance : chaque statut juridique au réel (SASU, EURL, EI) a son calcul, sa protection sociale, ses relations, ses libellés et ses réglages dans des tables typées par statut, tirées d'une seule liste ; un statut ajouté sans ses lignes est refusé à la compilation au lieu d'être calculé comme une EURL.
- Outils pour les IA : les descriptions du catalogue sont resserrées (redites retirées entre outils et avec les schémas des paramètres, types de flux groupés par acteur), sans changer les outils, leurs paramètres ni leurs résultats. Le catalogue envoyé au modèle à chaque échange passe de 30 953 à 27 501 caractères, et retrouve environ 11 % de marge sous son plafond.
- Documentation : le guide du développeur est réécrit (architecture, carte du moteur, procédures pas à pas pour une nouvelle année de règles, un paramètre, une caisse, un statut ou un type de flux, le format de fichier, un cas de référence, le débogage d'un calcul, les scénarios de test et les outils pour les IA ; sources officielles, glossaire), et les ADR périmées sont complétées.
- Maintenance : la commande `npm run simuler -- fichier.json` passe une session dans le moteur, après la même lecture et le même nettoyage qu'à l'ouverture dans l'application, et affiche dans le terminal, année par année, l'année des règles appliquées, les montants clés de chaque activité et de chaque foyer, les avertissements et le bilan ; options `--annee`, `--acteur` et `--json` (rapports bruts). Pour déboguer un calcul signalé faux sans écrire de test.
- Maintenance : le comparateur de statuts est découpé en modules courts (conversion d'une activité dans un autre statut, frais de fonctionnement, colonne, simulation d'un statut), qui se passent une seule « colonne étudiée » au lieu de six ou sept paramètres ; le comparateur et l'optimiseur de rémunération ne s'importent plus l'un l'autre, et la simulation des années ne dépend plus du comparateur pour passer au réel une micro-entreprise sortie du régime. Aucun montant ne change.
- Maintenance : le moteur d'une année (`simulation-engine.ts`, 765 lignes) est découpé en modules par étape, sans changement de calcul : routage des flux vers les personnes, activités au réel (sociétés à l'IS, entreprise individuelle), micro-entreprise, éléments communs aux activités, impôt du foyer, bilan ; `simulation-engine.ts` reste le point d'entrée. Le test « est-ce un objet JSON ? », écrit quatre fois dans la lecture des fichiers, n'existe plus qu'une fois.
- Maintenance : la limite de complexité cyclomatique d'ESLint passe de 15 à 12 par fonction ; les dix fonctions qui la dépassaient (comparateur, ligne de flux, partage du bénéfice, export Markdown, outils pour les IA, lecture de la session et des sauvegardes) sont découpées en sous-composants et fonctions nommées, sans changement de comportement ni de montant.
- Sécurité de l'application de bureau : les options de protection des fenêtres (isolation du contexte, bac à sable, pas de Node.js dans la page) sont écrites explicitement au lieu de reposer sur les valeurs par défaut d'Electron ; la fenêtre ne peut plus quitter l'interface ni en ouvrir une autre (un lien vers une page en https s'ouvre toujours dans le navigateur, toute autre adresse est refusée) ; le process principal refuse un appel sans fenêtre émettrice et vérifie les paramètres reçus (réglages et année du comparateur, formats et noms de fichiers, exports, sauvegardes), et la session enregistrée est nettoyée comme à la lecture.
- Maintenance : dépendances mises à jour dans leur version majeure actuelle : React 19.3, Electron 44.7, Tailwind CSS 4.3, tailwind-merge 3.7, Playwright 1.64, plugin React de Vite 4.7, typescript-eslint 8.71, wait-on 9.5, sonner 2.0.8, types de React 19.3. Les composants Radix restent fixés à leurs versions précédentes : les plus récentes changent le comportement des fenêtres (Échap ferme aussi la fenêtre parente, largeur sur téléphone). `npm audit` ne signale plus rien dans les dépendances de l'application.
- Maintenance : Vitest et sa couverture (`@vitest/coverage-v8`) passent de la version 4.1 à la 5.0, sans changement de configuration ni de test ; mêmes fichiers couverts et mêmes seuils (90 %), couverture inchangée (98,94 % des instructions, 95,12 % des branches).
- Maintenance : l'application de bureau et la démo web ont chacune leur point d'entrée (`src/ui/main.tsx`, `src/web/main.tsx`), qui fournit à l'interface ce qui est propre à la démo (bandeau, bouton d'installation, liens vers l'application de bureau) ; l'interface n'importe plus rien de la démo, et l'application de bureau n'en contient plus une ligne sans dépendre de l'élimination du code mort à la compilation (`VITE_CIBLE` disparaît). Les calculs demandés par l'interface et la vérification de ce qu'elle envoie (session, réglages, année, activité, statut à optimiser) sont communs aux deux : la démo vérifie désormais ces paramètres comme le bureau. Les sens de dépendance entre dossiers (moteur, `src/lib`, interface, démo) sont vérifiés par ESLint.
- Maintenance : l'interface et le process principal sont découpés sans changement de calcul : décisions du panneau des paramètres (sauvegarder, sauvegarder sous, écraser), barres et échelles de la grille, raccourcis d'annulation dans des fonctions testées de `src/lib` ; process principal réparti par domaine (fenêtres, session, calculs, fichiers, clients d'IA) ; un seul module de mise en forme des montants. Ctrl+Z et Ctrl+Y dans un champ de saisie annulent et rétablissent la frappe du champ, et non plus la dernière modification de la simulation (hors d'un champ, ils pilotent toujours l'historique).

### Corrigé

- Les limites du rapport Markdown et du README étaient périmées : les cotisations du président de SASU sont calculées ligne à ligne avec les taux du régime général de l'année (et non « approchées par un ratio moyen »), et le déficit d'une société à l'IS est reporté sur les années suivantes ; seul le report du déficit d'une entreprise individuelle supérieur aux autres revenus du foyer reste non modélisé.
- **Sauvegardes et session ne sont plus perdues sur un fichier abîmé.** Un fichier de sauvegardes, de session ou de préférences illisible (tronqué par un arrêt brutal, modifié à la main) n'est plus lu comme vide puis écrasé : il est mis de côté, intact, sous un nom daté (`simulationSlots.illisible-20261009-143005.json`), et une fenêtre le nomme à l'ouverture. Une sauvegarde illisible ou refusée, ou des éléments retirés au nettoyage d'une session, sont gardés dans une copie (`*.refuse-….json`) avant que le fichier ne soit réécrit. Un fichier qui n'a pu être ni lu ni copié n'est plus jamais remplacé pendant que l'application est ouverte.
- **« Sauvegarde réussie ! » ne s'affiche plus quand l'écriture échoue.** Le message devient « Échec de la sauvegarde : le fichier des sauvegardes n'a pas pu être écrit. Vos sauvegardes précédentes sont intactes. », le panneau reste ouvert et la liste ne change pas. Un échec de la sauvegarde automatique est signalé lui aussi. Dans la démo web, un stockage du navigateur plein ou bloqué est signalé de la même façon.
- Les fichiers de données sont écrits dans un fichier temporaire puis renommés : un arrêt brutal ne laisse plus un fichier à moitié écrit.
- La sauvegarde automatique attend la fin du chargement : la simulation vierge affichée au démarrage ne peut plus remplacer celle du disque.
- Une session lisible mais dont rien ne peut être repris (par exemple un nom qui n'est pas un texte, ou la grille d'une année sans ses douze mois) n'est plus remplacée en silence par une simulation vierge : elle est traitée comme un fichier illisible, mise de côté sous un nom daté (`sessionState.illisible-….json`) et nommée dans une fenêtre à l'ouverture. Même chose dans la démo web, qui la garde sous une clé datée du stockage du navigateur et repart de la simulation d'exemple. L'import d'un tel fichier est refusé (« Erreur d'importation ») au lieu de remplacer la simulation en cours par une simulation vierge annoncée « importée avec succès ».
- Fiche d'une activité : la ligne d'information sous le choix de la profession (caisse, taux de la micro-entreprise, complémentaire) décrit les règles de l'année affichée, et non toujours celles de 2026 (par exemple, pour un infirmier en 2025, la complémentaire forfaitaire de la CARPIMKO).

## [0.10.0] — 2026-10-09

### Ajouté

- **Professions libérales réglementées (ADR 015) :** une micro-entreprise, une entreprise individuelle au réel ou une EURL choisit sa profession (« Non réglementée » par défaut, puis les professions de santé de la CARPIMKO, celles de la CIPAV, et « Autre profession réglementée »), dont la caisse se déduit des règles de chaque année. Une ligne sous la liste dit la caisse, si la micro-entreprise est possible et les principaux taux. Les sessions existantes ne changent pas.
  - **Au réel :** retraite de base des libéraux (8,73 % jusqu'au plafond et 1,87 % jusqu'à 5 plafonds, 8,23 % en 2024), indemnités journalières à 0,30 %, complémentaire et invalidité-décès de la caisse (CIPAV : 11 % puis 21 % en 2025 et 2026, 0,5 % ; CARPIMKO : 8,70 % bornée entre 0,5 et 3 plafonds en 2026, forfait et 3 % avant, invalidité-décès de 1 022 €), maladie, allocations familiales, CSG-CRDS et formation professionnelle de l'Urssaf.
  - **Auxiliaires médicaux conventionnés :** CURPS (0,10 %, plafonnée), ASV, part conventionnée des recettes (100 % par défaut) et prise en charge de la maladie et de l'ASV par l'Assurance maladie sur cette part ; complémentaire et ASV de la CARPIMKO calculées sur le revenu de l'année précédente quand elle est dans la simulation (« calculée sur le revenu 2025 »).
  - **Micro-entreprise :** taux global de 23,2 % pour un affilié de la CIPAV (21,2 % au 1er janvier 2024), trimestres comptés comme la CIPAV ; interdite aux praticiens et auxiliaires médicaux : un avertissement dans la simulation, et le comparateur retire ses colonnes micro en disant pourquoi.
  - **Carte de l'activité :** profession et caisse sous le nom, cotisations par caisse ligne à ligne ; protection sociale du comparateur selon la caisse ; avertissement sur les sociétés d'exercice libéral pour une profession concernée en SASU ou en EURL ; « Autre profession réglementée » calculée comme une profession non réglementée, avec un avertissement.
  - **Comparateur :** pour une profession qui exerce en principe en société d'exercice libéral, la SASU et l'EURL classiques ne sont jamais désignées comme meilleur statut ; leurs colonnes restent, indicatives.
  - **Exports et outils pour les IA :** profession dans le statut et tableau « Cotisations par caisse » des exports CSV et Markdown ; `regles_de_l_annee` liste les professions et les barèmes de la CIPAV et de la CARPIMKO, `expliquer_resultat` détaille l'ASV, la CURPS et la prise en charge, et une proposition peut régler la profession et la part conventionnée d'une activité.
  - Une profession inconnue des règles (fichier abîmé) est écartée à l'ouverture, et le rapport de nettoyage le signale.
- **Bénéfice mis en réserve :** une SASU ou une EURL garde d'une année à l'autre ses réserves, sa réserve légale (un vingtième du bénéfice jusqu'au dixième du capital) et son déficit, imputé sur l'impôt sur les sociétés des années suivantes ; les dividendes de la grille peuvent être pris sur les réserves des années précédentes (ADR 014).
- **Capital et réserves de départ** dans la fiche d'une SASU ou d'une EURL.
- **Réserves de chaque société, année par année :** dans la carte de l'activité, la synthèse des années, la barre de partage du comparateur et les exports CSV et Markdown.
- **« Sur toutes les années » dans le comparateur :** trois stratégies de distribution du bénéfice (tout distribuer chaque année, garder une part puis tout distribuer la dernière année, lisser), comparées au net cumulé de toutes les années, en SASU et en EURL.
- **Outils pour les IA :** `rafraichir_proposition` reconstruit une proposition périmée sur la simulation actuelle et dit quelles opérations ne s'appliquent plus ; `optimiser_remuneration` situe la rémunération et les dividendes saisis par rapport au meilleur net (écart en euros, frais de fonctionnement compris) ; `simuler` et `expliquer_resultat` donnent les réserves des sociétés, `regles_de_l_annee` la réserve légale et le report des déficits.
- Démo web : l'adresse `#donner-mon-avis` ouvre directement la fenêtre « Donner mon avis », déjà remplie de la version et de l'environnement (lien « Donner un avis » de la page outil du site).

### Modifié

- Micro-entreprise : le champ du revenu fiscal de référence nomme les années qu'il couvre (« RFR 2024 », sur l'avis d'imposition reçu en 2025) et dit à partir de quelle année la simulation calcule elle-même ce revenu.
- Comparateur d'une année : les modes « tout en dividendes » et « répartition personnalisée » distribuent le bénéfice distribuable de l'année, après réserve légale et pertes antérieures ; les réserves des années précédentes restent dans la société.
- Serveur MCP : chaque réponse est un seul texte (résumé, puis JSON du résultat), et la liste des outils, sans schémas de sortie, est presque deux fois plus légère.
- Outils pour les IA : « autre revenu imposable » est décrit comme un montant net imposable, ajouté tel quel au barème (sans l'abattement de 10 % des salaires), ce que fait le calcul.

### Corrigé

- **Micro-entreprise : contribution à la formation professionnelle comptée.** Elle s'ajoute aux cotisations, en part du chiffre d'affaires (article L6331-48 du code du travail) : 0,1 % pour la vente de marchandises, 0,2 % pour les prestations BNC, 0,3 % pour les prestations BIC, comptées au taux des artisans faute de distinguer le commerçant (0,2 %). L'ACRE ne la réduit pas et elle n'ouvre aucun trimestre de retraite. Elle entre dans le net, le comparateur, l'optimiseur, les exports et les outils pour les IA, et figure à part sous les cotisations de l'activité (« dont formation professionnelle ») : 80 € pour 40 000 € de prestations BNC.

## [0.9.1] — 2026-10-06

### Ajouté

- **Démo web installable :** dans Edge ou Chrome, la démo s'installe comme une application (icône sur le bureau et dans le menu Démarrer, sa propre fenêtre) et fonctionne hors ligne, sans compte. Une solution sous Windows quand Smart App Control bloque l'exécutable, qui n'est pas encore signé.
- **Aide à l'installation :** une ligne du bandeau de la démo et un bouton des paramètres ouvrent une fenêtre « Comment faire ? », adaptée au navigateur : bouton « Installer maintenant » et étapes en images dans Edge et Chrome, solutions de remplacement dans Firefox et Safari.
- **Version web installée :** une fois installée, la démo porte ce nom, et rappelle que la connexion d'une IA (MCP) demande l'application de bureau.
- **« Utiliser avec une IA (MCP) » dans la démo :** la fenêtre explique ce que permet le serveur MCP et pourquoi il faut l'application de bureau, avec ses liens.
- **Préparation du Microsoft Store :** paquet construit par un workflow dédié, serveur MCP utilisable depuis la version du Store (ADR 013), textes, captures et logos de la fiche.

### Modifié

- Mentions légales : l'éditeur est l'entreprise individuelle de Damien BECHERINI (SIREN et SIRET), pour un projet non commercial et open source.
- Barre d'outils : « Montages types » y a son bouton, et « Donner mon avis » montre son nom sur un écran large ; à la fermeture de la fenêtre des montages, le focus revient sur le bouton qui l'a ouverte.
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

[Non publié]: https://github.com/DamienBecherini/simulateur-independant-fr/compare/v0.10.0...HEAD
[0.10.0]: https://github.com/DamienBecherini/simulateur-independant-fr/compare/v0.9.1...v0.10.0
[0.9.1]: https://github.com/DamienBecherini/simulateur-independant-fr/compare/v0.9.0...v0.9.1
[0.9.0]: https://github.com/DamienBecherini/simulateur-independant-fr/releases/tag/v0.9.0
