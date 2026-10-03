# ADR-005: Pérennité des Données via la "Sanitization" à la Volée

- **Date :** 2025-11-08
- **Statut :** Accepté

## Contexte

Un principe fondamental du projet est la longévité des données de l'utilisateur. Le format des fichiers de sauvegarde est amené à évoluer au fil des versions de l'application (ajout de nouveaux champs, modification de structures). Il est crucial que l'application puisse ouvrir des fichiers créés par d'anciennes versions sans planter et sans corrompre les données. L'application doit être résiliente face à des données potentiellement obsolètes, incomplètes ou corrompues.

## Décision

Nous avons adopté une stratégie de **validation et de réparation automatique à la lecture** pour toutes les données externes (chargement de session, import de fichier). Cette stratégie repose sur deux piliers :

1.  **Zod comme Source de Vérité Unique :** La bibliothèque Zod est utilisée pour définir des schémas stricts pour toutes nos structures de données (`SessionState`, `Entity`, etc.). Ces schémas sont considérés comme la définition canonique de ce à quoi les données _doivent_ ressembler dans la version actuelle de l'application.
2.  **Un Module de "Sanitization" (`data-sanitizer.ts`) :** Toute donnée entrante est systématiquement passée à travers ce module. Il utilise `Schema.safeParse()` de Zod pour valider la structure.
    - Les champs manquants dans une ancienne sauvegarde sont automatiquement ajoutés grâce aux `.default()` définis dans les schémas Zod.
    - Les données qui ne correspondent pas au type attendu sont écartées par Zod.
    - Une passe de validation sémantique supplémentaire nettoie les incohérences logiques (ex: suppression des relations ou des flux qui pointent vers des entités qui n'existent plus).
3.  **Notification à l'Utilisateur :** Si des corrections importantes ont été effectuées, un rapport est généré et l'utilisateur en est informé via une notification ou une modale de confirmation, expliquant ce qui a été nettoyé.

## Conséquences

- **Positives :**

  - **Robustesse Exceptionnelle :** L'application ne plantera jamais à cause d'un fichier de sauvegarde mal formé ou d'une ancienne version. Elle se "guérit" elle-même.
  - **Évolutivité Sereine :** Les développeurs peuvent faire évoluer les schémas de données en toute confiance. Il suffit d'ajouter des valeurs par défaut aux nouveaux champs pour assurer la rétrocompatibilité.
  - **Maintenance Simplifiée :** Supprime le besoin de créer des scripts de migration complexes et fragiles pour chaque changement de version.
  - **Fiabilité des Données :** Garantit que l'état de l'application en mémoire est toujours sain et conforme aux schémas actuels.

- **Négatives ou Compromis :**
  - **Perte de Données Contrôlée :** Dans des cas extrêmes où des données sont totalement méconnaissables ou si une fonctionnalité est supprimée, les données correspondantes seront perdues (supprimées) lors du nettoyage. C'est un choix délibéré qui privilégie la stabilité de l'application à la conservation de données invalides.
  - **Couplage Fort à Zod :** L'architecture de la pérennité des données est intrinsèquement liée à la bibliothèque Zod. Un changement de bibliothèque de validation nécessiterait une réécriture significative de cette logique.
