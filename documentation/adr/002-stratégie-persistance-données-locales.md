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
