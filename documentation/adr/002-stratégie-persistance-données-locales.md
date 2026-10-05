# ADR-002: Stratégie de Persistance des Données (Fichiers JSON locaux)

- **Date :** 2025-11-08
- **Statut :** Accepté

## Contexte

L'application doit garantir une confidentialité absolue et un fonctionnement 100% hors-ligne. Il est donc nécessaire de choisir une stratégie de stockage des données de l'utilisateur (session de travail, sauvegardes nommées, préférences) qui soit simple, robuste et locale à la machine de l'utilisateur.

Les données à stocker, bien que structurées sous forme de graphe (entités, relations, flux), ne représentent pas un volume très important et ne nécessitent pas de capacités de requêtage complexes.

## Décision

Nous avons décidé d'utiliser des **fichiers au format JSON** stockés directement dans le répertoire des données utilisateur géré par Electron (`app.getPath('userData')`). Cette approche est mise en œuvre via trois fichiers distincts :

1.  `sessionState.json` : Pour la sauvegarde automatique et la restauration de la session de travail en cours.
2.  `simulationSlots.json` : Pour stocker la liste des sauvegardes nommées ("slots") créées par l'utilisateur.
3.  `userPreferences.json` : Pour des paramètres non liés à une simulation, comme l'ordre de tri des sauvegardes ou les couleurs personnalisées des flux.

La lecture et l'écriture de ces fichiers sont gérées par le processus principal d'Electron via le module `fs` de Node.js, exposé de manière sécurisée au frontend via l'API IPC.

## Conséquences

- **Positives :**

  - **Simplicité Extrême :** Ne requiert aucune dépendance externe (comme un moteur de base de données). La logique se limite à la lecture/écriture de fichiers, ce qui est trivial à implémenter et à maintenir.
  - **Transparence et Portabilité :** Les fichiers JSON sont lisibles par un humain, ce qui facilite grandement le débogage. L'utilisateur peut aussi facilement sauvegarder manuellement son répertoire de données s'il le souhaite.
  - **Légèreté :** N'ajoute aucun poids à l'application finale, contrairement à l'intégration d'une base de données comme SQLite.
  - **Performance suffisante :** Pour la taille des simulations envisagées, charger et écrire l'intégralité du fichier JSON en mémoire est une opération quasi-instantanée et tout à fait acceptable.

- **Négatives ou Compromis :**
  - **Non adapté aux grands volumes :** Cette stratégie n'est pas performante pour des ensembles de données de plusieurs mégaoctets, car l'intégralité du fichier est lue/écrite à chaque fois. Ce cas d'usage est considéré comme hors de portée pour ce projet.
  - **Pas de Transactions Atomiques :** Une erreur d'écriture (ex: disque plein) pourrait potentiellement corrompre un fichier. Ce risque est faible et est atténué par la résilience du `data-sanitizer` qui peut récupérer un fichier partiellement corrompu.
  - **Pas de Requêtes Complexes :** Il est impossible d'effectuer des requêtes sur les données sans charger l'intégralité du fichier en mémoire au préalable.

## Complément (octobre 2026) : préférences retenues et version de l'application

- **Ce qui va dans les préférences, pas dans la simulation.** La sauvegarde nommée chargée (`loadedSlotId`), le zoom (`zoom`) et l'état ouvert ou fermé des sections repliables (`sectionsOuvertes`, par identifiant de section) sont des états du poste, rangés dans `userPreferences.json` (dans le stockage du navigateur pour la démo web). Ils ne voyagent pas avec un fichier exporté ou partagé : une simulation envoyée à quelqu'un ne doit pas désigner une sauvegarde de son poste, ni imposer un zoom. Une sauvegarde chargée qui n'existe plus (supprimée, fichier des sauvegardes remplacé) est oubliée au démarrage ou dès sa disparition ; « Sauvegarder » en crée alors une nouvelle.
- **Validation des préférences.** Les deux ponts (process principal d'Electron et démo web) lisent et écrivent les préférences avec `UserPreferencesSchema` : un champ invalide est écarté seul, sans faire perdre les autres. Un fichier illisible donne les préférences par défaut ; une copie en est gardée à côté (`userPreferences.refuse.json`), sans boîte de dialogue, puisque rien de la simulation n'est perdu. Le fichier est écrit à côté puis renommé : enregistré aussi à la fermeture de la fenêtre, il ne reste jamais à moitié écrit.
- **Version de l'application (`appVersion`).** Elle dit quelle version a écrit un fichier, à titre d'information : c'est `formatVersion` qui décide des conversions. La session en cours, un export et le fichier des sauvegardes groupées portent la version qui les a écrits ; une sauvegarde nommée, celle qui l'a enregistrée (création ou mise à jour), et elle la garde dans un export groupé. À l'import, la version du fichier est gardée telle quelle dans la session et indiquée dans la confirmation d'un import ajusté ; elle n'est remplacée par la version actuelle qu'au prochain enregistrement. La version vient de `package.json` : constante fixée par Vite pour l'interface et la démo web, `app.getVersion()` pour le process principal.
